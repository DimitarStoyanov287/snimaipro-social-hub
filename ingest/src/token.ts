import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshAccessToken, type FetchFn, type SleepFn } from './instagram.js';
import { errorMessage } from './redact.js';

export const TOKEN_KEY = 'ig_token';
export const REFRESH_AFTER_MS = 7 * 86_400_000;

/** Refresh when the stored token has no timestamp, or is older than 7 days. */
export function shouldRefresh(updatedAt: string | null | undefined, now: Date): boolean {
  if (!updatedAt) return true;
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > REFRESH_AFTER_MS;
}

export interface ResolveTokenOpts {
  db: SupabaseClient;
  envToken?: string;
  now?: Date;
  fetchFn?: FetchFn;
  sleep?: SleepFn;
}

/** Token from app_secrets (falls back to IG_TOKEN env), refreshed and stored back when stale. */
export async function resolveToken(o: ResolveTokenOpts): Promise<string> {
  const now = o.now ?? new Date();
  const { data: row, error } = await o.db
    .from('app_secrets')
    .select('value,updated_at')
    .eq('key', TOKEN_KEY)
    .maybeSingle();
  if (error) throw new Error(`Cannot read app_secrets: ${error.message}`);

  const token = row?.value || o.envToken;
  if (!token) throw new Error('No Instagram token: app_secrets is empty and IG_TOKEN is not set');

  if (!shouldRefresh(row?.updated_at, now)) return token;

  try {
    const fresh = await refreshAccessToken(token, { fetchFn: o.fetchFn, sleep: o.sleep });
    const { error: saveError } = await o.db
      .from('app_secrets')
      .upsert({ key: TOKEN_KEY, value: fresh, updated_at: now.toISOString() }, { onConflict: 'key' });
    if (saveError) throw new Error(`Cannot store refreshed token: ${saveError.message}`);
    return fresh;
  } catch (e) {
    // The old token may still be valid; keep going and let the API calls decide.
    console.warn(`Token refresh failed, using existing token: ${errorMessage(e, [token])}`);
    return token;
  }
}
