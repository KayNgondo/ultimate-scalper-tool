// app/api/sessions/close/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type ClosePayload = {
  sessionPnl?: number;
  startingCapital?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();

    // Ensure we have an authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Parse and sanitize the incoming body
    const body = (await req.json().catch(() => ({}))) as ClosePayload;

    const pnl = Number(body.sessionPnl);
    const sessionPnl = Number.isFinite(pnl) ? pnl : 0;

    // If not provided, we’ll use 0 (your new rule).
    const providedStart = Number(body.startingCapital);
    const requestedStartingCapital =
      Number.isFinite(providedStart) ? providedStart : 0;

    const endedAt = body.endedAt ?? new Date().toISOString();

    // Load any existing profile values so we can accumulate correctly.
    const { data: existing, error: fetchErr } = await supabase
      .from("profiles")
      .select("starting_capital,total_pnl,sessions")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { ok: false, error: fetchErr.message },
        { status: 400 }
      );
    }

    const prevStarting = Number(existing?.starting_capital);
    const prevTotal = Number(existing?.total_pnl);
    const prevSessions = Number(existing?.sessions);

    const starting_capital =
      Number.isFinite(prevStarting) && prevStarting !== 0
        ? prevStarting
        : requestedStartingCapital; // keep existing if set, otherwise use requested (default 0)

    const total_pnl = (Number.isFinite(prevTotal) ? prevTotal : 0) + sessionPnl;
    const sessions = (Number.isFinite(prevSessions) ? prevSessions : 0) + 1;

    // Upsert profile row
    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        starting_capital,
        total_pnl,
        sessions,
        last_active: endedAt,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: upsertErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile: {
        id: user.id,
        starting_capital,
        total_pnl,
        sessions,
        last_active: endedAt,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
