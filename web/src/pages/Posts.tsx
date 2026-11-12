import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Thumb from '../components/Thumb';
import { Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui';
import { api } from '../data';
import { fmtInt, fmtPct, fmtShortDate } from '../lib/format';
import { formatLabel, formatOf, HOOKS, hookLabel, TOPICS, topicLabel } from '../lib/labels';
import { useAsync } from '../lib/useAsync';
import type { PostLatest } from '../types/db';

type SortKey = 'posted_at' | 'reach' | 'views' | 'engagement_rate' | 'save_rate' | 'share_rate';
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'posted_at', label: 'Дата' },
  { key: 'reach', label: 'Обхват' },
  { key: 'views', label: 'Гледания' },
  { key: 'engagement_rate', label: 'ER' },
  { key: 'save_rate', label: 'Запазвания' },
  { key: 'share_rate', label: 'Споделяния' },
];

export function FreshBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-brand-orange/20 px-2 py-0.5 text-[11px] font-semibold text-brand-orange ring-1 ring-brand-orange/40"
      title="Публикацията е на по-малко от 48 часа. Данните още се изменят."
    >
      <Icon name="clock" className="h-3 w-3" /> Още събира данни
    </span>
  );
}

export default function Posts() {
  const q = useAsync(() => api.getPosts(), []);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [sort, setSort] = useState<SortKey>('posted_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [fmt, setFmt] = useState('all');
  const [topic, setTopic] = useState('all');
  const [hook, setHook] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    const f = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const t = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    const out = all.filter((p) => {
      if (fmt !== 'all' && formatOf(p) !== fmt) return false;
      if (topic !== 'all' && (topic === 'none' ? p.topic : p.topic !== topic)) return false;
      if (hook !== 'all' && (hook === 'none' ? p.hook_type : p.hook_type !== hook)) return false;
      const ms = new Date(p.posted_at).getTime();
      if (ms < f || ms > t) return false;
      if (s && !p.caption.toLowerCase().includes(s)) return false;
      return true;
    });
    const m = dir === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      if (sort === 'posted_at') return m * a.posted_at.localeCompare(b.posted_at);
      const av = a[sort] ?? -Infinity, bv = b[sort] ?? -Infinity;
      return m * (av - bv);
    });
    return out;
  }, [q.data, fmt, topic, hook, from, to, search, sort, dir]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const clickSort = (k: SortKey) => {
    if (k === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('desc'); }
  };
  const hasFilters = fmt !== 'all' || topic !== 'all' || hook !== 'all' || from || to || search;
  const reset = () => { setFmt('all'); setTopic('all'); setHook('all'); setFrom(''); setTo(''); setSearch(''); };

  return (
    <div>
      <PageHeader
        title="Публикации"
        sub={`${fmtInt(rows.length)} от ${fmtInt(q.data?.length ?? 0)} публикации`}
        right={
          <Segmented<'grid' | 'table'> label="Изглед" value={view} onChange={setView}
            options={[
              { value: 'grid', label: <Icon name="grid" className="h-4 w-4" />, aria: 'Мрежа' },
              { value: 'table', label: <Icon name="table" className="h-4 w-4" />, aria: 'Таблица' },
            ]} />
        }
      />

      <div className="panel mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-4">
          <span className="sr-only">Търсене в текста</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-dim" />
          <input className="field pl-9" type="search" placeholder="Търси в текста на публикацията" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Select label="Формат" value={fmt} onChange={setFmt}
          options={[['all', 'Всички формати'], ['REELS', 'Reels'], ['CAROUSEL', 'Карусел'], ['IMAGE', 'Снимка'], ['VIDEO', 'Видео'], ['STORY', 'Story']]} />
        <Select label="Тема" value={topic} onChange={setTopic}
          options={[['all', 'Всички теми'], ...TOPICS.map((t) => [t, topicLabel(t)] as [string, string]), ['none', 'Без тема']]} />
        <Select label="Hook" value={hook} onChange={setHook}
          options={[['all', 'Всички hook-ове'], ...HOOKS.map((h) => [h, hookLabel(h)] as [string, string]), ['none', 'Без hook']]} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="eyebrow mb-1 block">От</span>
            <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="block"><span className="eyebrow mb-1 block">До</span>
            <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {view === 'grid' && (
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Select label="Подреди по" value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS.map((s) => [s.key, s.label])} />
            <button className="btn btn-ghost" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')} aria-label="Посока на подреждане">
              {dir === 'desc' ? 'Низходящо' : 'Възходящо'}
            </button>
            {hasFilters && <button className="btn btn-ghost" onClick={reset}>Изчисти</button>}
          </div>
        )}
        {view === 'table' && hasFilters && (
          <div className="sm:col-span-2 lg:col-span-4"><button className="btn btn-ghost" onClick={reset}>Изчисти филтрите</button></div>
        )}
      </div>

      {rows.length === 0 ? <Empty>Няма публикации с тези филтри.</Empty> : view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((p) => <GridCard key={p.id} p={p} />)}
        </ul>
      ) : (
        <div className="panel overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-cream/10 text-xs uppercase tracking-wider text-cream-dim">
                <th className="p-3 font-semibold">Публикация</th>
                <Th k="posted_at" label="Дата" {...{ sort, dir, clickSort }} />
                <th className="p-3 font-semibold">Тип</th>
                <th className="p-3 font-semibold">Тема</th>
                <th className="p-3 font-semibold">Hook</th>
                <Th k="reach" label="Обхват" {...{ sort, dir, clickSort }} right />
                <Th k="views" label="Гледания" {...{ sort, dir, clickSort }} right />
                <Th k="engagement_rate" label="ER" {...{ sort, dir, clickSort }} right />
                <Th k="save_rate" label="Запазв." {...{ sort, dir, clickSort }} right />
                <Th k="share_rate" label="Споделяне" {...{ sort, dir, clickSort }} right />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-cream/5 hover:bg-cream/5">
                  <td className="p-3">
                    <Link to={`/posts/${p.id}`} className="flex items-center gap-3">
                      <Thumb post={p} className="h-11 w-11 shrink-0 rounded-lg" />
                      <span className="max-w-[240px]">
                        <span className="block truncate font-medium hover:text-brand-yellow">{p.caption.split('\n')[0]}</span>
                        {p.too_fresh && <FreshBadge />}
                      </span>
                    </Link>
                  </td>
                  <td className="tabular whitespace-nowrap p-3 text-cream-dim">{fmtShortDate(p.posted_at)}</td>
                  <td className="p-3">{formatLabel(p)}</td>
                  <td className="p-3 text-cream-dim">{topicLabel(p.topic)}</td>
                  <td className="p-3 text-cream-dim">{hookLabel(p.hook_type)}</td>
                  <td className="tabular p-3 text-right">{fmtInt(p.reach)}</td>
                  <td className="tabular p-3 text-right">{fmtInt(p.views)}</td>
                  <td className="tabular p-3 text-right">{fmtPct(p.engagement_rate)}</td>
                  <td className="tabular p-3 text-right">{fmtPct(p.save_rate)}</td>
                  <td className="tabular p-3 text-right">{fmtPct(p.share_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ k, label, sort, dir, clickSort, right }: {
  k: SortKey; label: string; sort: SortKey; dir: 'asc' | 'desc'; clickSort: (k: SortKey) => void; right?: boolean;
}) {
  const active = sort === k;
  return (
    <th className={`p-3 font-semibold ${right ? 'text-right' : ''}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => clickSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider ${active ? 'text-brand-yellow' : 'hover:text-cream'}`}>
        {label}
        {active && <Icon name={dir === 'asc' ? 'up' : 'down'} className="h-3 w-3" />}
      </button>
    </th>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="eyebrow mb-1 block">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function GridCard({ p }: { p: PostLatest }) {
  return (
    <li className="group overflow-hidden rounded-2xl border border-cream/10 bg-ink-700/80 transition hover:-translate-y-0.5 hover:border-brand-yellow/60">
      <Link to={`/posts/${p.id}`} className="block">
        <Thumb post={p} className="aspect-square w-full" />
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-cream-dim">
            <span className="tabular">{fmtShortDate(p.posted_at)}</span>
            <span aria-hidden="true">·</span>
            <span>{topicLabel(p.topic)}</span>
          </div>
          {p.too_fresh && <FreshBadge />}
          <p className="line-clamp-2 text-sm font-medium">{p.caption.split('\n')[0]}</p>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            <Stat l="Обхват" v={fmtInt(p.reach)} />
            <Stat l="ER" v={fmtPct(p.engagement_rate)} />
            <Stat l="Запазв." v={fmtPct(p.save_rate)} />
            <Stat l="Спод." v={fmtPct(p.share_rate)} />
          </dl>
        </div>
      </Link>
    </li>
  );
}
const Stat = ({ l, v }: { l: string; v: string }) => (
  <div className="flex justify-between gap-1"><dt className="text-cream-dim">{l}</dt><dd className="tabular font-semibold">{v}</dd></div>
);
