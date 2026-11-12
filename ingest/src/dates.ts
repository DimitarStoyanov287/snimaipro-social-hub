const TZ = 'Europe/Sofia';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Calendar date (YYYY-MM-DD) of an instant in Europe/Sofia. */
export function sofiaDate(d: Date): string {
  return fmt.format(d);
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The instant when the given Sofia calendar day starts. */
export function sofiaDayStart(ymd: string): Date {
  const utc = Date.parse(`${ymd}T00:00:00Z`);
  for (const offsetHours of [3, 2]) {
    const c = new Date(utc - offsetHours * 3_600_000);
    if (sofiaDate(c) === ymd && sofiaDate(new Date(c.getTime() - 1)) !== ymd) return c;
  }
  return new Date(utc - 2 * 3_600_000);
}

/** The last n Sofia days ending today, oldest first. */
export function lastDays(n: number, now: Date): string[] {
  const today = sofiaDate(now);
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
