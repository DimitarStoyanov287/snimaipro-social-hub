import type { PostLatest } from '../types/db';
import { sofiaParts } from './format';
import { formatLabel, hookLabel, topicLabel, WEEKDAYS_LONG } from './labels';

export const avg = (xs: Array<number | null | undefined>): number | null => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Posts whose numbers have settled (older than 48h and with reach). */
export const settled = (posts: PostLatest[]) => posts.filter((p) => !p.too_fresh && (p.reach ?? 0) > 0);

export interface Averages {
  reach: number | null;
  views: number | null;
  engagement_rate: number | null;
  save_rate: number | null;
  share_rate: number | null;
  comment_rate: number | null;
  follow_rate: number | null;
  count: number;
}

export function averages(posts: PostLatest[]): Averages {
  return {
    reach: avg(posts.map((p) => p.reach)),
    views: avg(posts.map((p) => p.views)),
    engagement_rate: avg(posts.map((p) => p.engagement_rate)),
    save_rate: avg(posts.map((p) => p.save_rate)),
    share_rate: avg(posts.map((p) => p.share_rate)),
    comment_rate: avg(posts.map((p) => p.comment_rate)),
    follow_rate: avg(posts.map((p) => p.follow_rate)),
    count: posts.length,
  };
}

export type Dimension = 'format' | 'topic' | 'hook' | 'weekday' | 'hour' | 'length';

export const DIMENSION_LABELS: Record<Dimension, string> = {
  format: 'Формат',
  topic: 'Тема',
  hook: 'Hook',
  weekday: 'Ден от седмицата',
  hour: 'Час на публикуване',
  length: 'Дължина на текста',
};

export function lengthBucket(n: number): { key: string; order: number } {
  if (n < 100) return { key: 'до 100 знака', order: 0 };
  if (n < 250) return { key: '100 до 249', order: 1 };
  if (n < 500) return { key: '250 до 499', order: 2 };
  return { key: '500 и повече', order: 3 };
}

export function groupKey(p: PostLatest, d: Dimension): { key: string; order: number } {
  switch (d) {
    case 'format': return { key: formatLabel(p), order: 0 };
    case 'topic': return { key: topicLabel(p.topic), order: 0 };
    case 'hook': return { key: hookLabel(p.hook_type), order: 0 };
    case 'weekday': {
      const w = sofiaParts(p.posted_at).weekday;
      return { key: WEEKDAYS_LONG[w], order: w };
    }
    case 'hour': {
      const h = sofiaParts(p.posted_at).hour;
      return { key: `${String(h).padStart(2, '0')}:00`, order: h };
    }
    case 'length': return lengthBucket(p.caption_length);
  }
}

export interface Group extends Averages { key: string; order: number }

export function groupBy(posts: PostLatest[], d: Dimension): Group[] {
  const map = new Map<string, { order: number; items: PostLatest[] }>();
  for (const p of posts) {
    const { key, order } = groupKey(p, d);
    const e = map.get(key) ?? { order, items: [] };
    e.items.push(p);
    map.set(key, e);
  }
  const out: Group[] = [...map.entries()].map(([key, e]) => ({ key, order: e.order, ...averages(e.items) }));
  const ordered = d === 'weekday' || d === 'hour' || d === 'length';
  return out.sort((a, b) => (ordered ? a.order - b.order : b.count - a.count));
}

export interface HeatCell { weekday: number; hour: number; count: number; share_rate: number | null }

export function heatmap(posts: PostLatest[]): HeatCell[] {
  const map = new Map<string, PostLatest[]>();
  for (const p of posts) {
    const { weekday, hour } = sofiaParts(p.posted_at);
    const k = `${weekday}-${hour}`;
    map.set(k, [...(map.get(k) ?? []), p]);
  }
  return [...map.entries()].map(([k, items]) => {
    const [weekday, hour] = k.split('-').map(Number);
    return { weekday, hour, count: items.length, share_rate: avg(items.map((i) => i.share_rate)) };
  });
}
