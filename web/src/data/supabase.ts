import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountDaily, AccountSnapshot, IngestRun, PostLatest, PostMetric } from '../types/db';
import type { DataApi } from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function createSupabaseApi(sb: SupabaseClient): DataApi {
  let postsCache: Promise<PostLatest[]> | null = null;

  return {
    demo: false,
    async isAllowed(email) {
      const res = await sb.from('allowed_users').select('email').eq('email', email).maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return !!res.data;
    },
    getPosts() {
      if (!postsCache) {
        postsCache = (async () => {
          const res = await sb.from('post_latest').select('*').order('posted_at', { ascending: false }).limit(5000);
          return check<PostLatest[]>(res as never) ?? [];
        })();
        postsCache.catch(() => { postsCache = null; });
      }
      return postsCache;
    },
    async getPost(id) {
      const [p, h] = await Promise.all([
        sb.from('post_latest').select('*').eq('id', id).maybeSingle(),
        sb.from('post_metrics').select('*').eq('post_id', id).order('captured_on', { ascending: true }),
      ]);
      const post = check<PostLatest | null>(p as never);
      if (!post) return null;
      return { post, history: check<PostMetric[]>(h as never) ?? [] };
    },
    async updatePostTags(id, patch) {
      const res = await sb.from('posts').update(patch).eq('id', id).select('id');
      const rows = check<Array<{ id: string }>>(res as never);
      if (!rows || rows.length === 0) throw new Error('Нямате право да редактирате или публикацията не е намерена.');
      postsCache = null;
    },
    async getAccountDaily() {
      const res = await sb.from('account_daily').select('*').order('day', { ascending: true }).limit(2000);
      return check<AccountDaily[]>(res as never) ?? [];
    },
    async getSnapshots() {
      const res = await sb.from('account_snapshots').select('*').order('captured_on', { ascending: true }).limit(2000);
      return check<AccountSnapshot[]>(res as never) ?? [];
    },
    async getIngestRuns() {
      const res = await sb.from('ingest_runs').select('*').order('started_at', { ascending: false }).limit(30);
      return check<IngestRun[]>(res as never) ?? [];
    },
  };
}
