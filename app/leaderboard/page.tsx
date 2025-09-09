// app/leaderboard/page.tsx
"use client";

import React from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  return (
    <div className="p-6">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>
      <p className="text-slate-600 mb-6">
        Route is working. We’ll wire up Supabase data next.
      </p>
    </div>
  );
}

type Row = {
  id: string | number;
  name: string | null;
  starting_capital: number | null;
  total_pnl: number | null;
  sessions: number | null;
  equity: number | null;
  badge?: string | null;
};

function badgeForSessions(sessions: number | null | undefined) {
  const s = sessions ?? 0;
  if (s >= 30) return "Legendary";
  if (s >= 25) return "Elite";
  if (s >= 20) return "Diamond";
  if (s >= 15) return "Platinum";
  if (s >= 10) return "Gold";
  if (s >= 5) return "Silver";
  return "Starter";
}

export default function LeaderboardPage() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancelled) {
          const data: Row[] = (json.rows ?? []).map((r: Row) => ({
            ...r,
            equity:
              r.equity ??
              Math.round(((r.starting_capital ?? 0) + (r.total_pnl ?? 0)) * 100) / 100,
          }));
          setRows(data);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container mx-auto max-w-5xl p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Leaderboard</h1>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading leaderboard…</div>
      )}

      {err && (
        <div className="text-sm p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th className="w-12">#</th>
                <th>Trader</th>
                <th>Badge</th>
                <th className="text-right">Sessions</th>
                <th className="text-right">Start</th>
                <th className="text-right">All-time PnL</th>
                <th className="text-right">Equity</th>
              </tr>
            </thead>
            <tbody className="[&>tr:not(:first-child)]:border-t">
              {(rows ?? []).map((r, i) => {
                const start = r.starting_capital ?? 0;
                const pnl = r.total_pnl ?? 0;
                const equity = r.equity ?? start + pnl;
                const badge = r.badge ?? badgeForSessions(r.sessions);

                return (
                  <tr key={r.id ?? i} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="font-medium">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="font-medium">{r.name ?? "Trader"}</td>
                    <td>{badge}</td>
                    <td className="text-right">{r.sessions ?? 0}</td>
                    <td className="text-right">
                      {start.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className={`text-right ${pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {(pnl).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className={`text-right ${equity >= start ? "text-emerald-700" : "text-rose-700"}`}>
                      {equity.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                  </tr>
                );
              })}

              {rows?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No traders yet — start trading to appear on the board.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
