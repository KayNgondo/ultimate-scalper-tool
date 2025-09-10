// app/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
// (Optional) only if you want to annotate the return type:
// import type { SupabaseClient } from "@supabase/supabase-js";

export async function createServerSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Don't crash SSR silently—log a clear message
    console.error(
      "[UST] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (server)."
    );
    throw new Error("Supabase environment variables are not configured (server).");
  }

  // Next.js 15+ may type `cookies()` as async in some contexts -> await it
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      // These methods can be async; @supabase/ssr supports that
      get: async (name: string) => cookieStore.get(name)?.value,
      set: async (name: string, value: string, options?: any) => {
        // Next’s cookie setter accepts a single object
        cookieStore.set({ name, value, ...options });
      },
      remove: async (name: string, options?: any) => {
        cookieStore.set({ name, value: "", expires: new Date(0), ...options });
      },
    },
  });

  return supabase; // as SupabaseClient // (if you imported the type)
}
