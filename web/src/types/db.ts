// Mirrors supabase/migrations/0001_init.sql exactly.

export type Json = unknown;

export interface Post {
  id: string;
  caption: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  product_type: 'FEED' | 'REELS' | 'STORY' | string;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  posted_at: string;
  caption_length: number;
  hashtags: string[];
  like_count: number | null;
  comments_count: number | null;
  topic: Topic | null;
  hook_type: HookType | null;
  notes: string | null;
  first_seen_at: string;
  updated_at: string;
}

export type Topic = 'gear_spotlight' | 'tips' | 'crew_community' | 'bts' | 'partner' | 'platform_howto' | 'other';
export type HookType = 'question' | 'price_compare' | 'pov' | 'list' | 'relatable' | 'announcement' | 'other';

export interface PostMetric {
  post_id: string;
  captured_on: string; // date
  captured_at: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  total_interactions: number | null;
  follows: number | null;
  profile_visits: number | null;
  replies: number | null;
  avg_watch_time_ms: number | null;
  total_watch_time_ms: number | null;
  raw: Json;
}

export interface AccountSnapshot {
  captured_on: string;
  username: string | null;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  captured_at: string;
}

export interface AccountDaily {
  day: string;
  reach: number | null;
  views: number | null;
  accounts_engaged: number | null;
  total_interactions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  profile_links_taps: number | null;
  follower_gain: number | null;
  raw: Json;
  updated_at: string;
}

export interface IngestRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'ok' | 'error' | string;
  posts_synced: number;
  message: string | null;
}

/** View public.post_latest: post columns + latest metrics + derived rates. */
export interface PostLatest extends Post {
  captured_on: string;
  captured_at: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  total_interactions: number | null;
  follows: number | null;
  profile_visits: number | null;
  replies: number | null;
  avg_watch_time_ms: number | null;
  total_watch_time_ms: number | null;
  engagement_rate: number | null;
  save_rate: number | null;
  share_rate: number | null;
  comment_rate: number | null;
  follow_rate: number | null;
  too_fresh: boolean;
}

export interface AllowedUser {
  email: string;
}

export type PostTagPatch = Partial<Pick<Post, 'topic' | 'hook_type' | 'notes'>>;
