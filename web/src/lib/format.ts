const nf = new Intl.NumberFormat('bg-BG');
const nf1 = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('bg-BG', { notation: 'compact', maximumFractionDigits: 1 });

export const DASH = '–'; // en dash used only as an empty-value placeholder

export const fmtInt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? DASH : nf.format(Math.round(n)));
export const fmtCompact = (n: number | null | undefined) => (n == null ? DASH : compact.format(n));
export const fmtDec = (n: number | null | undefined) => (n == null ? DASH : nf1.format(n));
/** ratio (0.034) -> "3,4%" */
export const fmtPct = (r: number | null | undefined) => (r == null || Number.isNaN(r) ? DASH : `${nf1.format(r * 100)}%`);
export const fmtSigned = (n: number | null | undefined) =>
  n == null ? DASH : `${n > 0 ? '+' : n < 0 ? '−' : ''}${nf.format(Math.abs(Math.round(n)))}`;
export const fmtSignedPct = (r: number | null | undefined) =>
  r == null || !Number.isFinite(r) ? DASH : `${r > 0 ? '+' : r < 0 ? '−' : ''}${nf1.format(Math.abs(r) * 100)}%`;

const TZ = 'Europe/Sofia';
const dateFmt = new Intl.DateTimeFormat('bg-BG', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('bg-BG', { timeZone: TZ, day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('bg-BG', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

export const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : DASH);
export const fmtShortDate = (iso: string | null | undefined) => (iso ? shortFmt.format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)) : DASH);
export const fmtDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : DASH);

export function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return DASH;
  const s = ms / 1000;
  return `${nf1.format(s)} сек`;
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, weekday: 'short', hour: '2-digit', hour12: false,
});
const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
/** Weekday (Mon=0) and hour (0-23) in Europe/Sofia. */
export function sofiaParts(iso: string): { weekday: number; hour: number } {
  const parts = partsFmt.formatToParts(new Date(iso));
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hr = parts.find((p) => p.type === 'hour')?.value ?? '0';
  return { weekday: WD[wd] ?? 0, hour: Number(hr) % 24 };
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'току-що';
  if (m < 60) return `преди ${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.round(h / 24);
  return d === 1 ? 'преди 1 ден' : `преди ${d} дни`;
}
