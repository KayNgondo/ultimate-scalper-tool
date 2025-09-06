"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/useSupabaseUser";
import type { WalletTransaction } from "@/types/wallet";

type CashType = "deposit" | "withdrawal" | "fee" | "correction";

export default function CashPage() {
  const { user, loading } = useSupabaseUser();
  const router = useRouter();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState<CashType>("deposit");
  const [currency, setCurrency] = useState("USD");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/sign-in");
  }, [loading, user, router]);

  async function refresh() {
    if (!user) return;
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as unknown as WalletTransaction[]);
  }

  useEffect(() => {
    refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const netCashflow = useMemo(() => {
    return rows.reduce((acc, r) => {
      const amt = Number(r.amount);
      if (r.type === "deposit") return acc + amt;
      if (r.type === "withdrawal" || r.type === "fee") return acc - amt;
      return acc + amt; // correction can be ±
    }, 0);
  }, [rows]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      alert("Amount must be a positive number.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      amount: amt,
      type,
      currency,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      note: note || null,
    });

    setSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    await refresh();
    setAmount("");
    setNote("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Top row: title + Dashboard button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cashier</h1>
        <Link href="/">
          <button className="rounded-2xl bg-gray-900 text-white px-4 py-2 hover:opacity-90">
            Dashboard
          </button>
        </Link>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="col-span-2">
          <label className="block text-sm mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
            placeholder="e.g. 250.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CashType)}
            className="w-full border rounded-xl px-3 py-2"
          >
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="fee">Fee</option>
            <option value="correction">Correction</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Date/Time</label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Currency</label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-sm mb-1">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
            placeholder="e.g. Deriv top-up via card"
          />
        </div>

        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl px-4 py-2 bg-gray-900 text-white hover:opacity-90"
          >
            {submitting ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">History</h2>
        <div className="text-sm">
          Net Cashflow: <span className="font-semibold">{netCashflow.toFixed(2)} {rows[0]?.currency ?? "USD"}</span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="border rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm">
                <span className="font-medium">{r.type.toUpperCase()}</span> · {Number(r.amount).toFixed(2)} {r.currency}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(r.occurred_at).toLocaleString()} {r.note ? `· ${r.note}` : ""}
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 && <div className="text-sm text-gray-500">No cash movements yet.</div>}
      </div>
    </div>
  );
}
