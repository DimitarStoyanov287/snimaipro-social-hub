import { describe, expect, it, vi } from 'vitest';
import { IgClient, httpJson, IgApiError } from '../src/instagram.js';
import { parseInsights } from '../src/metrics.js';
import { apiError, jsonResponse } from './fakeDb.js';

const TOKEN = 'IGAAtesttokentesttokentesttokentesttoken123456';
const noSleep = async () => {};

function insight(name: string, value: number) {
  return { name, period: 'lifetime', values: [{ value }] };
}

function client(fetchFn: any) {
  return new IgClient({ token: TOKEN, fetchFn, sleep: noSleep });
}

describe('parseInsights', () => {
  it('reads values[0].value and total_value.value, ignores non-numbers', () => {
    const out = parseInsights({
      data: [insight('reach', 10), { name: 'likes', total_value: { value: 4 } }, { name: 'x', total_value: { breakdowns: [] } }],
    });
    expect(out).toEqual({ reach: 10, likes: 4 });
  });
  it('tolerates garbage', () => {
    expect(parseInsights(null)).toEqual({});
    expect(parseInsights({ data: 'nope' })).toEqual({});
  });
});

describe('metric fallback', () => {
  it('retries one by one and remembers rejected metrics per product type', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      const metric = new URL(url).searchParams.get('metric')!;
      calls.push(metric);
      if (metric.includes(',')) return apiError('metric not supported');
      if (metric === 'profile_visits') return apiError('not supported for this media');
      return jsonResponse({ data: [insight(metric, 1)] });
    });
    const ig = client(fetchFn);

    const first = await ig.getMediaInsights('1', 'FEED');
    expect(first).not.toHaveProperty('profile_visits');
    expect(first.reach).toBe(1);
    expect(ig.rejected.get('FEED')).toEqual(new Set(['profile_visits']));

    calls.length = 0;
    await ig.getMediaInsights('2', 'FEED');
    // combined request no longer asks for the rejected metric
    expect(calls[0]).not.toContain('profile_visits');
    expect(calls[0]!.split(',').length).toBe(8);

    // other product types are not affected
    calls.length = 0;
    await ig.getMediaInsights('3', 'REELS');
    expect(calls[0]).toContain('ig_reels_avg_watch_time');
  });

  it('does not remember rejections when every metric fails (post-specific problem)', async () => {
    const ig = client(vi.fn(async () => apiError('no insights for this media')));
    expect(await ig.getMediaInsights('1', 'FEED')).toEqual({});
    expect(ig.rejected.get('FEED')?.size).toBe(0);
  });

  it('rethrows auth errors instead of falling back', async () => {
    const ig = client(vi.fn(async () => apiError('Invalid OAuth access token', 190, 400)));
    await expect(ig.getMediaInsights('1', 'FEED')).rejects.toBeInstanceOf(IgApiError);
  });
});

describe('http retry and masking', () => {
  it('retries 5xx and 429 up to 3 times then succeeds', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn(async (_ms: number) => {});
    expect(await httpJson('https://x', { fetchFn, sleep })).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000]);
  });

  it('gives up after 3 retries', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, 500));
    await expect(httpJson('https://x', { fetchFn, sleep: noSleep })).rejects.toThrow(/500/);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('does not retry plain 4xx', async () => {
    const fetchFn = vi.fn(async () => apiError('bad', 100, 400));
    await expect(httpJson('https://x', { fetchFn, sleep: noSleep })).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('never leaks the token in errors', async () => {
    const fetchFn = vi.fn(async () => apiError(`Bad token ${TOKEN} access_token=${TOKEN}`, 100, 400));
    const err = await client(fetchFn).getProfile().catch((e) => e as Error);
    expect((err as Error).message).not.toContain(TOKEN);
  });

  it('masks the token in network errors', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`connect failed https://graph.instagram.com/me?access_token=${TOKEN}`);
    });
    const err = await httpJson('https://x', { fetchFn, sleep: noSleep, secrets: [TOKEN] }).catch((e) => e as Error);
    expect((err as Error).message).not.toContain(TOKEN);
  });
});

describe('listMedia paging', () => {
  it('follows paging.next and stops at the since cutoff', async () => {
    const page1 = { data: [{ id: 'a', media_type: 'IMAGE', timestamp: '2026-11-01T10:00:00+0000' }], paging: { next: 'https://graph.instagram.com/next2' } };
    const page2 = {
      data: [
        { id: 'b', media_type: 'IMAGE', timestamp: '2026-10-20T10:00:00+0000' },
        { id: 'c', media_type: 'IMAGE', timestamp: '2026-01-01T10:00:00+0000' },
      ],
      paging: { next: 'https://graph.instagram.com/next3' },
    };
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    const media = await client(fetchFn).listMedia(new Date('2026-09-15T00:00:00Z'));
    expect(media.map((m) => m.id)).toEqual(['a', 'b']);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
