"use client";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  starting_capital: number;
  total_pnl: number;
  sessions: number;
  equity: number;
  badge: string;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold">Leaderboard</h2>
      <p className="text-muted-foreground">
        Rank traders by <strong>equity</strong> and break ties with{" "}
        <strong>sessions</strong>. Badges are awarded by total sessions.
      </p>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Trader</th>
              <th className="px-3 py-2 text-left">Badge</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">Equity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.badge}</td>
                <td className="px-3 py-2 text-right">{r.sessions}</td>
                <td className="px-3 py-2 text-right">
                  ${r.equity.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
