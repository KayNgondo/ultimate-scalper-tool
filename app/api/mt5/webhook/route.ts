// app/api/mt5/webhook/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server secret
)

// This receives the JSON your MT5 robot sends
export async function POST(req: Request) {
  try {
    const payload = await req.json()

    const { api_key, deal_id, symbol, side, volume, price, time } = payload ?? {}

    // 1) Basic checks
    if (!api_key || !deal_id || !symbol || !side || volume === undefined || price === undefined || !time) {
      return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 })
    }

    // 2) Look up the user from your api_keys table
    const { data: keyRow, error: keyErr } = await supabase
      .from('api_keys')
      .select('user_id,label')
      .eq('api_key', api_key)
      .single()

    if (keyErr || !keyRow || (keyRow.label && keyRow.label !== 'mt5')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    // 3) Save the deal into public.mt5_deals
    const { error: insErr } = await supabase
      .from('mt5_deals')
      .insert({
        user_id: keyRow.user_id,
        deal_id: String(deal_id),
        symbol,
        side,
        volume: Number(volume),
        price: Number(price),
        time: new Date(time).toISOString(), // your table’s "time" column
      })

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    // 4) Tell the robot “OK”
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
