"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  // Read envs from the public build-time variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Do not hard-crash—log and create a dummy client that won’t run auth calls
    console.error(
      "[UST] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!browserClient) {
    browserClient = createClient(url, anon, {
      auth: {
        // Unique storage key avoids “Multiple GoTrueClient instances” noise
        storageKey: "ust-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
