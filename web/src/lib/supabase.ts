import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Demo mode: no Supabase URL configured, the app runs on bundled mock data. */
export const DEMO_MODE = !url;

export const supabase: SupabaseClient | null = DEMO_MODE
  ? null
  : createClient(url as string, key ?? '', {
      // PKCE keeps the magic link as ?code=... (before the #), which plays well with HashRouter.
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
