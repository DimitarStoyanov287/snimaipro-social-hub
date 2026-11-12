import type { HookType, PostLatest, Topic } from '../types/db';

export const TOPIC_LABELS: Record<Topic, string> = {
  gear_spotlight: 'Техника',
  tips: 'Съвети',
  crew_community: 'Екип и общност',
  bts: 'Зад кадър',
  partner: 'Партньори',
  platform_howto: 'Как работи',
  other: 'Друго',
};

export const HOOK_LABELS: Record<HookType, string> = {
  question: 'Въпрос',
  price_compare: 'Цена: наем vs покупка',
  pov: 'POV',
  list: 'Списък',
  relatable: 'Познато',
  announcement: 'Анонс',
  other: 'Друго',
};

export const TOPICS = Object.keys(TOPIC_LABELS) as Topic[];
export const HOOKS = Object.keys(HOOK_LABELS) as HookType[];

export const topicLabel = (t: string | null | undefined) =>
  t ? TOPIC_LABELS[t as Topic] ?? t : 'Без тема';
export const hookLabel = (h: string | null | undefined) =>
  h ? HOOK_LABELS[h as HookType] ?? h : 'Без hook';

/** Content format as a social media manager thinks of it. */
export type Format = 'REELS' | 'CAROUSEL' | 'IMAGE' | 'VIDEO' | 'STORY';
export function formatOf(p: Pick<PostLatest, 'media_type' | 'product_type'>): Format {
  if (p.product_type === 'REELS') return 'REELS';
  if (p.product_type === 'STORY') return 'STORY';
  if (p.media_type === 'CAROUSEL_ALBUM') return 'CAROUSEL';
  if (p.media_type === 'VIDEO') return 'VIDEO';
  return 'IMAGE';
}
export const FORMAT_LABELS: Record<Format, string> = {
  REELS: 'Reels',
  CAROUSEL: 'Карусел',
  IMAGE: 'Снимка',
  VIDEO: 'Видео',
  STORY: 'Story',
};
export const formatLabel = (p: Pick<PostLatest, 'media_type' | 'product_type'>) => FORMAT_LABELS[formatOf(p)];

export const WEEKDAYS = ['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'];
export const WEEKDAYS_LONG = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'];

export const METRIC_LABELS = {
  reach: 'Обхват',
  views: 'Гледания',
  likes: 'Харесвания',
  comments: 'Коментари',
  saved: 'Запазвания',
  shares: 'Споделяния',
  total_interactions: 'Взаимодействия',
  follows: 'Нови последователи',
  profile_visits: 'Посещения на профила',
} as const;

export const RATE_LABELS = {
  engagement_rate: 'Ангажираност (ER)',
  save_rate: 'Запазвания / обхват',
  share_rate: 'Споделяния / обхват',
  comment_rate: 'Коментари / обхват',
  follow_rate: 'Следвания / обхват',
} as const;
export type RateKey = keyof typeof RATE_LABELS;
