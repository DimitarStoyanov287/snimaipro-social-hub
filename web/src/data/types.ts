import type { AccountDaily, AccountSnapshot, IngestRun, PostLatest, PostMetric, PostTagPatch } from '../types/db';

export interface PostDetail {
  post: PostLatest;
  history: PostMetric[];
}

/** Data layer contract. Two implementations: supabase.ts and mock.ts. */
export interface DataApi {
  readonly demo: boolean;
  /** Is this email in allowed_users? */
  isAllowed(email: string): Promise<boolean>;
  getPosts(): Promise<PostLatest[]>;
  getPost(id: string): Promise<PostDetail | null>;
  updatePostTags(id: string, patch: PostTagPatch): Promise<void>;
  getAccountDaily(): Promise<AccountDaily[]>;
  getSnapshots(): Promise<AccountSnapshot[]>;
  getIngestRuns(): Promise<IngestRun[]>;
}
