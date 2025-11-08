// app/api/journal/route.ts
import { NextRequest, NextResponse } from "next/server";

const WEB_APP_URL = process.env.SHEETS_WEBAPP_URL!;
const READ_TOKEN  = process.env.SHEETS_READ_TOKEN!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account = searchParams.get("account") || "";
    const since   = searchParams.get("since") || "";

    if (!account)
      return NextResponse.json({ ok:false, error:"account required" }, { status:400 });
    if (!WEB_APP_URL || !READ_TOKEN)
      return NextResponse.json({ ok:false, error:"missing server envs" }, { status:500 });

    const url =
      `${WEB_APP_URL}?readToken=${encodeURIComponent(READ_TOKEN)}&account=${encodeURIComponent(account)}` +
      (since ? `&since=${encodeURIComponent(since)}` : "");

    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();
    return NextResponse.json(data, { status:200 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e) }, { status:500 });
  }
}
