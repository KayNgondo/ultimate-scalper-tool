import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; // 👈 use your server-side supabase client

export async function POST(req: Request) {
  const supabase = createClient();

  try {
    const { userId, pnl, startingCapital, startedAt, endedAt } = await req.json();

    const { error } = await supabase
      .from("sessions") // 👈 your table that feeds leaderboard
      .insert({
        user_id: userId,
        pnl,
        starting_capital: startingCapital,
        started_at: startedAt,
        ended_at: endedAt,
      });

    if (error) {
      console.error("DB insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("API error:", err.message);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
