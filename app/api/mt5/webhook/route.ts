import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use the service role key on the server to bypass RLS for inserts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // 1) Basic validation
    const needed = ['api_key', 'deal_id', 'symbol', 'side', 'volume', 'price', 'time']
    for (const k of needed) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ ok: false, error: `missing ${k}` }, { status: 400 })
      }
    }

    // 2) Look up the user_id from the API key
    const { data: keyRow, error: keyErr } = await supabase
      .from('api_keys')
      .select('user_id')
      .eq('api_key', String(body.api_key))
      .single()

    if (keyErr || !keyRow) {
      return NextResponse.json({ ok: false, error: 'invalid api_key' }, { status: 401 })
    }

    // 3) Prepare row for mt5_deals (friendly typing)
    const row = {
      user_id: keyRow.user_id,
      deal_id: String(body.deal_id),
      order_id: body.order_id ? String(body.order_id) : null,
      position_id: body.position_id ? String(body.position_id) : null,
      symbol: String(body.symbol),
      side: String(body.side),
      volume: Number(body.volume),
      price: Number(body.price),
      time: new Date(body.time).toISOString(),
    }

    // 4) Insert (unique index will ignore exact duplicates if you handle that client-side)
    const { error: insErr } = await supabase.from('mt5_deals').insert(row)

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Use POST to submit deals' })
}
