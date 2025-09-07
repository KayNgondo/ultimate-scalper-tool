// app/api/mt5/webhook/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const { api_key, deal_id, symbol, side, volume, price, time } = payload ?? {}

    if (!api_key || !deal_id || !symbol || !side || volume === undefined || price === undefined || !time) {
      return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 })
    }

    const { data: keyRow, error: keyErr } = await supabase
      .from('api_keys')
      .select('user_id,label')
      .eq('api_key', api_key)
      .single()

    if (keyErr || !keyRow || (keyRow.label && keyRow.label !== 'mt5')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const { error: insErr } = await supabase
      .from('mt5_deals')
      .insert({
        user_id: keyRow.user_id,
        deal_id: String(deal_id),
        symbol,
        side,
        volume: Number(volume),
        price: Number(price),
        time: new Date(time).toISOString(),
      })

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
