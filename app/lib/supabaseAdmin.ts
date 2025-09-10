// app/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// Admin client (server only, do NOT import in client components)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
