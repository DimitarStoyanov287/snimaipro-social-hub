import type {
  AccountDaily, AccountSnapshot, HookType, IngestRun, PostLatest, PostMetric, PostTagPatch, Topic,
} from '../types/db';
import type { DataApi, PostDetail } from './types';

// ---------- deterministic PRNG so demo data is stable between reloads ----------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260612);
const between = (a: number, b: number) => a + (b - a) * rnd();
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
function weighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1][0];
}
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const DAY = 86400000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ---------- caption templates (Bulgarian, no em dashes) ----------
const GEAR = [
  'Sony FX3', 'Canon R5', 'Sony A7 IV', 'Blackmagic Pocket 6K', 'Sigma 24-70 f/2.8', 'Sigma 35mm f/1.4',
  'DJI RS 3 Pro', 'Aputure 300d', 'Godox комплект светлини', 'Sennheiser микрофон', 'Atomos монитор', 'Tilta рамка',
];

interface Tpl { topic: Topic; hook: HookType; text: string }
const TPLS: Tpl[] = [
  { topic: 'gear_spotlight', hook: 'price_compare', text: 'Купуваш {gear} за един проект или го наемаш? Наемът за ден излиза под 3% от цената на покупката. Сметката е лесна, а техниката е в ръцете ти още утре. Резервирай в snimai.pro.\n\n#snimaipro #наемнатехника #видеопродукция' },
  { topic: 'gear_spotlight', hook: 'question', text: 'Какво би снимал с {gear}? Тази седмица е свободна при наш партньор в София. Кажи в коментар за какъв проект ти трябва.\n\n#snimaipro #камера #филмовпроизводство' },
  { topic: 'gear_spotlight', hook: 'list', text: '3 причини да наемеш {gear} вместо да я купуваш:\n1. Плащаш само за дните на снимките\n2. Тестваш преди да инвестираш\n3. Винаги последният модел\n\n#snimaipro #наем #фотография' },
  { topic: 'gear_spotlight', hook: 'announcement', text: 'Нова техника в платформата: {gear}. Вече може да се наеме директно от собственика, с ясна цена и календар на заетост.\n\n#snimaipro #новоуплатформата #наемнатехника' },
  { topic: 'tips', hook: 'list', text: '5 неща, които да провериш при получаване на наета камера: батерии, карти, сензор, обектив, кабели. Запази си списъка за следващата снимачна.\n\n#snimaipro #съвети #видеограф' },
  { topic: 'tips', hook: 'question', text: 'Знаеш ли как да изчислиш колко карта ти трябва за един снимачен ден? Ето бърза формула, която ползваме всички в екипа. Запази за по-късно.\n\n#snimaipro #съвети #филмоваколегия' },
  { topic: 'tips', hook: 'relatable', text: 'Когато клиентът каже "само един кадър" и после искаш три обектива, два статива и дрон. Позната ли ти е ситуацията? Планирай техниката предварително.\n\n#snimaipro #снимачнидни #реклама' },
  { topic: 'tips', hook: 'pov', text: 'POV: ден преди снимките си и разбираш, че ти трябва още една светлина. Спокойно, в snimai.pro има наличност в твоя град.\n\n#snimaipro #pov #осветление' },
  { topic: 'crew_community', hook: 'announcement', text: 'Запознай се с екипа: оператор с над 10 години опит в реклами и музикални клипове вече е в платформата. Виж профила и свободните дати.\n\n#snimaipro #екип #оператор' },
  { topic: 'crew_community', hook: 'question', text: 'Търсиш монтажист за клип до края на месеца? Публикувай проект и получи оферти от проверени професионалисти. Без посредници.\n\n#snimaipro #монтаж #хоратаотиндустрията' },
  { topic: 'crew_community', hook: 'relatable', text: 'Всеки продуцент знае: добрият екип прави половината работа. Благодарим на всички, които снимаха с нас този месец.\n\n#snimaipro #общност #продукция' },
  { topic: 'bts', hook: 'relatable', text: 'Зад кадър от снимачния ден: 6 сутринта, кафе и три куфара техника. Така изглежда една реклама отвътре.\n\n#snimaipro #задкадър #снимки' },
  { topic: 'bts', hook: 'pov', text: 'POV: ти си на площадката и всичко работи, защото техниката е проверена от собственика ѝ. Кадри от последния ни проект.\n\n#snimaipro #bts #видео' },
  { topic: 'partner', hook: 'announcement', text: 'Радваме се да обявим партньорство с Electricity. Заедно правим по-достъпна професионалната техника за българските творци.\n\n#snimaipro #electricity #партньори' },
  { topic: 'partner', hook: 'announcement', text: 'Audiogen вече е част от snimai.pro. Звукови решения за реклами, филми и подкасти, които можеш да наемеш заедно с камерата.\n\n#snimaipro #audiogen #звук' },
  { topic: 'partner', hook: 'list', text: 'Какво получаваш от нашите партньори: отстъпки за наем, приоритетна поддръжка и техника в ден на поръчка. Виж пълния списък в профила.\n\n#snimaipro #партньори #наем' },
  { topic: 'platform_howto', hook: 'list', text: 'Как работи snimai.pro в 4 стъпки: избираш техника, пращаш запитване, договаряш с собственика, вземаш и снимаш. Без скрити такси.\n\n#snimaipro #какработи #наемнатехника' },
  { topic: 'platform_howto', hook: 'question', text: 'Имаш техника, която стои в шкафа? Добави я в платформата и изкарвай от нея, докато не я ползваш. Регистрацията отнема 5 минути.\n\n#snimaipro #пасивенприход #техника' },
  { topic: 'platform_howto', hook: 'price_compare', text: 'Какво струва проект с наета техника спрямо купена? Сравнихме реални оферти за един рекламен ден. Резултатът ще те изненада.\n\n#snimaipro #бюджет #наемvsпокупка' },
  { topic: 'other', hook: 'relatable', text: 'Понеделник сутрин, имейли и чаша кафе. Хубава седмица на всички, които правят кадри!\n\n#snimaipro #понеделник' },
  { topic: 'other', hook: 'question', text: 'Коя е любимата ти фокусна дължина и защо? Чакаме мненията ви в коментарите.\n\n#snimaipro #обективи #общност' },
];

