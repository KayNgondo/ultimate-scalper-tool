// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // add in Vercel

// Optional: shape we expect (adjust if your view/table has different columns)
type Row = {
  id: string | number;
  name: string | null;
  starting_capital: number | null;
  total_pnl: number | null;
  sessions: number | null;
  equity: number | null;
  badge?: string | null;
};

export async function GET() {
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Prefer a VIEW called "leaderboard" if you created it.
  // Otherwise, point this to the table that aggregates user stats.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("equity", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Basic sanitization + fallback math if equity is missing
  const rows = (data as Row[]).map((r) => {
    const start = r.starting_capital ?? 0;
    const pnl = r.total_pnl ?? 0;
    const equity = r.equity ?? start + pnl;
    return { ...r, equity: Math.round(equity * 100) / 100 };
  });

  return NextResponse.json({ rows });
}
