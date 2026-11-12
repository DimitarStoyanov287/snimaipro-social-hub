export type ProductType = 'FEED' | 'REELS' | 'STORY' | string;

export const MEDIA_METRICS: Record<string, string[]> = {
  REELS: [
    'reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions',
    'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time',
  ],
  FEED: [
    'reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions',
    'profile_visits', 'follows',
  ],
  STORY: ['reach', 'views', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits'],
};

export function mediaMetricsFor(productType: ProductType): string[] {
  return MEDIA_METRICS[productType] ?? MEDIA_METRICS.FEED!;
}

export const ACCOUNT_METRICS = [
  'reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares',
  'profile_links_taps',
];

export type InsightValues = Record<string, number>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: number | undefined): number | null => (v === undefined ? null : Math.round(v));

/** Map Instagram insight names to post_metrics columns. Unknown names stay only in raw. */
export function toPostMetricColumns(v: InsightValues) {
  return {
    reach: int(v.reach),
    views: int(v.views),
    likes: int(v.likes),
    comments: int(v.comments),
    saved: int(v.saved),
    shares: int(v.shares),
    total_interactions: int(v.total_interactions),
    follows: int(v.follows),
    profile_visits: int(v.profile_visits),
    replies: int(v.replies),
    avg_watch_time_ms: int(v.ig_reels_avg_watch_time),
    total_watch_time_ms: int(v.ig_reels_video_view_total_time),
  };
}

/** Map account insight names to account_daily columns. */
export function toAccountDailyColumns(v: InsightValues, followerGain: number | null) {
  return {
    reach: int(v.reach),
    views: int(v.views),
    accounts_engaged: int(v.accounts_engaged),
    total_interactions: int(v.total_interactions),
    likes: int(v.likes),
    comments: int(v.comments),
    saves: int(v.saves),
    shares: int(v.shares),
    profile_links_taps: int(v.profile_links_taps),
    follower_gain: followerGain,
  };
}

interface InsightItem {
  name?: string;
  values?: { value?: unknown }[];
  total_value?: { value?: unknown };
}

/** Tolerant parser for both `values[0].value` and `total_value.value` shapes. */
export function parseInsights(body: unknown): InsightValues {
  const out: InsightValues = {};
  const data = (body as { data?: InsightItem[] } | null)?.data;
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    if (!item?.name) continue;
    const v = num(item.values?.[0]?.value) ?? num(item.total_value?.value);
    if (v !== null) out[item.name] = v;
  }
  return out;
}
