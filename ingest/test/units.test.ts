import { describe, expect, it, vi } from 'vitest';
import { addDays, lastDays, sofiaDate, sofiaDayStart } from '../src/dates.js';
import { parseHashtags } from '../src/hashtags.js';
import { toAccountDailyColumns, toPostMetricColumns } from '../src/metrics.js';
import { shouldRefresh, resolveToken } from '../src/token.js';
import { toPostRow, toPostMetricRow } from '../src/sync.js';
import { FakeDb, jsonResponse } from './fakeDb.js';

describe('parseHashtags', () => {
  it('handles latin, cyrillic, case and duplicates', () => {
    expect(parseHashtags('Нов кадър #Снимай #snimaipro #SnimaiPro, #камера_наем!\n#4k #123')).toEqual([
      'снимай', 'snimaipro', 'камера_наем', '4k',
    ]);
  });
  it('returns empty for no caption or no tags', () => {
    expect(parseHashtags(undefined)).toEqual([]);
    expect(parseHashtags('price # 5 and a#')).toEqual([]);
  });
});

describe('Sofia dates', () => {
  it('uses Sofia calendar day, not UTC', () => {
    expect(sofiaDate(new Date('2026-11-12T22:30:00Z'))).toBe('2026-11-13'); // UTC+2 winter
    expect(sofiaDate(new Date('2026-07-12T21:30:00Z'))).toBe('2026-07-13'); // UTC+3 summer
    expect(sofiaDate(new Date('2026-07-12T20:30:00Z'))).toBe('2026-07-12');
  });
  it('finds day start across DST', () => {
    expect(sofiaDayStart('2026-07-13').toISOString()).toBe('2026-07-12T21:00:00.000Z');
    expect(sofiaDayStart('2026-11-13').toISOString()).toBe('2026-11-12T22:00:00.000Z');
  });
  it('builds day lists', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    const days = lastDays(30, new Date('2026-11-12T10:00:00Z'));
    expect(days).toHaveLength(30);
    expect(days[29]).toBe('2026-11-12');
    expect(days[0]).toBe('2026-10-14');
  });
});

describe('column mapping', () => {
  it('maps insight names to post_metrics columns', () => {
    const cols = toPostMetricColumns({
      reach: 100, views: 250, likes: 10, comments: 2, saved: 5, shares: 3, total_interactions: 20,
      follows: 1, profile_visits: 7, replies: 4, ig_reels_avg_watch_time: 3210.4, ig_reels_video_view_total_time: 9_000_000_000,
    });
    expect(cols).toEqual({
      reach: 100, views: 250, likes: 10, comments: 2, saved: 5, shares: 3, total_interactions: 20,
      follows: 1, profile_visits: 7, replies: 4, avg_watch_time_ms: 3210, total_watch_time_ms: 9_000_000_000,
    });
  });
  it('uses null for missing metrics and keeps full values in raw', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const row = toPostMetricRow('p1', { reach: 5, weird_new_metric: 9 }, now);
    expect(row.saved).toBeNull();
    expect(row.captured_on).toBe('2026-11-12');
    expect(row.raw).toEqual({ reach: 5, weird_new_metric: 9 });
  });
  it('maps account metrics', () => {
    expect(toAccountDailyColumns({ reach: 1, saves: 2, accounts_engaged: 3 }, 6)).toMatchObject({
      reach: 1, saves: 2, accounts_engaged: 3, follower_gain: 6, likes: null,
    });
  });
  it('post rows never contain manual tag columns', () => {
    const row = toPostRow({ id: '1', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-11-01T10:00:00+0000', caption: 'x #a' }, 'now');
    expect(row).not.toHaveProperty('topic');
    expect(row).not.toHaveProperty('hook_type');
    expect(row).not.toHaveProperty('notes');
    expect(row.product_type).toBe('REELS');
    expect(row.hashtags).toEqual(['a']);
  });
});

describe('token refresh decision', () => {
  const now = new Date('2026-11-12T10:00:00Z');
  it('refreshes when missing, unparsable, or older than 7 days', () => {
    expect(shouldRefresh(undefined, now)).toBe(true);
    expect(shouldRefresh(null, now)).toBe(true);
    expect(shouldRefresh('garbage', now)).toBe(true);
    expect(shouldRefresh('2026-11-04T09:00:00Z', now)).toBe(true);
  });
  it('keeps a fresh token', () => {
    expect(shouldRefresh('2026-11-06T10:00:00Z', now)).toBe(false);
  });

  it('uses env token on first run, refreshes and stores it', async () => {
    const db = new FakeDb();
    const fetchFn = vi.fn(async () => jsonResponse({ access_token: 'NEWTOKEN_ABCDEFGH' }));
    const token = await resolveToken({ db: db.client(), envToken: 'ENV_TOKEN_ABCDEFGH', now, fetchFn: fetchFn as any });
    expect(token).toBe('NEWTOKEN_ABCDEFGH');
    expect(String((fetchFn.mock.calls[0] as any)[0])).toContain('access_token=ENV_TOKEN_ABCDEFGH');
    expect(db.rows('app_secrets')[0]).toMatchObject({ key: 'ig_token', value: 'NEWTOKEN_ABCDEFGH', updated_at: now.toISOString() });
  });

  it('skips refresh for a fresh stored token', async () => {
    const db = new FakeDb();
    db.rows('app_secrets').push({ key: 'ig_token', value: 'STORED_TOKEN_ABC', updated_at: '2026-11-11T10:00:00Z' });
    const fetchFn = vi.fn();
    const token = await resolveToken({ db: db.client(), envToken: 'ENV', now, fetchFn: fetchFn as any });
    expect(token).toBe('STORED_TOKEN_ABC');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to the old token when refresh fails', async () => {
    const db = new FakeDb();
    db.rows('app_secrets').push({ key: 'ig_token', value: 'OLD_TOKEN_ABCDEF', updated_at: '2026-10-01T10:00:00Z' });
    const fetchFn = vi.fn(async () => jsonResponse({ error: { message: 'too early', code: 100 } }, 400));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await resolveToken({ db: db.client(), now, fetchFn: fetchFn as any })).toBe('OLD_TOKEN_ABCDEF');
    expect(warn.mock.calls.join(' ')).not.toContain('OLD_TOKEN_ABCDEF');
    warn.mockRestore();
  });

  it('throws when no token exists anywhere', async () => {
    await expect(resolveToken({ db: new FakeDb().client(), now })).rejects.toThrow(/No Instagram token/);
  });
});
