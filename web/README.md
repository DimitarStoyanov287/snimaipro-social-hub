# snimai.pro Social Hub, web

Vite + React 18 + TypeScript + Tailwind + Recharts. Reads Supabase (see `../docs/ARCHITECTURE.md`).

## Run locally

```
cd web
npm install
npm run dev
```

With no env vars the app starts in demo mode on bundled mock data (badge "Демо данни").

## Environment

Copy `.env.example` to `.env.local`:

- `VITE_SUPABASE_URL`: project URL. Empty means demo mode.
- `VITE_SUPABASE_ANON_KEY`: anon key (public by design, RLS protects data).

In Supabase Auth, add the deployed URL (for example `https://<user>.github.io/snimaipro-social-hub/`) to the allowed redirect URLs. Add team emails to `allowed_users`.

## Build and deploy

`npm run build` outputs `dist/` with relative asset paths, so it works on GitHub Pages. The workflow `.github/workflows/deploy.yml` builds on push to main and uses the repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
