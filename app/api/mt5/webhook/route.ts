import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Mt5Side = "buy" | "sell";
type Payload = {
  api_key: string;            // from public.api_keys.api_key (uuid)
  deal_id: string | number;
  symbol: string;
  side: Mt5Side;
  volume: number;
  price: number;
  time: string;               // ISO 8601
};

export const runtime = "nodejs";        // ensure Node runtime on Vercel
export const dynamic = "force-dynamic"; // do not statically optimize

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    if (!body?.api_key) {
      return NextResponse.json({ ok: false, error: "missing api_key" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    // validate api key
    const { data: keyRow, error: keyErr } = await supabase
      .from("api_keys")
      .select("user_id, active")
      .eq("api_key", body.api_key)
      .single();

    if (keyErr || !keyRow || keyRow.active === false) {
      return NextResponse.json({ ok: false, error: "invalid api_key" }, { status: 401 });
    }

    // insert deal
    const { error: insErr } = await supabase.from("mt5_deals").insert({
      user_id: keyRow.user_id,
      deal_id: String(body.deal_id),
      symbol: body.symbol,
      side: body.side,
      volume: body.volume,
      price: body.price,
      time: body.time,
    });

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "bad request" }, { status: 400 });
  }
}
