import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, CHART, tooltipStyle } from '../components/chartKit';
import Thumb from '../components/Thumb';
import { ErrorBox, Kpi, Loading, PageHeader, Segmented } from '../components/ui';
import { api } from '../data';
import { fmtCompact, fmtDateTime, fmtInt, fmtPct, fmtShortDate, fmtSigned, relativeTime } from '../lib/format';
import { formatLabel, topicLabel } from '../lib/labels';
import { averages, settled } from '../lib/stats';
import { useAsync } from '../lib/useAsync';
import type { PostLatest } from '../types/db';

type Range = '30' | '90' | '180';

export default function Overview() {
  const q = useAsync(async () => {
    const [posts, daily, snaps, runs] = await Promise.all([
      api.getPosts(), api.getAccountDaily(), api.getSnapshots(), api.getIngestRuns(),
    ]);
    return { posts, daily, snaps, runs };
  }, []);
  const [range, setRange] = useState<Range>('90');

  const d = q.data;
  const calc = useMemo(() => {
    if (!d) return null;
    const daily = d.daily;
    const last30 = daily.slice(-30);
    const prev30 = daily.slice(-60, -30);
    const sum = (rows: typeof daily, k: 'reach' | 'total_interactions') => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
    const reach30 = sum(last30, 'reach'), reachPrev = sum(prev30, 'reach');
    const int30 = sum(last30, 'total_interactions'), intPrev = sum(prev30, 'total_interactions');
    const snaps = d.snaps;
    const latest = snaps[snaps.length - 1];
    const ago = snaps[Math.max(0, snaps.length - 31)];
    const gain = latest && ago ? (latest.followers_count ?? 0) - (ago.followers_count ?? 0) : null;
    const cutoff = Date.now() - 90 * 86400000;
    const recent = settled(d.posts).filter((p) => new Date(p.posted_at).getTime() >= cutoff);
    const avgs = averages(recent.length ? recent : settled(d.posts));
    const ranked = settled(d.posts).filter((p) => p.share_rate != null).sort((a, b) => (b.share_rate ?? 0) - (a.share_rate ?? 0));
    return {
      reach30, int30, followers: latest?.followers_count ?? null, gain, avgs,
      reachDelta: reachPrev ? reach30 / reachPrev - 1 : null,
      intDelta: intPrev ? int30 / intPrev - 1 : null,
      top: ranked.slice(0, 5), bottom: ranked.slice(-5).reverse(),
    };
  }, [d]);

  if (q.loading) return <Loading />;
  if (q.error || !d || !calc) return <ErrorBox message={q.error ?? 'Няма данни'} onRetry={q.reload} />;

  const n = Number(range);
  const reachSeries = d.daily.slice(-n).map((r) => ({ day: r.day, reach: r.reach }));
  const followerSeries = d.snaps.slice(-n).map((r) => ({ day: r.captured_on, followers: r.followers_count }));
  const run = d.runs[0];

  return (
    <div>
      <PageHeader title="Преглед" sub="Как върви Instagram профилът на snimai.pro в последните 30 дни." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Ключови показатели">
        <Kpi label="Последователи" value={fmtInt(calc.followers)} sub={`${fmtSigned(calc.gain)} за 30 дни`} delay={0} />
        <Kpi label="Обхват, 30 дни" value={fmtCompact(calc.reach30)} delta={calc.reachDelta} deltaLabel="спрямо предишните 30" delay={60} />
        <Kpi label="Взаимодействия, 30 дни" value={fmtCompact(calc.int30)} delta={calc.intDelta} deltaLabel="спрямо предишните 30" delay={120} />
        <Kpi label="Средна ангажираност" value={fmtPct(calc.avgs.engagement_rate)} sub="публикации, последни 90 дни" delay={180} />
        <Kpi label="Запазвания / обхват" value={fmtPct(calc.avgs.save_rate)} sub="средно за публикация" delay={240} />
        <Kpi label="Споделяния / обхват" value={fmtPct(calc.avgs.share_rate)} sub="средно за публикация" delay={300} />
      </section>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="panel-title">Тенденции</h2>
        <Segmented<Range> label="Период" value={range} onChange={setRange}
          options={[{ value: '30', label: '30 дни' }, { value: '90', label: '90 дни' }, { value: '180', label: '180 дни' }]} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel">
          <p className="eyebrow">Дневен обхват</p>
          <div className="mt-3 h-64" role="img" aria-label="Графика на дневния обхват">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reachSeries} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={CHART.yellow} stopOpacity={0.45} />
                    <stop offset="1" stopColor={CHART.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={fmtShortDate} minTickGap={40} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={52} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => fmtShortDate(String(v))} formatter={(v) => [fmtInt(Number(v)), 'Обхват']} />
                <Area type="monotone" dataKey="reach" stroke={CHART.yellow} strokeWidth={2} fill="url(#reachFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <p className="eyebrow">Последователи</p>
          <div className="mt-3 h-64" role="img" aria-label="Графика на последователите">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followerSeries} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={fmtShortDate} minTickGap={40} />
                <YAxis {...axisProps} domain={['dataMin - 20', 'dataMax + 20']} tickFormatter={fmtInt} width={52} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => fmtShortDate(String(v))} formatter={(v) => [fmtInt(Number(v)), 'Последователи']} />
                <Line type="monotone" dataKey="followers" stroke={CHART.green} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PostList title="Най-добри по споделяния" sub="Публикации със задържани данни (над 48 часа)" posts={calc.top} />
        <PostList title="Най-слаби по споделяния" sub="Какво да не повтаряме така" posts={calc.bottom} />
      </div>

      <div className="panel mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Последна синхронизация</p>
          {run ? (
            <p className="mt-1 text-sm">
              <StatusDot status={run.status} /> {fmtDateTime(run.started_at)} ({relativeTime(run.started_at)}),{' '}
              {fmtInt(run.posts_synced)} публикации
            </p>
          ) : <p className="mt-1 text-sm text-cream-dim">Още няма синхронизация.</p>}
        </div>
        <Link to="/sync" className="btn btn-ghost">Детайли</Link>
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ok: ['bg-up', 'Успешна'], error: ['bg-down', 'Грешка'], running: ['bg-brand-yellow animate-pulse', 'В ход'],
  };
  const [c, l] = map[status] ?? ['bg-cream-mute', status];
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className={`h-2 w-2 rounded-full ${c}`} aria-hidden="true" /> {l}
    </span>
  );
}

function PostList({ title, sub, posts }: { title: string; sub: string; posts: PostLatest[] }) {
  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <p className="mb-3 text-sm text-cream-dim">{sub}</p>
      <ol className="divide-y divide-cream/10">
        {posts.map((p, i) => (
          <li key={p.id}>
            <Link to={`/posts/${p.id}`} className="flex items-center gap-3 py-2.5 transition hover:bg-cream/5">
              <span className="w-5 text-center font-display text-lg text-brand-yellow">{i + 1}</span>
              <Thumb post={p} className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.caption.split('\n')[0]}</p>
                <p className="text-xs text-cream-dim">{formatLabel(p)} · {topicLabel(p.topic)} · {fmtShortDate(p.posted_at)}</p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-semibold">{fmtPct(p.share_rate)}</p>
                <p className="tabular text-xs text-cream-dim">{fmtCompact(p.reach)} обхват</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
