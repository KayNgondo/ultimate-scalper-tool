// app/api/sessions/close/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-SIDE Supabase client (service key) – bypasses RLS for this one insert.
 * DO NOT expose SUPABASE_SERVICE_ROLE_KEY on the client.
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server env only
);

type Body = {
  userId: string;           // required (profiles.id / auth.user.id)
  pnl: number;              // PnL for the session (USD)
  startedAt?: string;       // ISO; optional (defaults to now - 1h)
  endedAt?: string;         // ISO; optional (defaults to now)
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.userId || typeof body.pnl !== "number") {
      return NextResponse.json(
        { error: "userId and pnl are required" },
        { status: 400 }
      );
    }

    const started =
      body.startedAt ? new Date(body.startedAt) : new Date(Date.now() - 60 * 60 * 1000);
    const ended = body.endedAt ? new Date(body.endedAt) : new Date();

    // Insert CLOSED session
    const { error } = await supabase.from("sessions").insert({
      user_id: body.userId,
      status: "closed",
      pnl: body.pnl,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
