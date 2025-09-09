"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type LbRow = {
  id: string;
  display_name: string | null;
  sessions: number | null;
  starting_capital: number | null; // <-- will be shown
  total_pnl: number | null;
  equity: number | null;
  last_active: string | null;
};

export default function LeaderboardPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<LbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("equity", { ascending: false })
        .order("sessions", { ascending: false })
        .order("last_active", { ascending: false });

      if (!cancelled) {
        if (error) {
          console.error(error);
          setRows([]);
        } else {
          setRows(data || []);
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <p className="rounded-lg border bg-white p-4 text-sm text-slate-700">
        Ranked by <strong>Equity</strong> (Starting Capital + Total PnL). Ties
        break on <strong>Sessions</strong>, then recency.
      </p>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Trader</th>
              <th className="px-3 py-2 text-left">Badge</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              {/* NEW */}
              <th className="px-3 py-2 text-right">Starting capital</th>
              <th className="px-3 py-2 text-right">Equity</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No traders yet.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const sessions = r.sessions ?? 0;
                const equity = Number(r.equity ?? 0);
                const starting = Number(r.starting_capital ?? 0);
                const name =
                  (r.display_name && r.display_name.trim()) || "Trader";

                const badge = badgeForSessions(sessions);

                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{rankMedal(i)}</td>
                    <td className="px-3 py-2">{name}</td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-2">
                        {badge.image && (
                          <img
                            src={badge.image}
                            alt={badge.name}
                            className="h-5 w-5"
                          />
                        )}
                        <span>{badge.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{sessions}</td>
                    {/* NEW */}
                    <td className="px-3 py-2 text-right">
                      {fmtUSD(starting)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtUSD(equity)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------- helpers ------- */

function rankMedal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return i + 1;
}

function badgeForSessions(sessions: number) {
  if (sessions >= 30) return { name: "Legendary", image: "/badges/legendary.png" };
  if (sessions >= 25) return { name: "Elite", image: "/badges/elite.png" };
  if (sessions >= 20) return { name: "Diamond", image: "/badges/diamond.png" };
  if (sessions >= 15) return { name: "Platinum", image: "/badges/platinum.png" };
  if (sessions >= 10) return { name: "Gold", image: "/badges/gold.png" };
  if (sessions >= 5)  return { name: "Silver", image: "/badges/silver.png" };
  return { name: "Starter", image: "/badges/starter.png" };
}

function fmtUSD(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
