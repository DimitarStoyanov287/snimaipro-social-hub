import { redact } from './redact.js';
import { ACCOUNT_METRICS, mediaMetricsFor, parseInsights, type InsightValues } from './metrics.js';

export type FetchFn = typeof fetch;
export type SleepFn = (ms: number) => Promise<void>;

export const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url';

const MAX_RETRIES = 3;
const BACKOFF_MS = 500;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const AUTH_CODES = new Set([102, 190]);

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
  media_url?: string;
}

export interface IgProfile {
  username?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export class IgApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) {
    super(message);
    this.name = 'IgApiError';
  }
  get isAuth(): boolean {
    return this.status === 401 || (this.code !== undefined && AUTH_CODES.has(this.code));
  }
  get isRateLimit(): boolean {
    return this.status === 429 || (this.code !== undefined && RATE_LIMIT_CODES.has(this.code));
  }
}

const defaultSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET json with retry on 5xx, 429 and network errors (max 3 retries, exponential backoff). */
export async function httpJson(
  url: string,
  opts: { fetchFn?: FetchFn; sleep?: SleepFn; secrets?: string[] } = {},
): Promise<unknown> {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url);
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS * 2 ** attempt);
        continue;
      }
      throw new Error(`Network error: ${redact(e instanceof Error ? e.message : String(e), opts.secrets)}`);
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (res.ok) return body;

    const err = (body as { error?: { message?: string; code?: number } } | null)?.error;
    const apiError = new IgApiError(
      redact(`Instagram API ${res.status}${err?.code ? ` (code ${err.code})` : ''}: ${err?.message ?? text.slice(0, 200)}`, opts.secrets),
      res.status,
      err?.code,
    );
    if ((res.status >= 500 || apiError.isRateLimit) && attempt < MAX_RETRIES) {
      await sleep(BACKOFF_MS * 2 ** attempt);
      continue;
    }
    throw apiError;
  }
}

export async function refreshAccessToken(
  token: string,
  opts: { fetchFn?: FetchFn; sleep?: SleepFn } = {},
): Promise<string> {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const body = (await httpJson(url, { ...opts, secrets: [token] })) as { access_token?: string } | null;
  if (!body?.access_token) throw new Error('Token refresh returned no access_token');
  return body.access_token;
}

export interface IgClientOptions {
  token: string;
  version?: string;
  fetchFn?: FetchFn;
  sleep?: SleepFn;
}

export class IgClient {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchFn?: FetchFn;
  private readonly sleep?: SleepFn;
  /** Metrics Instagram rejected, remembered per product type (or 'ACCOUNT'). */
  readonly rejected = new Map<string, Set<string>>();

  constructor(o: IgClientOptions) {
    this.token = o.token;
    this.base = `https://graph.instagram.com/${o.version ?? 'v25.0'}/`;
    this.fetchFn = o.fetchFn;
    this.sleep = o.sleep;
  }

  private get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), access_token: this.token });
    return this.fetchUrl(`${this.base}${path}?${qs}`);
  }

  private fetchUrl(url: string): Promise<unknown> {
    return httpJson(url, { fetchFn: this.fetchFn, sleep: this.sleep, secrets: [this.token] });
  }

  async getProfile(): Promise<IgProfile> {
    return (await this.get('me', { fields: 'username,followers_count,follows_count,media_count' })) as IgProfile;
  }

  /** Media newest first. With `since`, stops paging once posts are older than that instant. */
  async listMedia(since?: Date): Promise<IgMedia[]> {
    const out: IgMedia[] = [];
    let next: string | null = null;
    let page = (await this.get('me/media', { fields: MEDIA_FIELDS, limit: 50 })) as MediaPage;
    for (;;) {
      let reachedOld = false;
      for (const m of page.data ?? []) {
        if (since && new Date(m.timestamp) < since) reachedOld = true;
        else out.push(m);
      }
      next = page.paging?.next ?? null;
      if (!next || reachedOld) return out;
      page = (await this.fetchUrl(next)) as MediaPage;
    }
  }

  getMediaInsights(id: string, productType: string): Promise<InsightValues> {
    return this.insightsWithFallback(`${id}/insights`, productType, mediaMetricsFor(productType), {});
  }

  /** Account totals for [since, until] (unix seconds, one day at a time). */
  getAccountTotals(since: number, until: number): Promise<InsightValues> {
    return this.insightsWithFallback('me/insights', 'ACCOUNT', ACCOUNT_METRICS, {
      period: 'day',
      metric_type: 'total_value',
      since,
      until,
    });
  }

  /** Net follower change per day, keyed by the API end_time of each day. */
  async getFollowerSeries(since: number, until: number): Promise<{ endTime: string; value: number }[]> {
    const body = (await this.get('me/insights', { metric: 'follower_count', period: 'day', since, until })) as {
      data?: { values?: { value?: number; end_time?: string }[] }[];
    };
    const values = body.data?.[0]?.values ?? [];
    return values.flatMap((v) =>
      typeof v.value === 'number' && v.end_time ? [{ endTime: v.end_time, value: v.value }] : [],
    );
  }

  /**
   * Request all non-rejected metrics at once. If Instagram refuses, retry one by one.
   * A metric is remembered as rejected only if some other metric succeeded for the same
   * request, so a post-specific failure (e.g. no insights available) does not poison the rest.
   */
  private async insightsWithFallback(
    path: string,
    memoryKey: string,
    metrics: string[],
    extra: Record<string, string | number>,
  ): Promise<InsightValues> {
    const rejected = this.rejected.get(memoryKey) ?? new Set<string>();
    this.rejected.set(memoryKey, rejected);
    const wanted = metrics.filter((m) => !rejected.has(m));
    if (wanted.length === 0) return {};

    try {
      return parseInsights(await this.get(path, { ...extra, metric: wanted.join(',') }));
    } catch (e) {
      if (!isMetricError(e)) throw e;
    }

    const out: InsightValues = {};
    const failed: string[] = [];
    for (const metric of wanted) {
      try {
        Object.assign(out, parseInsights(await this.get(path, { ...extra, metric })));
      } catch (e) {
        if (!isMetricError(e)) throw e;
        failed.push(metric);
      }
    }
    if (Object.keys(out).length > 0) failed.forEach((m) => rejected.add(m));
    return out;
  }
}

interface MediaPage {
  data?: IgMedia[];
  paging?: { next?: string };
}

/** A 400 that is not an auth or rate-limit problem means "this metric is not available". */
function isMetricError(e: unknown): boolean {
  return e instanceof IgApiError && e.status === 400 && !e.isAuth && !e.isRateLimit;
}
