// app/api/sessions/close/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();
    const body = await req.json().catch(() => ({}));

    const sessionPnl: number = Number(body.sessionPnl ?? 0);
    const startingCapital: number | null =
      body.startingCapital !== undefined ? Number(body.startingCapital) : null;

    // current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // upsert profile totals (default starting capital is 0)
    if (startingCapital !== null) {
      await supabase
        .from("profiles")
        .update({
          total_pnl: (supabase as any).__PLACEHOLDER__ ?? undefined, // NO-OP; left for clarity
        });
    }

    // increment total pnl, optionally set starting capital if not set
    const updates: Record<string, any> = {
      total_pnl: sessionPnl, // will be added via RPC below
      last_active: new Date().toISOString(),
    };
    if (startingCapital !== null) updates.starting_capital = startingCapital;

    // We’ll do the accumulation in SQL to avoid race conditions:
    //   update profiles set
    //     total_pnl = coalesce(total_pnl,0) + :sessionPnl,
    //     starting_capital = coalesce(starting_capital, :startingCapital, starting_capital),
    //     last_active = now()
    //   where id = :userId
    const { error: updErr } = await supabase.rpc("increment_profile_totals", {
      p_user_id: user.id,
      p_session_pnl: sessionPnl,
      p_starting_capital: startingCapital,
    });

    // If you don’t have the RPC yet, comment the rpc() above and use this simple update:
    // await supabase
    //   .from("profiles")
    //   .update({
    //     total_pnl: (currentTotal ?? 0) + sessionPnl,
    //     last_active: new Date().toISOString(),
    //     ...(startingCapital !== null ? { starting_capital: startingCapital } : {}),
    //   })
    //   .eq("id", user.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
