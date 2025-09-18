import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // ✅ must await here
    const supabase = await createServerSupabase();

    const body = await req.json().catch(() => ({}));

    const sessionPnl: number = Number(body.sessionPnl ?? 0);
    const startingCapital: number | null =
      body.startingCapital !== undefined ? Number(body.startingCapital) : null;

    // ✅ get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ update profile totals — starting capital defaults to 0
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        total_pnl: sessionPnl,
        starting_capital: startingCapital ?? 0,
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
