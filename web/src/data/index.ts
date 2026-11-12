import { DEMO_MODE, supabase } from '../lib/supabase';
import { createMockApi } from './mock';
import { createSupabaseApi } from './supabase';
import type { DataApi } from './types';

export const api: DataApi = DEMO_MODE || !supabase ? createMockApi() : createSupabaseApi(supabase);
export type { DataApi, PostDetail } from './types';
