import { describe, expect, it, vi } from 'vitest';
import { IgClient } from '../src/instagram.js';
import { runSync } from '../src/sync.js';
import { FakeDb, apiError, jsonResponse } from './fakeDb.js';

const TOKEN = 'IGAAtesttokentesttokentesttokentesttoken123456';
const now = new Date('2026-11-12T10:00:00Z');
const noSleep = async () => {};

const media = [
  { id: 'm1', caption: 'Reel #snimai', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-11-10T10:00:00+0000', like_count: 5, comments_count: 1, thumbnail_url: 'https://t/1', permalink: 'https://ig/1' },
  { id: 'm2', caption: 'Photo', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: '2026-11-05T10:00:00+0000', media_url: 'https://i/2' },
];

function router(overrides: Record<string, (url: URL) => Response> = {}) {
  return vi.fn(async (input: any) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v[\d.]+\//, '');
    for (const [key, fn] of Object.entries(overrides)) if (path === key) return fn(url);
    if (path === 'me') return jsonResponse({ username: 'snimai.pro', followers_count: 1000, follows_count: 10, media_count: 2 });
    if (path === 'me/media') return jsonResponse({ data: media });
    if (path.endsWith('/insights') && path !== 'me/insights') {
      const names = url.searchParams.get('metric')!.split(',');
      return jsonResponse({ data: names.map((name) => ({ name, values: [{ value: 10 }] })) });
    }
    if (path === 'me/insights') {
      const names = url.searchParams.get('metric')!.split(',');
      if (names[0] === 'follower_count') {
        return jsonResponse({ data: [{ name: 'follower_count', values: [{ value: 3, end_time: '2026-11-12T08:00:00+0000' }] }] });
      }
      return jsonResponse({ data: names.map((name) => ({ name, total_value: { value: 7 } })) });
    }
    return apiError('unknown path ' + path, 100, 404);
  });
}

function setup(fetchFn: any, db = new FakeDb(), fullSync = false) {
  const makeClient = async () => new IgClient({ token: TOKEN, fetchFn, sleep: noSleep });
  return { db, run: () => runSync({ db: db.client(), makeClient, now, fullSync, log: () => {} }) };
}

describe('runSync', () => {
  it('syncs profile, posts, metrics, account days and finishes ok', async () => {
    const { db, run } = setup(router());
    const res = await run();
    expect(res.postsSynced).toBe(2);
    expect(db.rows('ingest_runs')[0]).toMatchObject({ status: 'ok', posts_synced: 2 });
    expect(db.rows('ingest_runs')[0].finished_at).toBeTruthy();
    expect(db.rows('account_snapshots')[0]).toMatchObject({ captured_on: '2026-11-12', username: 'snimai.pro', followers_count: 1000 });
    expect(db.rows('posts')).toHaveLength(2);
    expect(db.rows('posts')[0]).toMatchObject({ id: 'm1', product_type: 'REELS', hashtags: ['snimai'] });
    const metrics = db.rows('post_metrics');
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({ post_id: 'm1', captured_on: '2026-11-12', reach: 10, avg_watch_time_ms: 10 });
    expect(metrics[1]).toMatchObject({ post_id: 'm2', profile_visits: 10, avg_watch_time_ms: null });
    const daily = db.rows('account_daily');
    expect(daily).toHaveLength(30);
    // follower_count end_time 08:00Z on the 12th describes the 11th
    expect(daily.find((d: any) => d.day === '2026-11-11')).toMatchObject({ follower_gain: 3, reach: 7 });
    expect(daily.find((d: any) => d.day === '2026-11-12')?.follower_gain).toBeNull();
  });

  it('is idempotent per day and never overwrites manual columns', async () => {
    const db = new FakeDb();
    const fetchFn = router();
    await setup(fetchFn, db).run();
    db.rows('posts')[0].topic = 'tips';
    db.rows('posts')[0].notes = 'keep me';
    await setup(fetchFn, db).run();
    expect(db.rows('posts')).toHaveLength(2);
    expect(db.rows('post_metrics')).toHaveLength(2);
    expect(db.rows('posts')[0]).toMatchObject({ topic: 'tips', notes: 'keep me' });
    for (const u of db.upserts.filter((x) => x.table === 'posts')) {
      for (const r of u.rows) expect(Object.keys(r)).not.toEqual(expect.arrayContaining(['topic']));
    }
  });

  it('uses a 60 day window after the first run and full history on FULL_SYNC', async () => {
    const db = new FakeDb();
    db.rows('posts').push({ id: 'old' });
    const old = { id: 'x', media_type: 'IMAGE', timestamp: '2025-01-01T00:00:00+0000' };
    const fetchFn = router({ 'me/media': () => jsonResponse({ data: [...media, old] }) });
    expect((await setup(fetchFn, db).run()).postsSynced).toBe(2);
    expect((await setup(fetchFn, db, true).run()).postsSynced).toBe(3);
  });

  it('keeps going when one post has no insights', async () => {
    let n = 0;
    const fetchFn = router({
      'm1/insights': () => apiError('no insights'),
    });
    const { db, run } = setup(fetchFn);
    const res = await run();
    n += res.warnings.length;
    expect(n).toBeGreaterThan(0);
    expect(db.rows('post_metrics')).toHaveLength(1);
    expect(db.rows('ingest_runs')[0].status).toBe('ok');
    expect(db.rows('ingest_runs')[0].message).toContain('warning');
  });

  it('marks the run as error and masks the token when the profile call fails', async () => {
    const fetchFn = router({ me: () => jsonResponse({ error: { message: `Invalid token ${TOKEN}`, code: 190 } }, 400) });
    const { db, run } = setup(fetchFn);
    await expect(run()).rejects.toThrow(/Instagram API 400/);
    const row = db.rows('ingest_runs')[0];
    expect(row.status).toBe('error');
    expect(row.finished_at).toBeTruthy();
    expect(row.message).not.toContain(TOKEN);
  });

  it('logs token problems in ingest_runs too', async () => {
    const db = new FakeDb();
    await expect(
      runSync({ db: db.client(), makeClient: async () => { throw new Error('No Instagram token'); }, now, log: () => {} }),
    ).rejects.toThrow();
    expect(db.rows('ingest_runs')[0]).toMatchObject({ status: 'error', message: 'No Instagram token' });
  });

  it('a Supabase write failure marks the run as error', async () => {
    const db = new FakeDb();
    db.failTables.add('posts');
    await expect(setup(router(), db).run()).rejects.toThrow();
    expect(db.rows('ingest_runs')[0].status).toBe('error');
  });
});