const FORMAT_BASE = {
  REELS: { reach: 7200, views: 1.7, like: 0.05, save: 0.012, share: 0.010 },
  CAROUSEL: { reach: 3200, views: 1.25, like: 0.045, save: 0.022, share: 0.006 },
  IMAGE: { reach: 2300, views: 1.15, like: 0.04, save: 0.009, share: 0.004 },
} as const;
type Fmt = keyof typeof FORMAT_BASE;

const TOPIC_MULT: Record<Topic, { reach: number; save: number; share: number }> = {
  gear_spotlight: { reach: 1.0, save: 1.0, share: 0.9 },
  tips: { reach: 1.1, save: 1.9, share: 1.3 },
  crew_community: { reach: 0.85, save: 0.7, share: 0.8 },
  bts: { reach: 1.2, save: 0.6, share: 1.0 },
  partner: { reach: 0.7, save: 0.5, share: 0.6 },
  platform_howto: { reach: 0.95, save: 1.4, share: 1.2 },
  other: { reach: 0.8, save: 0.5, share: 0.7 },
};
const HOOK_MULT: Record<HookType, { reach: number; share: number }> = {
  question: { reach: 1.0, share: 0.9 },
  price_compare: { reach: 1.25, share: 2.1 },
  pov: { reach: 1.3, share: 1.5 },
  list: { reach: 1.0, share: 1.2 },
  relatable: { reach: 1.15, share: 1.7 },
  announcement: { reach: 0.8, share: 0.7 },
  other: { reach: 0.9, share: 0.8 },
};

type Final = {
  reach: number; views: number; likes: number; comments: number; saved: number; shares: number;
  follows: number; profile_visits: number; avgWatch: number | null;
};

const now = Date.now();
const growth = (age: number, reels: boolean) => 1 - Math.exp(-(age + 0.7) / (reels ? 3.2 : 2.2));

