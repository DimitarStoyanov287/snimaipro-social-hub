// Keep secrets out of logs and stored error messages.
const PATTERNS: RegExp[] = [
  /access_token=[^&\s"']+/gi,
  /\bIG[A-Za-z0-9_-]{30,}/g, // Instagram user tokens
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWTs (Supabase keys)
];

export function redact(text: string, secrets: readonly (string | undefined)[] = []): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 8) out = out.split(s).join('***');
  }
  for (const re of PATTERNS) {
    out = out.replace(re, (m) => (m.toLowerCase().startsWith('access_token=') ? 'access_token=***' : '***'));
  }
  return out;
}

export function errorMessage(err: unknown, secrets: readonly (string | undefined)[] = []): string {
  const raw = err instanceof Error ? err.message : String(err);
  return redact(raw, secrets);
}
