"use client";

/**
 * Ultimate Scalper — Weekly Leaderboard + Archive
 * - "This Week" reads from: leaderboard_this_week (auto-resets every Monday SAST)
 * - "Archive" reads from: leaderboard_weekly_archive + leaderboard_archive_weeks + leaderboard_week_champions
 *
 * Requirements:
 * - You already created those SQL objects in Supabase.
 * - You already have lib/supabase that exports `supabase` browser client.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* =========================================================
   Types
   ========================================================= */
type ThisWeekRow = {
  user_id: string;
  trader?: string | null;            // optional if your view includes it
  sessions: number | null;
  profit_week: number | null;        // from view
  win_rate: number | null;           // 0..1
  avg_rr?: number | null;
  accountability_score: number | null;
  equity?: number | null;            // may be null/0 in sessions-only setup
};

type ArchiveWeek = {
  week_start: string;
  week_end: string;
};

type ArchiveRow = {
  week_start: string;
  week_end: string;
  user_id: string;
  trader: string | null;
  rank: number;
  sessions: number;
  equity: number;
  profit_week: number;
  win_rate: number | null;
  avg_rr: number | null;
  accountability_score: number | null;
  badge: string | null;
};

/* =========================================================
   Page Component
   ========================================================= */
export default function LeaderboardPage() {
  const [tab, setTab] = useState<"this" | "archive">("this");

  // live this-week data
  const [thisWeekRows, setThisWeekRows] = useState<ThisWeekRow[]>([]);
  // archive helpers
  const [weeks, setWeeks] = useState<ArchiveWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [archiveRows, setArchiveRows] = useState<ArchiveRow[]>([]);
  const [champions, setChampions] = useState<ArchiveRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* ---------------- Load everything on mount ---------------- */
  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      setErr(null);

      // 1) this week view
      const { data: tw, error: twErr } = await supabase
        .from("leaderboard_this_week")
        .select("*");
      if (twErr) {
        if (mounted) setErr(twErr.message);
      } else if (mounted) {
        setThisWeekRows((tw || []) as ThisWeekRow[]);
      }

      // 2) weeks list for archive
      const { data: wk, error: wkErr } = await supabase
        .from("leaderboard_archive_weeks")
        .select("*")
        .order("week_start", { ascending: false });
      if (wkErr) {
        if (mounted) setErr((prev) => prev || wkErr.message);
      } else if (mounted) {
        setWeeks((wk || []) as ArchiveWeek[]);
        if (wk && wk.length && wk[0].week_start) setSelectedWeek(wk[0].week_start);
      }

      // 3) champions list
      const { data: ch, error: chErr } = await supabase
        .from("leaderboard_week_champions")
        .select("*")
        .order("week_start", { ascending: false });
      if (chErr) {
        if (mounted) setErr((prev) => prev || chErr.message);
      } else if (mounted) {
        setChampions((ch || []) as ArchiveRow[]);
      }

      setLoading(false);
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Load archive rows when week changes ---------------- */
  useEffect(() => {
    let mounted = true;
    async function loadWeekRows() {
      if (!selectedWeek) return;
      const { data, error } = await supabase
        .from("leaderboard_weekly_archive")
        .select("*")
        .eq("week_start", selectedWeek)
        .order("rank", { ascending: true });

      if (!mounted) return;
      if (error) setErr((prev) => prev || error.message);
      setArchiveRows((data || []) as ArchiveRow[]);
    }
    loadWeekRows();
    return () => {
      mounted = false;
    };
  }, [selectedWeek]);

  /* ---------------- Shape + sort for This Week table ---------------- */
  const thisWeekRanked = useMemo(() => {
    const list = (thisWeekRows || []).map((r, i) => {
      const sessions = Number(r.sessions || 0);
      const profit = Number(r.profit_week || 0);
      const equity = Number(r.equity || 0);
      const name = r.trader || "Trader";
      return {
        ...r,
        _rank: i + 1,
        sessions,
        profit_week: profit,
        equity,
        trader: name,
        win_rate: r.win_rate ?? 0,
        badge: badgeForSessions(sessions).name,
      };
    });
    // default sort by accountability_score desc, then profit desc, then sessions desc
    list.sort((a, b) => {
      const sa = Number(a.accountability_score ?? 0);
      const sb = Number(b.accountability_score ?? 0);
      if (sb !== sa) return sb - sa;
      if (b.profit_week !== a.profit_week) return b.profit_week - a.profit_week;
      return b.sessions - a.sessions;
    });
    // assign display rank after sort
    return list.map((r, idx) => ({ ...r, _rank: idx + 1 }));
  }, [thisWeekRows]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
        <Link href="/" passHref>
          <Button variant="outline">← Back to Dashboard</Button>
        </Link>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-slate-600">
            <strong>This Week:</strong> live view that resets every Monday (SAST).<br />
            <strong>Archive:</strong> weekly snapshots with rank & badges.
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          className={`px-3 py-2 rounded ${tab === "this" ? "bg-black text-white" : "bg-gray-100"}`}
          onClick={() => setTab("this")}
        >
          This Week
        </button>
        <button
          className={`px-3 py-2 rounded ${tab === "archive" ? "bg-black text-white" : "bg-gray-100"}`}
          onClick={() => setTab("archive")}
        >
          Archive
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">Loading…</CardContent>
        </Card>
      )}
      {!loading && err && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-rose-700">Error: {err}</div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- THIS WEEK ---------------- */}
      {!loading && !err && tab === "this" && (
        <Card>
          <CardContent className="p-0">
            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">
              Live — This Week (SAST)
            </div>

            <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium bg-slate-50">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Trader</div>
              <div className="col-span-2 text-right">Sessions</div>
              <div className="col-span-2 text-right">Profit (Week)</div>
              <div className="col-span-2 text-right">Win Rate</div>
              <div className="col-span-1 text-right">Score</div>
            </div>

            {thisWeekRanked.length ? (
              thisWeekRanked.map((u: any, idx: number) => (
                <div
                  key={`${u.user_id}-${idx}`}
                  className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center bg-white"
                >
                  <div className="col-span-1 font-semibold">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : u._rank}
                  </div>

                  <div className="col-span-4">{u.trader || "Trader"}</div>

                  <div className="col-span-2 text-right">{u.sessions}</div>

                  <div className={`col-span-2 text-right ${u.profit_week >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {u.profit_week.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  </div>

                  <div className="col-span-2 text-right">{pct(u.win_rate)}</div>
                  <div className="col-span-1 text-right">{num(u.accountability_score)}</div>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-slate-600">No entries yet for this week.</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------- ARCHIVE ---------------- */}
      {!loading && !err && tab === "archive" && (
        <>
          {/* Week picker */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Choose week:</span>
            <select
              className="border rounded px-2 py-1"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              {weeks.map((w) => (
                <option key={w.week_start} value={w.week_start}>
                  {rangeLabel(w.week_start, w.week_end)}
                </option>
              ))}
            </select>
          </div>

          {/* Archive table */}
          <Card>
            <CardContent className="p-0">
              <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">
                Archive — {weeks.find(w => w.week_start === selectedWeek) ? rangeLabel(
                  weeks.find(w => w.week_start === selectedWeek)!.week_start,
                  weeks.find(w => w.week_start === selectedWeek)!.week_end
                ) : "Select a week"}
              </div>

              <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium bg-slate-50">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Trader</div>
                <div className="col-span-3">Badge</div>
                <div className="col-span-2 text-right">Sessions</div>
                <div className="col-span-2 text-right">Profit (Week)</div>
              </div>

              {archiveRows.length ? (
                archiveRows.map((u: ArchiveRow, idx: number) => {
                  const badgeObj = inferBadge(u.sessions);
                  const isTop3 = idx < 3;
                  return (
                    <div
                      key={`${u.user_id}-${idx}`}
                      className={`grid grid-cols-12 px-3 py-2 border-t text-sm items-center bg-white ${isTop3 ? "bg-amber-50/40" : ""}`}
                    >
                      <div className="col-span-1 font-semibold">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : u.rank}
                      </div>

                      <div className="col-span-4">{u.trader || "Trader"}</div>

                      <div className="col-span-3 flex items-center gap-2">
                        <img src={badgeObj.imagePath} alt={badgeObj.name} className="h-6 w-6 object-contain" />
                        <span className="text-xs text-slate-700">{u.badge || badgeObj.name}</span>
                      </div>

                      <div className="col-span-2 text-right">{u.sessions}</div>

                      <div className={`col-span-2 text-right ${u.profit_week >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {u.profit_week.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-sm text-slate-600">No archived results for that week.</div>
              )}
            </CardContent>
          </Card>

          {/* Champions strip */}
          <Card>
            <CardContent className="p-0">
              <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">Week Champions</div>
              {champions.length ? (
                champions.map((c, i) => {
                  const badgeObj = inferBadge(c.sessions);
                  return (
                    <div key={`${c.user_id}-${i}`} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center bg-white">
                      <div className="col-span-3">{rangeLabel(c.week_start, c.week_end)}</div>
                      <div className="col-span-6">{c.trader || "Trader"}</div>
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <img src={badgeObj.imagePath} alt={badgeObj.name} className="h-6 w-6 object-contain" />
                        <span className="text-xs text-slate-700">{c.badge || badgeObj.name}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-sm text-slate-600">No champions yet.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

// For archive label
function rangeLabel(a: string, b: string) {
  const A = new Date(a);
  const B = new Date(b);
  return `${A.toLocaleDateString()} → ${B.toLocaleDateString()}`;
}

// Format helpers
function num(n: any) {
  const v = Number(n ?? 0);
  return isFinite(v) ? v.toFixed(2) : "-";
}
function pct(n: any) {
  const v = Number(n ?? 0);
  return isFinite(v) ? `${(v * 100).toFixed(0)}%` : "-";
}

// Badge images + names (client-side mirror)
function badgeForSessions(sessions: number): { name: string; imagePath: string } {
  if (sessions >= 30) return { name: "Legendary • 30 Sessions Untouchable", imagePath: "/badges/legendary.png" };
  if (sessions >= 25) return { name: "Elite • 25 Sessions Mastered", imagePath: "/badges/elite.png" };
  if (sessions >= 20) return { name: "Diamond • 20 Sessions Mastered", imagePath: "/badges/diamond.png" };
  if (sessions >= 15) return { name: "Platinum • 15 Sessions Dominated", imagePath: "/badges/platinum.png" };
  if (sessions >= 10) return { name: "Gold • 10 Sessions Conquered", imagePath: "/badges/gold.png" };
  if (sessions >= 5)  return { name: "Silver • 5 Sessions Survived", imagePath: "/badges/silver.png" };
  return { name: "Starter", imagePath: "/badges/silver.png" };
}
function inferBadge(sessions: number) {
  return badgeForSessions(Number(sessions || 0));
}
