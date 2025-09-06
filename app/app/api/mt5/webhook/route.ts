// app/api/mt5/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";       // use Node runtime
export const dynamic = "force-dynamic"; // never cache

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a server (admin) client with the service role key.
// DO NOT expose this key in client code.
const admin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});

type Side = "buy" | "sell";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      api_key,
      deal_id,
      order_id,
      position_id,
      symbol,
      side,
      volume,
      price,
      profit,
      commission,
      swap,
      comment,
      magic,
      account_id,
      broker,
      time,
    } = body ?? {};

    if (!api_key) {
      return NextResponse.json({ ok: false, error: "missing api_key" }, { status: 400 });
    }
    if (!deal_id || !symbol || !side || !volume || !price) {
      return NextResponse.json(
        { ok: false, error: "missing required fields (deal_id, symbol, side, volume, price)" },
        { status: 400 }
      );
    }

    // Validate the api_key -> user_id
    const { data: keyRow, error: keyErr } = await admin
      .from("api_keys")
      .select("user_id, active")
      .eq("api_key", api_key)
      .single();

    if (keyErr || !keyRow || keyRow.active !== true) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Prepare row for upsert
    const insert = {
      deal_id: Number(deal_id),
      user_id: keyRow.user_id as string,
      order_id: order_id ? Number(order_id) : null,
      position_id: position_id ? Number(position_id) : null,
      symbol: String(symbol),
      side: String(side).toLowerCase() as Side,
      volume: Number(volume),
      price: Number(price),
      profit: profit != null ? Number(profit) : null,
      commission: commission != null ? Number(commission) : null,
      swap: swap != null ? Number(swap) : null,
      comment: comment ?? null,
      magic: magic != null ? Number(magic) : null,
      account_id: account_id ?? null,
      broker: broker ?? null,
      time: time ? new Date(time).toISOString() : new Date().toISOString(),
    };

    // Upsert by primary key (deal_id) and ignore duplicates
    const { error: upsertErr } = await admin
      .from("mt5_deals")
      .upsert(insert, { onConflict: "deal_id", ignoreDuplicates: true });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}