function buildPosts(): { posts: PostLatest[]; history: Map<string, PostMetric[]> } {
  const posts: PostLatest[] = [];
  const history = new Map<string, PostMetric[]>();
  const N = 60;
  // Offsets in days before now, newest first. Two recent ones are too fresh (< 48h).
  const offsets: number[] = [0.6, 1.4];
  let off = 1.4;
  while (offsets.length < N) { off += between(2.0, 4.2); offsets.push(off); }
  const scale = 177 / offsets[N - 1];

  offsets.forEach((o, i) => {
    const ageDays = i < 2 ? o : o * scale + 1;
    // posting time: choose Sofia hour, convert to UTC approx (UTC+2/3)
    const hour = weighted<number>([[9, 1], [11, 2], [12, 3], [14, 1], [17, 2], [18, 3], [19, 4], [20, 3], [21, 1]]);
    const baseMs = now - ageDays * DAY;
    const d = new Date(baseMs);
    d.setUTCHours(hour - 2, Math.floor(between(0, 59)), 0, 0);
    let postedMs = d.getTime();
    if (postedMs > now - 3600000) postedMs = now - (i === 0 ? 14 : 30) * 3600000;
    const age = Math.max(0, Math.floor((now - postedMs) / DAY));

    const fmt: Fmt = weighted<Fmt>([['REELS', 45], ['CAROUSEL', 35], ['IMAGE', 20]]);
    const tpl = pick(TPLS);
    const caption = tpl.text.replace('{gear}', pick(GEAR));
    const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1).toLowerCase());
    const id = String(17900000000100000 + i * 37 + Math.floor(rnd() * 30));
    const f = FORMAT_BASE[fmt];
    const tm = TOPIC_MULT[tpl.topic];
    const hm = HOOK_MULT[tpl.hook];
    const reach = Math.max(300, Math.round(f.reach * tm.reach * hm.reach * Math.exp(gauss() * 0.42) * (1 + (180 - age) / 900)));
    const fin: Final = {
      reach,
      views: Math.round(reach * f.views * between(0.9, 1.15)),
      likes: Math.round(reach * f.like * between(0.7, 1.35)),
      comments: Math.round(reach * between(0.002, 0.007)),
      saved: Math.round(reach * f.save * tm.save * between(0.6, 1.5)),
      shares: Math.round(reach * f.share * tm.share * hm.share * between(0.55, 1.5)),
      follows: Math.round(reach * between(0.0015, 0.007)),
      profile_visits: Math.round(reach * between(0.012, 0.04)),
      avgWatch: fmt === 'REELS' ? Math.round(between(3200, 11000)) : null,
    };
    const reels = fmt === 'REELS';
    const rows: PostMetric[] = [];
    const lastDay = Math.min(age, 75);
    for (let dd = 0; dd <= lastDay; dd++) {
      const g = growth(dd, reels);
      const day = isoDay(postedMs + dd * DAY);
      const v = (x: number) => Math.round(x * g);
      const likes = v(fin.likes), comments = v(fin.comments), saved = v(fin.saved), shares = v(fin.shares);
      rows.push({
        post_id: id, captured_on: day, captured_at: new Date(postedMs + dd * DAY + 3 * 3600000).toISOString(),
        reach: v(fin.reach), views: v(fin.views), likes, comments, saved, shares,
        total_interactions: likes + comments + saved + shares,
        follows: v(fin.follows), profile_visits: v(fin.profile_visits), replies: null,
        avg_watch_time_ms: fin.avgWatch, total_watch_time_ms: fin.avgWatch ? Math.round(fin.avgWatch * v(fin.views)) : null,
        raw: {},
      });
    }
    const m = rows[rows.length - 1];
    const rate = (x: number | null) => (m.reach && m.reach > 0 && x != null ? x / m.reach : null);
    const post: PostLatest = {
      id, caption, media_type: fmt === 'REELS' ? 'VIDEO' : fmt === 'CAROUSEL' ? 'CAROUSEL_ALBUM' : 'IMAGE',
      product_type: fmt === 'REELS' ? 'REELS' : 'FEED', permalink: null, thumbnail_url: null, media_url: null,
      posted_at: new Date(postedMs).toISOString(), caption_length: [...caption].length, hashtags,
      like_count: m.likes, comments_count: m.comments,
      // Roughly 1 in 6 posts is not yet tagged, so the editing flow is visible.
      topic: rnd() < 0.16 ? null : tpl.topic, hook_type: rnd() < 0.16 ? null : tpl.hook,
      notes: rnd() < 0.12 ? 'Добро представяне в първите 3 секунди. Да повторим формата.' : null,
      first_seen_at: new Date(postedMs + 3600000).toISOString(), updated_at: m.captured_at,
      captured_on: m.captured_on, captured_at: m.captured_at,
      reach: m.reach, views: m.views, likes: m.likes, comments: m.comments, saved: m.saved, shares: m.shares,
      total_interactions: m.total_interactions, follows: m.follows, profile_visits: m.profile_visits, replies: null,
      avg_watch_time_ms: m.avg_watch_time_ms, total_watch_time_ms: m.total_watch_time_ms,
      engagement_rate: rate(m.total_interactions), save_rate: rate(m.saved), share_rate: rate(m.shares),
      comment_rate: rate(m.comments), follow_rate: rate(m.follows),
      too_fresh: now - postedMs < 48 * 3600000,
    };
    posts.push(post);
    history.set(id, rows);
  });
  posts.sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  return { posts, history };
}

