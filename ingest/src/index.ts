import { createClient } from '@supabase/supabase-js';
import { IgClient } from './instagram.js';
import { errorMessage } from './redact.js';
import { runSync } from './sync.js';
import { resolveToken } from './token.js';

async function main(): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IG_TOKEN, FULL_SYNC, IG_API_VERSION } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await runSync({
    db,
    fullSync: FULL_SYNC === '1' || FULL_SYNC === 'true',
    makeClient: async () =>
      new IgClient({
        token: await resolveToken({ db, envToken: IG_TOKEN }),
        version: IG_API_VERSION || 'v25.0',
      }),
  });
}

main().catch((e) => {
  console.error(`Ingest failed: ${errorMessage(e, [process.env.IG_TOKEN, process.env.SUPABASE_SERVICE_ROLE_KEY])}`);
  process.exit(1);
});
