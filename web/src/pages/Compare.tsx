import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, CHART, tooltipStyle } from '../components/chartKit';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { api } from '../data';
import { fmtInt, fmtPct } from '../lib/format';
import { WEEKDAYS } from '../lib/labels';
import { DIMENSION_LABELS, groupBy, heatmap, settled, type Dimension, type Group } from '../lib/stats';
import { useAsync } from '../lib/useAsync';

type MetricKey = 'share_rate' | 'save_rate' | 'engagement_rate' | 'reach';
const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'share_rate', label: 'Споделяния / обхват' },
  { key: 'save_rate', label: 'Запазвания / обхват' },
  { key: 'engagement_rate', label: 'Ангажираност (ER)' },
  { key: 'reach', label: 'Обхват' },
];
const DIMS = Object.keys(DIMENSION_LABELS) as Dimension[];

export default function Compare() {
  const q = useAsync(() => api.getPosts(), []);
  const [dim, setDim] = useState<Dimension>('format');
  const [metric, setMetric] = useState<MetricKey>('share_rate');

  const posts = useMemo(() => settled(q.data ?? []), [q.data]);
  const groups = useMemo(() => groupBy(posts, dim), [posts, dim]);
  const cells = useMemo(() => heatmap(posts), [posts]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const isPct = metric !== 'reach';
  const fmtMetric = (v: number | null | undefined) => (isPct ? fmtPct(v) : fmtInt(v));
  const best = groups.filter((g) => g.count >= 3 && g[metric] != null).sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))[0];
  const chartData = groups.map((g) => ({ name: g.key, value: g[metric] ?? 0, count: g.count }));

  return (
    <div>
      <PageHeader title="Сравнение" sub={`Средни стойности по групи. Включени са ${fmtInt(posts.length)} публикации със задържани данни (над 48 часа).`} />

      <div className="panel space-y-4">
        <div>
          <p className="eyebrow mb-2">Групирай по</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Групиране">
            {DIMS.map((d) => (
              <button key={d} aria-pressed={dim === d} onClick={() => setDim(d)}
                className={`min-h-[36px] rounded-full border px-3 text-sm font-medium transition ${
                  dim === d ? 'border-brand-yellow bg-brand-yellow text-ink' : 'border-cream/20 text-cream-dim hover:text-cream'}`}>
                {DIMENSION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="block max-w-xs">
          <span className="eyebrow mb-1 block">Показател</span>
          <select className="field" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
            {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {groups.length === 0 ? <div className="mt-4"><Empty>Няма достатъчно данни.</Empty></div> : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="panel">
            {best && (
              <p className="mb-3 text-sm text-cream-dim">
                Водеща група: <strong className="text-brand-yellow">{best.key}</strong> със средно {fmtMetric(best[metric])} ({best.count} публикации).
              </p>
            )}
            <div style={{ height: Math.max(220, chartData.length * 38 + 40) }} role="img" aria-label="Стълбовидна графика по групи">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => (isPct ? fmtPct(v) : fmtInt(v))} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={112} interval={0} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(234,228,218,0.06)' }}
                    formatter={(v, _n, item) => [fmtMetric(Number(v)), `${(item.payload as { count: number }).count} публ.`]} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {chartData.map((c) => <Cell key={c.name} fill={best && c.name === best.key ? CHART.yellow : CHART.cream} fillOpacity={best && c.name === best.key ? 1 : 0.55} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <GroupTable groups={groups} />
        </div>
      )}

      <h2 className="panel-title mt-10">Кога да публикуваме</h2>
      <p className="text-sm text-cream-dim">Средни споделяния / обхват по ден и час (часовата зона на София). Светлите клетки са по-добри. Празните нямат публикации.</p>
      <Heatmap cells={cells} />
    </div>
  );
}

function GroupTable({ groups }: { groups: Group[] }) {
  return (
    <div className="panel overflow-x-auto !p-0">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-wider text-cream-dim">
            <th className="p-3 font-semibold">Група</th>
            <th className="p-3 text-right font-semibold">Бр.</th>
            <th className="p-3 text-right font-semibold">Обхват</th>
            <th className="p-3 text-right font-semibold">ER</th>
            <th className="p-3 text-right font-semibold">Запазв.</th>
            <th className="p-3 text-right font-semibold">Спод.</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-cream/5">
              <td className="p-3 font-medium">{g.key}</td>
              <td className="tabular p-3 text-right text-cream-dim">{g.count}</td>
              <td className="tabular p-3 text-right">{fmtInt(g.reach)}</td>
              <td className="tabular p-3 text-right">{fmtPct(g.engagement_rate)}</td>
              <td className="tabular p-3 text-right">{fmtPct(g.save_rate)}</td>
              <td className="tabular p-3 text-right">{fmtPct(g.share_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heatmap({ cells }: { cells: ReturnType<typeof heatmap> }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00
  const map = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const max = Math.max(0.0001, ...cells.map((c) => c.share_rate ?? 0));
  return (
    <div className="panel relative mt-3 overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs" aria-label="Карта по ден и час">
        <thead>
          <tr>
            <th className="w-10" />
            {hours.map((h) => <th key={h} className="tabular min-w-[40px] pb-1 font-medium text-cream-dim">{String(h).padStart(2, '0')}</th>)}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((wd, w) => (
            <tr key={wd}>
              <th className="pr-2 text-left font-medium text-cream-dim">{wd}</th>
              {hours.map((h) => {
                const c = map.get(`${w}-${h}`);
                if (!c) return <td key={h} className="h-10 rounded-md bg-cream/[0.04]" />;
                const t = (c.share_rate ?? 0) / max;
                const bg = `rgba(242,195,20,${0.12 + t * 0.88})`;
                return (
                  <td key={h} className="h-10 rounded-md text-center align-middle" style={{ background: bg, color: t > 0.45 ? '#1A1A14' : '#EAE4DA' }}
                    title={`${wd} ${String(h).padStart(2, '0')}:00, ${c.count} публ., ${fmtPct(c.share_rate)}`}>
                    <span className="tabular font-semibold">{fmtPct(c.share_rate).replace('%', '')}</span>
                    <span className="sr-only"> процента, {c.count} публикации</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-cream-dim">Часове извън 07:00 до 22:59 не са показани.</p>
    </div>
  );
}
