// app/leaderboard/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type LBRow = {
  id: string;
  name: string | null;
  starting_capital: number;
  total_pnl: number;
  sessions: number;
  equity: number;
};

function badgeForSessions(sessions: number): { name: string; imagePath: string } {
  if (sessions >= 30) return { name: "Legendary • 30 Sessions Untouchable", imagePath: "/badges/legendary.png" };
  if (sessions >= 25) return { name: "Elite • 25 Sessions Mastered", imagePath: "/badges/elite.png" };
  if (sessions >= 20) return { name: "Diamond • 20 Sessions Mastered", imagePath: "/badges/diamond.png" };
  if (sessions >= 15) return { name: "Platinum • 15 Sessions Dominated", imagePath: "/badges/platinum.png" };
  if (sessions >= 10) return { name: "Gold • 10 Sessions Conquered", imagePath: "/badges/gold.png" };
  if (sessions >= 5)  return { name: "Silver • 5 Sessions Survived", imagePath: "/badges/silver.png" };
  return { name: "Starter", imagePath: "/badges/silver.png" };
}

async function getRows(): Promise<LBRow[]> {
  // Query Supabase directly on the server (no "use client")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("leaderboard")
    .select("id,name,starting_capital,total_pnl,sessions,equity")
    .order("equity", { ascending: false })
    .order("sessions", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Leaderboard fetch error:", error.message);
    return [];
  }
  return data ?? [];
}

export default async function LeaderboardPage() {
  const rows = await getRows();

  return (
    <main className="container mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Trader</th>
              <th className="text-left p-3">Badge</th>
              <th className="text-right p-3">Sessions</th>
              <th className="text-right p-3">Start</th>
              <th className="text-right p-3">All-time PnL</th>
              <th className="text-right p-3">Equity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={7}>
                  No traders yet — start trading to appear on the board.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const badge = badgeForSessions(r.sessions);
                const start = r.starting_capital ?? 0;
                const pnl = r.total_pnl ?? 0;
                const equity = r.equity ?? start + pnl;

                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-semibold">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </td>
                    <td className="p-3">{r.name || "Trader"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* You can switch to next/image later */}
                        <img src={badge.imagePath} alt={badge.name} className="h-6 w-6 object-contain" />
                        <span className="text-xs text-slate-700">{badge.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">{r.sessions}</td>
                    <td className="p-3 text-right">
                      {start.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </td>
                    <td className={`p-3 text-right ${pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {(pnl >= 0 ? "+" : "") +
                        pnl.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </td>
                    <td className={`p-3 text-right ${equity >= start ? "text-emerald-700" : "text-rose-700"}`}>
                      {equity.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
