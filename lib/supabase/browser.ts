// app/lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";

/**
 * Singleton browser Supabase client.
 * Use in client components/pages only.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
