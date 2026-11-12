# Instagram ingest

Pulls the snimai.pro Instagram profile, posts, per-post insights and 30 days of account
insights into Supabase. Runs daily in GitHub Actions (`.github/workflows/ingest.yml`).

## Run locally

Needs Node 20+ and a Supabase project with `supabase/migrations/0001_init.sql` applied.

```sh
cd ingest
npm ci
npm test
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
IG_TOKEN=... \
npx tsx src/index.ts
```

The first run (no rows in `posts`) pulls the full history. Later runs cover the last 60 days.
Each run writes one `post_metrics` row per post per Sofia day, so reruns on the same day just update it.

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key. Bypasses RLS, never expose it in the web app. |
| `IG_TOKEN` | first run | Long-lived Instagram token. After the first run the token lives in `app_secrets` (`ig_token`) and is refreshed there when older than 7 days. `IG_TOKEN` is only a fallback. |
| `FULL_SYNC` | no | `1` re-pulls the full media history. |
| `IG_API_VERSION` | no | Graph API version, default `v25.0`. |

## Notes

- Metrics Instagram rejects for a media type are remembered for the rest of the run and skipped.
- Per-post and per-day failures are recorded as warnings in `ingest_runs.message`; the run still ends `ok`.
  Profile, media listing, database and token errors end the run with status `error`.
- Hashtags are stored lowercase, without the leading `#`.
- Tokens and keys are redacted from logs and stored error messages.
