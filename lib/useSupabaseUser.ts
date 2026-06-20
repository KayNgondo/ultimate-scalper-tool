// lib/useSupabase.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type DB = any;

let _client: SupabaseClient<DB> | null = null;

export default function useSupabase(): SupabaseClient<DB> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      '[useSupabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
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

export const getSupabase = () => useSupabase();
