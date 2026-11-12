import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, lastDays, sofiaDate, sofiaDayStart } from './dates.js';
import { parseHashtags } from './hashtags.js';
import { IgApiError, type IgClient, type IgMedia } from './instagram.js';
import { toAccountDailyColumns, toPostMetricColumns, type InsightValues } from './metrics.js';
import { errorMessage } from './redact.js';

export const RECENT_DAYS = 60;
export const ACCOUNT_DAYS = 30;
const CHUNK = 200;

export interface SyncDeps {
  db: SupabaseClient;
  /** Called after the run row exists, so token problems are logged in ingest_runs. */
  makeClient: () => Promise<IgClient>;
  now?: Date;
  fullSync?: boolean;
  log?: (msg: string) => void;
}

export interface SyncResult {
  runId: number;
  postsSynced: number;
  warnings: string[];
}

/** Insert or update rows, failing loudly on a Supabase error. */
async function upsertRows(db: SupabaseClient, table: string, rows: object[], onConflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

/** Posts row without the manual columns (topic, hook_type, notes), so upserts never overwrite them. */
export function toPostRow(m: IgMedia, nowIso: string) {
  const caption = m.caption ?? '';
  return {
    id: m.id,
    caption,
    media_type: m.media_type,
    product_type: m.media_product_type ?? 'FEED',
    permalink: m.permalink ?? null,
    thumbnail_url: m.thumbnail_url ?? null,
    media_url: m.media_url ?? null,
    posted_at: m.timestamp,
    hashtags: parseHashtags(caption),
    like_count: m.like_count ?? null,
    comments_count: m.comments_count ?? null,
    updated_at: nowIso,
  };
}

export function toPostMetricRow(postId: string, values: InsightValues, now: Date) {
  return {
    post_id: postId,
    captured_on: sofiaDate(now),
    captured_at: now.toISOString(),
    ...toPostMetricColumns(values),
    raw: values,
  };
}

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const { db } = deps;
  const log = deps.log ?? ((m: string) => console.log(m));
  const now = deps.now ?? new Date();

  const { data: run, error: runError } = await db.from('ingest_runs').insert({ status: 'running' }).select('id').single();
  if (runError || !run) throw new Error(`Cannot start ingest run: ${runError?.message ?? 'no row'}`);
  const runId = Number(run.id);

  const warnings: string[] = [];
  let postsSynced = 0;
  try {
    const ig = await deps.makeClient();
    await syncProfile(db, ig, now);
    postsSynced = await syncPosts(db, ig, now, deps.fullSync ?? false, warnings, log);
    await syncAccountDaily(db, ig, now, warnings, log);

    const message = warnings.length ? `ok with ${warnings.length} warning(s): ${warnings.slice(0, 5).join(' | ')}` : 'ok';
    await finishRun(db, runId, 'ok', postsSynced, message);
    log(`Sync finished: ${postsSynced} posts, ${warnings.length} warnings`);
    return { runId, postsSynced, warnings };
  } catch (e) {
    const message = errorMessage(e).slice(0, 1000);
    await finishRun(db, runId, 'error', postsSynced, message).catch(() => undefined);
    throw new Error(message);
  }
}

async function finishRun(db: SupabaseClient, id: number, status: 'ok' | 'error', posts: number, message: string) {
  const { error } = await db
    .from('ingest_runs')
    .update({ status, posts_synced: posts, message, finished_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Cannot finish ingest run: ${error.message}`);
}

async function syncProfile(db: SupabaseClient, ig: IgClient, now: Date): Promise<void> {
  const p = await ig.getProfile();
  await upsertRows(
    db,
    'account_snapshots',
    [
      {
        captured_on: sofiaDate(now),
        username: p.username ?? null,
        followers_count: p.followers_count ?? null,
        follows_count: p.follows_count ?? null,
        media_count: p.media_count ?? null,
        captured_at: now.toISOString(),
      },
    ],
    'captured_on',
  );
}

async function syncPosts(
  db: SupabaseClient,
  ig: IgClient,
  now: Date,
  fullSync: boolean,
  warnings: string[],
  log: (m: string) => void,
): Promise<number> {
  const { count, error } = await db.from('posts').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Cannot count posts: ${error.message}`);
  const full = fullSync || !count;

  const since = full ? undefined : new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const media = await ig.listMedia(since);
  log(`${full ? 'Full' : 'Recent'} sync: ${media.length} media`);
  await upsertRows(db, 'posts', media.map((m) => toPostRow(m, now.toISOString())), 'id');

  const metricRows: object[] = [];
  for (const m of media) {
    try {
      const values = await ig.getMediaInsights(m.id, m.media_product_type ?? 'FEED');
      if (Object.keys(values).length === 0) {
        warnings.push(`no insights for ${m.id}`);
        continue;
      }
      metricRows.push(toPostMetricRow(m.id, values, now));
    } catch (e) {
      if (e instanceof IgApiError && e.isAuth) throw e;
      warnings.push(`insights failed for ${m.id}: ${errorMessage(e)}`);
    }
  }
  await upsertRows(db, 'post_metrics', metricRows, 'post_id,captured_on');
  return media.length;
}

async function syncAccountDaily(
  db: SupabaseClient,
  ig: IgClient,
  now: Date,
  warnings: string[],
  log: (m: string) => void,
): Promise<void> {
  const days = lastDays(ACCOUNT_DAYS, now);
  const nowSec = Math.floor(now.getTime() / 1000);

  const gains = new Map<string, number>();
  try {
    const series = await ig.getFollowerSeries(Math.floor(sofiaDayStart(days[0]!).getTime() / 1000), nowSec);
    for (const { endTime, value } of series) {
      // end_time closes Instagram's 24h window (about 08:00 UTC), so it describes the previous day.
      gains.set(addDays(new Date(endTime).toISOString().slice(0, 10), -1), value);
    }
  } catch (e) {
    warnings.push(`follower_count failed: ${errorMessage(e)}`);
  }

  const rows: object[] = [];
  let consecutiveFailures = 0;
  for (const day of days) {
    if (consecutiveFailures >= 3) break;
    const since = Math.floor(sofiaDayStart(day).getTime() / 1000);
    const until = Math.min(Math.floor(sofiaDayStart(addDays(day, 1)).getTime() / 1000), nowSec);
    try {
      const values = await ig.getAccountTotals(since, until);
      consecutiveFailures = 0;
      rows.push({
        day,
        ...toAccountDailyColumns(values, gains.get(day) ?? null),
        raw: { ...values, ...(gains.has(day) ? { follower_count: gains.get(day) } : {}) },
        updated_at: now.toISOString(),
      });
    } catch (e) {
      consecutiveFailures++;
      warnings.push(`account insights failed for ${day}: ${errorMessage(e)}`);
    }
  }
  await upsertRows(db, 'account_daily', rows, 'day');
  log(`Account daily: ${rows.length} days`);
}
