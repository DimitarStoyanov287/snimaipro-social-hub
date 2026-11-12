import type { ReactNode } from 'react';
import { fmtSignedPct } from '../lib/format';
import Icon from './Icon';

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-cream-dim">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Loading({ label = 'Зареждане' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-cream-dim" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-yellow border-t-transparent" />
      {label}...
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel border-brand-red/50" role="alert">
      <p className="font-semibold text-down">Нещо се обърка</p>
      <p className="mt-1 text-sm text-cream-dim">{message}</p>
      {onRetry && <button className="btn btn-ghost mt-3" onClick={onRetry}>Опитай пак</button>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="panel py-10 text-center text-cream-dim">{children}</div>;
}

/** Cream KPI tile, signature surface. */
export function Kpi({
  label, value, sub, delta, deltaLabel, delay = 0,
}: { label: string; value: string; sub?: string; delta?: number | null; deltaLabel?: string; delay?: number }) {
  return (
    <div
      className="animate-rise rounded-2xl bg-cream p-4 text-ink sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/70">{label}</p>
      <p className="tabular mt-2 font-display text-3xl font-bold leading-none sm:text-4xl">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink/75">
        {delta != null && <Delta value={delta} onLight />}
        {(deltaLabel || sub) && <span>{deltaLabel ?? sub}</span>}
      </div>
    </div>
  );
}

/** Up/down indicator. value is a relative change (0.12 = +12%). Color is never the only signal. */
export function Delta({ value, onLight = false, abs }: { value: number | null; onLight?: boolean; abs?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-cream-mute">{'–'}</span>;
  const up = value >= 0;
  const color = onLight ? (up ? 'text-[#1d6b4f]' : 'text-[#a8312f]') : up ? 'text-up' : 'text-down';
  return (
    <span className={`tabular inline-flex items-center gap-0.5 font-semibold ${color}`}>
      <Icon name={up ? 'up' : 'down'} className="h-3 w-3" />
      {abs ?? fmtSignedPct(value)}
      <span className="sr-only">{up ? ' над' : ' под'} средното</span>
    </span>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode; aria?: string }>; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-cream/15 p-0.5">
      {options.map((o) => (
        <button
          key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.aria}
          onClick={() => onChange(o.value)}
          className={`min-h-[34px] rounded-full px-3 text-sm font-medium transition ${
            value === o.value ? 'bg-brand-yellow text-ink' : 'text-cream-dim hover:text-cream'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
