import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, CHART, tooltipStyle } from '../components/chartKit';
import Icon from '../components/Icon';
import Thumb from '../components/Thumb';
import { Delta, ErrorBox, Loading, Segmented } from '../components/ui';
import { api } from '../data';
import { DASH, fmtDateTime, fmtDuration, fmtInt, fmtPct, fmtShortDate } from '../lib/format';
import { formatLabel, HOOKS, hookLabel, METRIC_LABELS, RATE_LABELS, TOPICS, topicLabel, type RateKey } from '../lib/labels';
import { averages, settled } from '../lib/stats';
import { useAsync } from '../lib/useAsync';
import type { HookType, PostMetric, Topic } from '../types/db';
import { FreshBadge } from './Posts';

type GrowthKey = 'reach' | 'views' | 'likes' | 'saved' | 'shares';
const GROWTH: Array<{ value: GrowthKey; label: string }> = [
  { value: 'reach', label: 'Обхват' }, { value: 'views', label: 'Гледания' }, { value: 'likes', label: 'Харесвания' },
  { value: 'saved', label: 'Запазвания' }, { value: 'shares', label: 'Споделяния' },
];

export default function PostDetail() {
  const { id = '' } = useParams();
  const q = useAsync(async () => {
    const [detail, posts] = await Promise.all([api.getPost(id), api.getPosts()]);
    return { detail, posts };
  }, [id]);
  const [metric, setMetric] = useState<GrowthKey>('reach');
  const [topic, setTopic] = useState('');
  const [hook, setHook] = useState('');
  const [notes, setNotes] = useState('');
  const [save, setSave] = useState<{ s: 'idle' | 'saving' | 'saved' | 'error'; msg?: string }>({ s: 'idle' });

  const post = q.data?.detail?.post;
  useEffect(() => {
    if (post) { setTopic(post.topic ?? ''); setHook(post.hook_type ?? ''); setNotes(post.notes ?? ''); setSave({ s: 'idle' }); }
  }, [post]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data?.detail || !post) {
    return (
      <div>
        <BackLink />
        <div className="panel mt-4">Публикацията не е намерена.</div>
      </div>
    );
  }

  const { history } = q.data.detail;
  const avgs = averages(settled(q.data.posts.filter((p) => p.id !== post.id)));
  const dirty = topic !== (post.topic ?? '') || hook !== (post.hook_type ?? '') || notes !== (post.notes ?? '');

  async function onSave() {
    setSave({ s: 'saving' });
    try {
      await api.updatePostTags(id, { topic: (topic || null) as Topic | null, hook_type: (hook || null) as HookType | null, notes: notes.trim() || null });
      setSave({ s: 'saved', msg: 'Запазено' });
      q.reload();
    } catch (e) { setSave({ s: 'error', msg: (e as Error).message }); }
  }

  const metrics = Object.entries(METRIC_LABELS) as Array<[keyof typeof METRIC_LABELS, string]>;
  const series = history.map((h: PostMetric) => ({ day: h.captured_on, value: h[metric] }));

  return (
    <div className="animate-rise">
      <BackLink />
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div>
          <Thumb post={post} className="aspect-square w-full rounded-2xl" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip">{formatLabel(post)}</span>
            <span className="chip">{topicLabel(post.topic)}</span>
            <span className="chip">{hookLabel(post.hook_type)}</span>
            {post.too_fresh && <FreshBadge />}
          </div>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="btn btn-ghost mt-3 w-full">
              Отвори в Instagram <Icon name="external" className="h-4 w-4" />
            </a>
          )}
        </div>
        <div className="min-w-0">
          <p className="eyebrow">{fmtDateTime(post.posted_at)} (София)</p>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{post.caption || 'Без текст'}</p>
          {post.hashtags.length > 0 && (
            <p className="mt-3 text-sm text-brand-yellow">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
          <p className="mt-3 text-xs text-cream-dim">Дължина на текста: {fmtInt(post.caption_length)} знака</p>
          {post.too_fresh && (
            <p className="mt-3 rounded-xl bg-brand-orange/10 p-3 text-sm text-brand-orange">
              Публикацията е на по-малко от 48 часа. Статистиките на Instagram още се обновяват, така че не правете изводи от тях.
            </p>
          )}
        </div>
      </div>

      <h2 className="panel-title mt-10">Показатели</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map(([k, label]) => (
          <div key={k} className="panel !p-3">
            <dt className="text-xs text-cream-dim">{label}</dt>
            <dd className="tabular mt-1 font-display text-2xl font-bold">{fmtInt(post[k])}</dd>
          </div>
        ))}
        {post.avg_watch_time_ms != null && (
          <div className="panel !p-3">
            <dt className="text-xs text-cream-dim">Средно гледане</dt>
            <dd className="tabular mt-1 font-display text-2xl font-bold">{fmtDuration(post.avg_watch_time_ms)}</dd>
          </div>
        )}
      </dl>

      <h2 className="panel-title mt-10">Спрямо средното за профила</h2>
      <p className="text-sm text-cream-dim">Средното е от {fmtInt(avgs.count)} други публикации със задържани данни.</p>
      <div className="panel relative mt-3 overflow-x-auto !p-0">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-wider text-cream-dim">
              <th className="p-3 font-semibold">Показател</th>
              <th className="p-3 text-right font-semibold">Тази</th>
              <th className="p-3 text-right font-semibold">Средно</th>
              <th className="p-3 text-right font-semibold">Разлика</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(RATE_LABELS) as RateKey[]).map((k) => {
              const v = post[k], a = avgs[k];
              const rel = v != null && a ? v / a - 1 : null;
              return (
                <tr key={k} className="border-b border-cream/5">
                  <td className="p-3">{RATE_LABELS[k]}</td>
                  <td className="tabular p-3 text-right font-semibold">{fmtPct(v)}</td>
                  <td className="tabular p-3 text-right text-cream-dim">{fmtPct(a)}</td>
                  <td className="p-3 text-right"><Delta value={rel} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="panel-title">Растеж във времето</h2>
        <div className="max-w-full overflow-x-auto">
          <Segmented<GrowthKey> label="Показател" value={metric} onChange={setMetric}
            options={GROWTH.map((g) => ({ value: g.value, label: g.label }))} />
        </div>
      </div>
      <div className="panel mt-3">
        {series.length < 2 ? (
          <p className="py-8 text-center text-sm text-cream-dim">Още няма достатъчно дневни снимки за графика. Идва със следващите синхронизации.</p>
        ) : (
          <div className="h-64" role="img" aria-label="Графика на растежа на показателя">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={fmtShortDate} minTickGap={40} />
                <YAxis {...axisProps} tickFormatter={fmtInt} width={52} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => fmtShortDate(String(v))}
                  formatter={(v) => [fmtInt(Number(v)), GROWTH.find((g) => g.value === metric)?.label ?? '']} />
                <Line type="monotone" dataKey="value" stroke={CHART.yellow} strokeWidth={2.5} dot={series.length < 12} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <h2 className="panel-title mt-10">Етикети и бележки</h2>
      <div className="panel mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1 block">Тема</span>
          <select className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Без тема</option>
            {TOPICS.map((t) => <option key={t} value={t}>{topicLabel(t)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Hook</span>
          <select className="field" value={hook} onChange={(e) => setHook(e.target.value)}>
            <option value="">Без hook</option>
            {HOOKS.map((h) => <option key={h} value={h}>{hookLabel(h)}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="eyebrow mb-1 block">Бележки</span>
          <textarea className="field min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Какво проработи, какво не, идеи за повторение" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="btn btn-primary" disabled={!dirty || save.s === 'saving'} onClick={onSave}>
            {save.s === 'saving' ? 'Запазване...' : 'Запази'}
          </button>
          {save.s === 'saved' && !dirty && <span className="text-sm text-up" role="status">Запазено</span>}
          {save.s === 'error' && <span className="text-sm text-down" role="alert">{save.msg}</span>}
          {api.demo && <span className="text-xs text-cream-dim">В демо режим промените се пазят само докато страницата е отворена.</span>}
        </div>
      </div>
      <p className="mt-6 text-xs text-cream-dim">Последно обновяване на данните: {history.length ? fmtDateTime(history[history.length - 1].captured_at) : DASH}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/posts" className="inline-flex items-center gap-1 text-sm text-cream-dim hover:text-brand-yellow">
      <Icon name="back" className="h-4 w-4" /> Всички публикации
    </Link>
  );
}
