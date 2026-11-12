-- snimai.pro Social Hub: initial schema (CONTRACT, owned by the architect).
-- Ingest writes with the service role key. The web app reads as an authenticated user.

-- ---------- Posts ----------
create table public.posts (
  id               text primary key,               -- Instagram media id
  caption          text not null default '',
  media_type       text not null,                  -- IMAGE | VIDEO | CAROUSEL_ALBUM
  product_type     text not null default 'FEED',   -- FEED | REELS | STORY
  permalink        text,
  thumbnail_url    text,                           -- video/reel cover
  media_url        text,                           -- image url (expires; refreshed each ingest)
  posted_at        timestamptz not null,
  caption_length   int generated always as (char_length(caption)) stored,
  hashtags         text[] not null default '{}',
  like_count       int,
  comments_count   int,
  -- manual tags edited in the web app
  topic            text,   -- gear_spotlight | tips | crew_community | bts | partner | platform_howto | other
  hook_type        text,   -- question | price_compare | pov | list | relatable | announcement | other
  notes            text,
  first_seen_at    timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index posts_posted_at_idx on public.posts (posted_at desc);

-- One row per post per capture day, so we can see how stats grow over time.
create table public.post_metrics (
  post_id                  text not null references public.posts(id) on delete cascade,
  captured_on              date not null default (now() at time zone 'Europe/Sofia')::date,
  captured_at              timestamptz not null default now(),
  reach                    int,
  views                    int,
  likes                    int,
  comments                 int,
  saved                    int,
  shares                   int,
  total_interactions       int,
  follows                  int,
  profile_visits           int,
  replies                  int,            -- stories
  avg_watch_time_ms        int,            -- reels
  total_watch_time_ms      bigint,         -- reels
  raw                      jsonb not null default '{}'::jsonb,
  primary key (post_id, captured_on)
);

-- ---------- Account ----------
create table public.account_snapshots (
  captured_on      date primary key default (now() at time zone 'Europe/Sofia')::date,
  username         text,
  followers_count  int,
  follows_count    int,
  media_count      int,
  captured_at      timestamptz not null default now()
);

create table public.account_daily (
  day                   date primary key,       -- Instagram insight day
  reach                 int,
  views                 int,
  accounts_engaged      int,
  total_interactions    int,
  likes                 int,
  comments              int,
  saves                 int,
  shares                int,
  profile_links_taps    int,
  follower_gain         int,
  raw                   jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default now()
);

-- ---------- Ops ----------
create table public.ingest_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running',   -- running | ok | error
  posts_synced  int not null default 0,
  message       text
);

-- Private: Instagram token storage for auto-refresh. No RLS policies => only service role.
create table public.app_secrets (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ---------- Views (derived rates, latest snapshot per post) ----------
create view public.post_latest with (security_invoker = true) as
select distinct on (m.post_id)
  p.*,
  m.captured_on, m.captured_at,
  m.reach, m.views, m.likes, m.comments, m.saved, m.shares,
  m.total_interactions, m.follows, m.profile_visits, m.replies,
  m.avg_watch_time_ms, m.total_watch_time_ms,
  case when m.reach > 0 then m.total_interactions::numeric / m.reach end as engagement_rate,
  case when m.reach > 0 then m.saved::numeric  / m.reach end as save_rate,
  case when m.reach > 0 then m.shares::numeric / m.reach end as share_rate,
  case when m.reach > 0 then m.comments::numeric / m.reach end as comment_rate,
  case when m.reach > 0 then m.follows::numeric / m.reach end as follow_rate,
  (now() - p.posted_at) < interval '48 hours' as too_fresh
from public.posts p
join public.post_metrics m on m.post_id = p.id
order by m.post_id, m.captured_on desc;

-- ---------- Security ----------
alter table public.posts              enable row level security;
alter table public.post_metrics       enable row level security;
alter table public.account_snapshots  enable row level security;
alter table public.account_daily      enable row level security;
alter table public.ingest_runs        enable row level security;
alter table public.app_secrets        enable row level security;

-- Only allow-listed team members (see allowed_users) can read.
create table public.allowed_users (email text primary key);
alter table public.allowed_users enable row level security;

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_users where email = auth.jwt() ->> 'email');
$$;

create policy team_read on public.posts             for select to authenticated using (public.is_team());
create policy team_read on public.post_metrics      for select to authenticated using (public.is_team());
create policy team_read on public.account_snapshots for select to authenticated using (public.is_team());
create policy team_read on public.account_daily     for select to authenticated using (public.is_team());
create policy team_read on public.ingest_runs       for select to authenticated using (public.is_team());
create policy self_read on public.allowed_users     for select to authenticated using (email = auth.jwt() ->> 'email');

-- Team can edit ONLY the manual tag columns on posts.
create policy team_tag on public.posts for update to authenticated using (public.is_team()) with check (public.is_team());
revoke update on public.posts from authenticated;
grant  update (topic, hook_type, notes) on public.posts to authenticated;

-- Seed: add your login email(s) after running this migration, e.g.
-- insert into public.allowed_users (email) values ('you@example.com');
