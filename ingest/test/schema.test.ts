import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION = fileURLToPath(new URL('../../supabase/migrations/0001_init.sql', import.meta.url));

// Stand-ins for what Supabase provides before migrations run.
const SUPABASE_STUB = `
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(MIGRATION, 'utf8'));
});

afterAll(async () => {
  await db.close();
});

describe('0001_init.sql', () => {
  it('creates all contract tables and the view', async () => {
    const { rows } = await db.query<{ n: string }>(
      `select table_name n from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(rows.map((r) => r.n)).toEqual([
      'account_daily', 'account_snapshots', 'allowed_users', 'app_secrets', 'ingest_runs',
      'post_latest', 'post_metrics', 'posts',
    ]);
  });

  it('computes caption_length and defaults', async () => {
    await db.exec(`
      insert into posts (id, caption, media_type, product_type, posted_at)
        values ('p1', 'Здравей #snimai', 'VIDEO', 'REELS', now() - interval '10 days'),
               ('p2', 'fresh', 'IMAGE', 'FEED', now() - interval '2 hours'),
               ('p3', '', 'IMAGE', 'FEED', now() - interval '5 days');
    `);
    const { rows } = await db.query<{ caption_length: number; product_type: string }>(
      `select caption_length, product_type from posts where id = 'p1'`,
    );
    expect(rows[0]).toEqual({ caption_length: 15, product_type: 'REELS' });
  });

  it('post_latest picks the newest snapshot and derives rates', async () => {
    await db.exec(`
      insert into post_metrics (post_id, captured_on, reach, views, saved, shares, comments, follows, total_interactions, raw)
        values ('p1', current_date - 3, 100, 150, 1, 1, 0, 0, 5, '{"reach":100}'),
               ('p1', current_date,     200, 400, 10, 6, 4, 2, 50, '{"reach":200}'),
               ('p2', current_date,     0,   0,   0,  0, 0, 0, 0, '{}'),
               ('p3', current_date,     null, null, null, null, null, null, null, '{}');
    `);
    const { rows } = await db.query<Record<string, any>>(
      `select id, reach, engagement_rate, save_rate, share_rate, comment_rate, follow_rate, too_fresh
         from post_latest order by id`,
    );
    expect(rows).toHaveLength(3);
    const p1 = rows[0]!;
    expect(p1.reach).toBe(200);
    expect(Number(p1.engagement_rate)).toBeCloseTo(0.25);
    expect(Number(p1.save_rate)).toBeCloseTo(0.05);
    expect(Number(p1.share_rate)).toBeCloseTo(0.03);
    expect(Number(p1.comment_rate)).toBeCloseTo(0.02);
    expect(Number(p1.follow_rate)).toBeCloseTo(0.01);
    expect(p1.too_fresh).toBe(false);
    // zero or null reach gives null rates, not a division error
    expect(rows[1]!.engagement_rate).toBeNull();
    expect(rows[1]!.too_fresh).toBe(true);
    expect(rows[2]!.share_rate).toBeNull();
  });

  it('upserts on (post_id, captured_on), as ingest does', async () => {
    await db.exec(`
      insert into post_metrics (post_id, captured_on, reach) values ('p2', current_date, 77)
        on conflict (post_id, captured_on) do update set reach = excluded.reach;
    `);
    const { rows } = await db.query<{ n: string; reach: number }>(
      `select count(*) n, max(reach) reach from post_metrics where post_id = 'p2'`,
    );
    expect(Number(rows[0]!.n)).toBe(1);
    expect(rows[0]!.reach).toBe(77);
  });

  it('upsert from ingest keeps manual tag columns', async () => {
    await db.exec(`update posts set topic = 'tips', hook_type = 'question', notes = 'n' where id = 'p1'`);
    await db.exec(`
      insert into posts (id, caption, media_type, posted_at) values ('p1', 'changed', 'VIDEO', now())
        on conflict (id) do update set caption = excluded.caption, updated_at = now();
    `);
    const { rows } = await db.query<Record<string, any>>(`select topic, hook_type, notes, caption from posts where id = 'p1'`);
    expect(rows[0]).toEqual({ topic: 'tips', hook_type: 'question', notes: 'n', caption: 'changed' });
  });

  it('inserts account, run and secret rows', async () => {
    await db.exec(`
      insert into account_snapshots (username, followers_count) values ('snimai.pro', 1000);
      insert into account_daily (day, reach, follower_gain) values (current_date, 5, 2);
      insert into ingest_runs (status) values ('ok');
      insert into app_secrets (key, value) values ('ig_token', 'x');
    `);
    const { rows } = await db.query<{ captured_on: string }>(`select captured_on from account_snapshots`);
    expect(rows).toHaveLength(1);
  });

  it('RLS: allow-listed user reads, others do not, tags editable only on 3 columns', async () => {
    await db.exec(`insert into allowed_users (email) values ('team@example.com')`);
    const asUser = async (email: string, sql: string) => {
      await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"email":"${email}"}', false);`);
      try {
        return await db.query<any>(sql);
      } finally {
        await db.exec(`reset role`);
      }
    };

    expect((await asUser('team@example.com', 'select id from post_latest')).rows).toHaveLength(3);
    expect((await asUser('stranger@example.com', 'select id from posts')).rows).toHaveLength(0);
    await expect(asUser('team@example.com', 'select * from app_secrets')).resolves.toMatchObject({ rows: [] });

    await asUser('team@example.com', `update posts set topic = 'bts' where id = 'p2'`);
    expect((await db.query<any>(`select topic from posts where id = 'p2'`)).rows[0].topic).toBe('bts');
    await expect(asUser('team@example.com', `update posts set caption = 'hack' where id = 'p2'`)).rejects.toThrow(/permission denied/);
  });
});
