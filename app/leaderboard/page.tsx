"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LBViewRow = {
  user_id: string;
  sessions: number | null;       // aggregated session count
  total_pnl: number | null;      // aggregated PnL
  starting_capital?: number | null; // if your view includes it
  last_session_at?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LBViewRow[] | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);

      // 1) Fetch leaderboard aggregates
      //    Change "leaderboard_view" below to "leaderboard" if that’s your table name.
      const { data: lb, error: lbErr } = await supabase
        .from("leaderboard_view")
        .select("*")
        .limit(100);

      if (lbErr) {
        // If your project uses a plain table instead of a view, try fallback:
        const fallback = await supabase.from("leaderboard").select("*").limit(100);
        if (fallback.error) {
          if (mounted) {
            setErr(lbErr.message || fallback.error.message);
            setRows([]);
            setProfiles([]);
            setLoading(false);
          }
          return;
        } else {
          if (mounted) setRows(fallback.data as LBViewRow[]);
        }
      } else {
        if (mounted) setRows(lb as LBViewRow[]);
      }

      // 2) Fetch names for those users from profiles
      const userIds = (lb || []).map((r: any) => r.user_id);
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", userIds);

        if (pErr) {
          if (mounted) setErr(pErr.message);
        } else {
          if (mounted) setProfiles(profs as ProfileRow[]);
        }
      } else {
        if (mounted) setProfiles([]);
      }

      if (mounted) setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Map profiles by id for quick lookup
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (profiles || []).forEach((p) => {
      if (p?.id) m.set(p.id, p.full_name || "");
    });
    return m;
  }, [profiles]);

  // Shape + sort leaderboard rows
  const ranked = useMemo(() => {
    const list = (rows || []).map((r) => {
      const sessions = Number(r.sessions || 0);
      const totalPnL = Number(r.total_pnl || 0);
      const start = Number(r.starting_capital || 0); // if view does not have it, stays 0
      const equity = Number((start + totalPnL).toFixed(2));
      const full_name = nameById.get(r.user_id) || "Trader";
      const badge = badgeForSessions(sessions);
      return { ...r, sessions, totalPnL, start, equity, full_name, badge };
    });

    // sort by equity desc, then sessions desc, then last active desc
    list.sort((a, b) => {
      if (b.equity !== a.equity) return b.equity - a.equity;
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;
      const ta = a.last_session_at ? Date.parse(a.last_session_at) : 0;
      const tb = b.last_session_at ? Date.parse(b.last_session_at) : 0;
      return tb - ta;
    });

    return list;
  }, [rows, nameById]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
        <Link href="/" passHref>
          <Button variant="outline">← Back to Dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-slate-600">
            Ranked by <strong>Equity</strong> (Starting Capital + Total PnL). Ties break on{" "}
            <strong>Sessions</strong>, then recency.
          </p>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">Loading…</CardContent>
        </Card>
      )}

      {err && !loading && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-rose-700">Error: {err}</div>
          </CardContent>
        </Card>
      )}

      {!loading && !err && (
        <Card>
          <CardContent className="p-0">
            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">Rankings</div>

            <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium bg-slate-50">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Trader</div>
              <div className="col-span-3">Badge</div>
              <div className="col-span-2 text-right">Sessions</div>
              <div className="col-span-2 text-right">Equity</div>
            </div>

            {ranked.length ? (
              ranked.map((u: any, idx: number) => (
                <div
                  key={`${u.user_id}-${idx}`}
                  className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center bg-white"
                >
                  <div className="col-span-1 font-semibold">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </div>

                  <div className="col-span-4">{u.full_name || "Trader"}</div>

                  <div className="col-span-3 flex items-center gap-2">
                    <img
                      src={u.badge.imagePath}
                      alt={u.badge.name}
                      className="h-6 w-6 object-contain"
                    />
                    <span className="text-xs text-slate-700">{u.badge.name}</span>
                  </div>

                  <div className="col-span-2 text-right">{u.sessions}</div>

                  <div
                    className={`col-span-2 text-right ${
                      u.equity >= (u.start || 0) ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {u.equity.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-slate-600">No leaderboard entries yet.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* Shared badge logic */
function badgeForSessions(sessions: number): { name: string; imagePath: string } {
  if (sessions >= 30) return { name: "Legendary • 30 Sessions Untouchable", imagePath: "/badges/legendary.png" };
  if (sessions >= 25) return { name: "Elite • 25 Sessions Mastered", imagePath: "/badges/elite.png" };
  if (sessions >= 20) return { name: "Diamond • 20 Sessions Mastered", imagePath: "/badges/diamond.png" };
  if (sessions >= 15) return { name: "Platinum • 15 Sessions Dominated", imagePath: "/badges/platinum.png" };
  if (sessions >= 10) return { name: "Gold • 10 Sessions Conquered", imagePath: "/badges/gold.png" };
  if (sessions >= 5)  return { name: "Silver • 5 Sessions Survived", imagePath: "/badges/silver.png" };
  return { name: "Starter", imagePath: "/badges/silver.png" };
}