function buildAccount(posts: PostLatest[]) {
  const daily: AccountDaily[] = [];
  const snaps: AccountSnapshot[] = [];
  const byDay = new Map<string, number>();
  for (const p of posts) {
    const base = new Date(p.posted_at).getTime();
    [0.34, 0.2, 0.1, 0.05].forEach((w, k) => {
      const key = isoDay(base + k * DAY);
      byDay.set(key, (byDay.get(key) ?? 0) + (p.reach ?? 0) * w);
    });
  }
  let followers = 4180;
  const todayMs = new Date(isoDay(now)).getTime();
  for (let k = 180; k >= 1; k--) {
    const dayMs = todayMs - k * DAY;
    const day = isoDay(dayMs);
    const boost = byDay.get(day) ?? 0;
    const reach = Math.round(1900 + boost + between(-250, 350) + (180 - k) * 5);
    const interactions = Math.round(reach * between(0.035, 0.055));
    const gain = Math.max(-3, Math.round(boost / 1100 + between(0, 4) - 0.7));
    followers += gain;
    daily.push({
      day, reach, views: Math.round(reach * between(1.4, 1.8)), accounts_engaged: Math.round(reach * between(0.03, 0.05)),
      total_interactions: interactions, likes: Math.round(interactions * 0.62), comments: Math.round(interactions * 0.06),
      saves: Math.round(interactions * 0.14), shares: Math.round(interactions * 0.18),
      profile_links_taps: Math.round(reach * between(0.002, 0.006)), follower_gain: gain, raw: {},
      updated_at: new Date(dayMs + DAY + 5 * 3600000).toISOString(),
    });
    snaps.push({
      captured_on: day, username: 'snimai.pro', followers_count: followers, follows_count: 318,
      media_count: posts.filter((p) => p.posted_at.slice(0, 10) <= day).length, captured_at: new Date(dayMs + 5 * 3600000).toISOString(),
    });
  }
  return { daily, snaps };
}

function buildRuns(): IngestRun[] {
  const runs: IngestRun[] = [];
  const msgs: Array<[string, string, number]> = [
    ['ok', 'Синхронизирани публикации и статистики за последните 60 дни.', 18],
    ['ok', 'Синхронизирани публикации и статистики за последните 60 дни.', 18],
    ['ok', 'Метриката profile_visits беше отхвърлена за REELS и е пропусната.', 17],
    ['error', 'Instagram API върна ограничение на заявките (код 4). Опитът беше прекратен, следващият ще продължи.', 3],
    ['ok', 'Токенът беше подновен. Синхронизирани публикации и статистики.', 19],
    ['ok', 'Синхронизирани публикации и статистики за последните 60 дни.', 18],
    ['ok', 'Първоначално зареждане на цялата история.', 60],
  ];
  const t0 = new Date(isoDay(now) + 'T05:17:00Z').getTime();
  msgs.forEach(([status, message, count], i) => {
    let start = t0 - i * DAY;
    if (start > now) start -= DAY;
    runs.push({
      id: 100 - i, started_at: new Date(start).toISOString(),
      finished_at: new Date(start + (status === 'error' ? 9000 : 41000)).toISOString(),
      status, posts_synced: count, message,
    });
  });
  return runs;
}

export function createMockApi(): DataApi {
  const { posts, history } = buildPosts();
  const { daily, snaps } = buildAccount(posts);
  const runs = buildRuns();
  const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    demo: true,
    async isAllowed() { return true; },
    async getPosts() { await sleep(); return posts.slice(); },
    async getPost(id): Promise<PostDetail | null> {
      await sleep(80);
      const post = posts.find((p) => p.id === id);
      return post ? { post: { ...post }, history: history.get(id) ?? [] } : null;
    },
    async updatePostTags(id, patch: PostTagPatch) {
      await sleep(250);
      const p = posts.find((x) => x.id === id);
      if (!p) throw new Error('Публикацията не е намерена.');
      Object.assign(p, patch, { updated_at: new Date().toISOString() });
    },
    async getAccountDaily() { await sleep(); return daily.slice(); },
    async getSnapshots() { await sleep(); return snaps.slice(); },
    async getIngestRuns() { await sleep(); return runs.slice(); },
  };
}
