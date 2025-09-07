import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

// Force Node.js runtime; avoids Edge incompatibilities with some libs
export const runtime = 'nodejs';
// Avoid caching
export const dynamic = 'force-dynamic';

type Deal = {
  api_key?: string;
  deal_id: string | number;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  price: number;
  time: string; // ISO 8601
};

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Use POST to submit deals' });
}

export async function POST(req: NextRequest) {
  try {
    // Parse JSON
    const body = (await req.json()) as Partial<Deal>;

    // Basic validation
    if (!body?.api_key) {
      return NextResponse.json({ ok: false, error: 'missing api_key' }, { status: 401 });
    }

    // Validate the api_key → find user_id
    const { data: keyRow, error: keyErr } = await supabaseAdmin
      .from('api_keys')
      .select('user_id,label,api_key')
      .eq('api_key', body.api_key)
      .maybeSingle();

    if (keyErr) {
      return NextResponse.json({ ok: false, error: keyErr.message }, { status: 500 });
    }
    if (!keyRow) {
      return NextResponse.json({ ok: false, error: 'invalid api_key' }, { status: 401 });
    }

    const deal: Deal = {
      deal_id: String(body.deal_id ?? ''),
      symbol: String(body.symbol ?? ''),
      side: body.side === 'sell' ? 'sell' : 'buy',
      volume: Number(body.volume ?? 0),
      price: Number(body.price ?? 0),
      time: String(body.time ?? new Date().toISOString()),
    };

    // Insert into deals table
    const { error } = await supabaseAdmin.from('mt5_deals').insert({
      user_id: keyRow.user_id,
      deal_id: deal.deal_id,
      symbol: deal.symbol,
      side: deal.side,
      volume: deal.volume,
      price: deal.price,
      time: deal.time,
    });

    if (error) {
      // Bubble up the exact DB message so you can see it in Vercel logs
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
