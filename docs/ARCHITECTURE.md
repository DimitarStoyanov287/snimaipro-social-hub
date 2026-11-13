# snimai.pro Social Hub: architecture

Single source of truth for the build. Owned by the architect. Workers must not change
the database contract (`supabase/migrations/0001_init.sql`) without asking.

## Goal (v1)

Private web dashboard with every snimai.pro Instagram post and all its stats, stored
historically, so the social media team can see what works. v1 scope: **post analytics only**.
Later phases (not now): content planner, AI insights, Stories capture, comments feed.

## Stack

| Part | Choice | Where |
|---|---|---|
| Web app | Vite + React 18 + TypeScript + Tailwind + Recharts + react-router (HashRouter) | `web/`, deployed to Cloudflare Pages |
| Auth + DB | Supabase (Postgres, email magic link login, RLS, allow-list table) | `supabase/` |
| Ingest | Node 20 + TypeScript (tsx), runs in GitHub Actions on cron | `ingest/`, `.github/workflows/ingest.yml` |
| Deploy | Cloudflare Pages Git integration builds `web/` on every push to main | Cloudflare dashboard |

## Data flow

1. `ingest.yml` runs daily at 05:17 UTC (and manually via workflow_dispatch).
2. Ingest reads the Instagram token from `app_secrets` (key `ig_token`), falling back to the
   `IG_TOKEN` Actions secret on first run. Refreshes it if older than 7 days.
3. Pulls profile, all media (paged, newest first; full history on first run, last 60 days
   afterwards), per-media insights, last 30 days of account insights.
4. Upserts into Supabase with the service role key. One `post_metrics` row per post per day.
5. Logs the run in `ingest_runs`.
6. Web app reads tables and the `post_latest` view as an authenticated, allow-listed user.

## Instagram API facts (Instagram API with Instagram Login)

- Host `https://graph.instagram.com/v25.0/`, path `me/...`, token in `access_token` query param.
- Media fields: `id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url`
- Media insights `GET {id}/insights?metric=...`
  - REELS: reach,views,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time
  - FEED: reach,views,likes,comments,saved,shares,total_interactions,profile_visits,follows
  - Any metric may be rejected: retry one by one, remember rejected metrics per product type, never fail the whole run.
- Account insights `GET me/insights?metric=reach,views,accounts_engaged,total_interactions,likes,comments,saves,shares,profile_links_taps&period=day&metric_type=total_value&since&until` (max 30 days). Per-day values: call one day at a time OR use `follower_count` (period=day time series).
- Refresh: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...`
- Data lags up to 48h. Carousel children have no insights.

## Secrets (GitHub Actions secrets, never committed)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `IG_TOKEN` (ingest);
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Cloudflare Pages env vars, web build). Anon key is public by design; RLS protects data.

## Web app pages (v1)

1. **Login**: magic link email. Not allow-listed users see "no access".
2. **Overview**: KPI tiles (followers + gain, 30d reach, 30d interactions, avg engagement, save and share rate), reach and follower trend charts, top 5 and bottom 5 posts by share rate, last sync status.
3. **Posts**: grid and table toggle; thumbnail, date, type, topic, hook, reach, views, ER, save rate, share rate; sort any column; filters: type, topic, hook, date range, search caption; too-fresh badge.
4. **Post detail**: thumbnail and caption, link to Instagram, all metrics, rates vs account average, growth chart from `post_metrics` history, edit topic/hook/notes.
5. **Compare**: averages grouped by format, topic, hook, weekday, posting hour (Sofia time), caption length bucket; heatmap weekday x hour.
6. **Sync**: last `ingest_runs`, how to trigger a run.

Demo mode: if `VITE_SUPABASE_URL` is missing, the app runs on bundled realistic mock data
so it can be previewed without a backend.

## Brand

Yellow `#F2C314`, black `#1A1A14`, cream `#EAE4DA`, red `#C63F3E`, orange `#ED773C`,
green `#245E55`, pink `#EAA7C7`. Headings serif (Bodoni-like, e.g. "Bodoni Moda"),
body clean sans (e.g. "Inter" as Garet stand-in). UI language Bulgarian. Never use em dashes in UI copy. Currency €.
