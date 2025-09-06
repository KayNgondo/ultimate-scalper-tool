"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/useSupabaseUser";

type TxType = "deposit" | "withdrawal" | "fee" | "correction";
interface TxRow {
  id: string;
  user_id: string;
  amount: number;
  type: TxType;
  currency: string;
  occurred_at: string;
  note: string | null;
}
function signAmount(t: TxType, a: number) {
  if (t === "deposit") return a;
  if (t === "withdrawal" || t === "fee") return -a;
  return a; // correction can be ±
}

export default function CashCard() {
  const { user } = useSupabaseUser();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setRows([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(400);
      setRows((data ?? []) as unknown as TxRow[]);
      setLoading(false);
    };
    run();
  }, [user]);

  const { mtd, ytd, currency } = useMemo(() => {
    if (!rows.length) return { mtd: 0, ytd: 0, currency: "USD" as string };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let mtd = 0, ytd = 0;
    for (const r of rows) {
      const d = new Date(r.occurred_at);
      const val = signAmount(r.type, Number(r.amount));
      if (d >= yearStart && d <= now) ytd += val;
      if (d >= monthStart && d <= now) mtd += val;
    }
    return { mtd, ytd, currency: rows[0]?.currency ?? "USD" };
  }, [rows]);

  if (!user) return null;

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Cash</h3>
        <Link href="/cash" className="text-xs underline">Open</Link>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500 mt-2">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <div className="text-xs text-gray-500">Net Cashflow (MTD)</div>
            <div className="text-lg font-bold">{mtd.toFixed(2)} {currency}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Net Cashflow (YTD)</div>
            <div className="text-lg font-bold">{ytd.toFixed(2)} {currency}</div>
          </div>
        </div>
      )}
    </div>
  );
}
