// app/lib/useSupabase.ts
'use client';
import useSupabase from '@/lib/useSupabase';
// or (if you don’t use the @ alias)
import useSupabase from '../../lib/useSupabase';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * If you have generated DB types, replace `any` with your Database type:
 *   import type { Database } from '@/types/database';
 *   type DB = Database;
 */
type DB = any;

// Keep one instance for the entire browser session
let _client: SupabaseClient<DB> | null = null;

/**
 * useSupabase()
 * Returns a singleton Supabase browser client for Client Components.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export default function useSupabase(): SupabaseClient<DB> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      '[useSupabase] Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  _client = createClient<DB>(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return _client;
}

/** Optional convenience alias */
export const getSupabase = () => useSupabase();
