# snimai.pro Social Hub

Private dashboard with every snimai.pro Instagram post and its full stats history.
Data refreshes daily from the official Instagram API. Built for the snimai.pro social media team.

- **Web app:** `web/` (React, hosted free on Cloudflare Pages)
- **Database + login:** Supabase (`supabase/`)
- **Daily data sync:** GitHub Actions (`ingest/`, `.github/workflows/ingest.yml`)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

Without a backend configured, the site runs in demo mode with sample data.

## One-time setup (about 30 minutes)

### 1. Supabase

1. Create a free project at supabase.com (region: Frankfurt).
2. SQL Editor: paste and run `supabase/migrations/0001_init.sql`.
3. Allow your team to log in. In the SQL Editor run:
   ```sql
   insert into public.allowed_users (email) values ('your@email.com');
   ```
4. Authentication > URL Configuration: set **Site URL** to
   your Cloudflare site URL (step 4) and add it to Redirect URLs.
5. Project Settings > API: copy the **Project URL**, the **anon key** and the **service_role key**.

### 2. Instagram token

Same as the snimai IG connector: Meta developer app, Instagram API with Instagram Login,
generate a token for the snimai.pro Professional account with
`instagram_business_basic` and `instagram_business_manage_insights`.
The sync refreshes the token by itself after the first run.

### 3. GitHub secrets

Repo > Settings > Secrets and variables > Actions > New repository secret:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (keep private) |
| `IG_TOKEN` | Instagram token |

### 4. Cloudflare hosting (free, works with private repos)

1. dash.cloudflare.com > **Workers & Pages** > Create > Import a repository > pick `snimaipro-social-hub`.
2. Settings:
   - Root directory (path): `web`
   - Build command: `npm ci && npm run build`
   - Deploy command: `npx wrangler deploy` (uses `web/wrangler.jsonc`)
3. Variables (Settings > Build > Variables and secrets, used at build time):
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
4. Every push to `main` redeploys automatically. The site lives at
   `https://snimaipro-social-hub.<your-subdomain>.workers.dev/`.

Without the two `VITE_` variables the site runs in demo mode with sample data.

### 5. First run

Actions > **Instagram ingest** > Run workflow (tick *full sync*).
Open your Cloudflare site URL and log in with your email.
If you added the Supabase variables after the first deploy, trigger a new build in Cloudflare (Deployments > Retry, or push any commit).

## Security

The repo is public. No keys or stats live in it. Stats sit in Supabase, readable only by
logged-in emails listed in `allowed_users`. The anon key is public by design; the
service_role key exists only in GitHub secrets.

## Roadmap

- v1: post analytics (this)
- v2: content planner (calendar, ideas, scripts, status)
- v3: AI weekly insights and content ideas from the data
- v4: daily Story capture and comments feed
