import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || !url;

export const supabase: SupabaseClient | null = isDemoMode
  ? null
  : createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

/** Non-null accessor for code paths that only run once we know we're not in demo mode. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase client is not configured (demo mode is active).');
  }
  return supabase;
}
