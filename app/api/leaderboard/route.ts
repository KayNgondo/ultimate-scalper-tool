import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  // Server-only client with Service Role (never exposed to browser)
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read from the view. RLS on the base table won't block service role.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    // Highest equity first, then sessions as tie breaker, then most recent activity
    .order("equity", { ascending: false })
    .order("sessions", { ascending: false })
    .order("last_active", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
