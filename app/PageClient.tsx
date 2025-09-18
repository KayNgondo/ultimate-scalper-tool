"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useSupabaseUser } from "@/lib/useSupabaseUser";
import AuthGate from "@/components/AuthGate";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/* shadcn/ui */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* recharts */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";

/* --------------------------------
   Tiny in-file Toast system
----------------------------------- */
type ToastItem = { id: string; title: string; desc?: string };
const ToastContext = React.createContext<{
  push: (t: Omit<ToastItem, "id">) => void;
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  function push(t: Omit<ToastItem, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { id, ...t };
    setItems((s) => [...s, item]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000);
  }
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border bg-white shadow px-3 py-2 w-72"
            role="status"
          >
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc && <div className="text-xs text-slate-600 mt-0.5">{t.desc}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ===========================================================
   Ultimate Scalper Tool – Full Page (with Old Calendar + Leaderboard)
   =========================================================== */

const MARKET_OPTIONS = [
  "Step Index",
  "Volatility 75 (1s)",
  "Volatility 75",
  "Volatility 25 (1s)",
  "Volatility 25",
  "Withdrawal",
] as const;
type MarketName = (typeof MARKET_OPTIONS)[number];

const STRATEGIES = ["Ultimate M1 Trend setup", "Ultimate M1 Range setup"] as const;
type StrategyName = (typeof STRATEGIES)[number];

type TradeRow = {
  id: string;
  symbol: string;
  pnl: number;
  notes?: string;
  ts?: number;
  risk?: number;
  tags?: string[];
};

type ASetup = { id: string; title: string; dataUrl: string; notes?: string };

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const fmt = (n: number) => (isFinite(n) ? n.toFixed(2) : "0.00");

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function getMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Mon
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameISOWeek(a: Date, b: Date) {
  const ma = getMonday(a).getTime();
  const mb = getMonday(b).getTime();
  return ma === mb;
}

/* LocalStorage helper */
function useLocalStorage<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

/* Lot-size formulas */
function calcLotSize(riskAmount: number, market: MarketName, riskPips: number) {
  const ra = Number(riskAmount) || 0;
  const rp = Number(riskPips) || 0;
  if (ra <= 0 || rp <= 0) return 0;

  switch (market) {
    case "Step Index":
      return +(ra / rp).toFixed(3);

    case "Volatility 75 (1s)":
    case "Volatility 75":
    case "Volatility 25 (1s)":
    case "Volatility 10 (1s)": // handled same as other (1s) markets
      return +((ra / rp) * 100).toFixed(3);

    case "Volatility 25": {
      // This market uses 1/1000 pip scale
      return +(ra / (rp / 1000)).toFixed(3);
    }

    default:
      // Non-tradable rows like "Withdrawals"
      return 0;
  }
}

/* ============ Backend call to record session close ============ */
async function recordSessionToLeaderboard(
  supabaseUserId: string,
  pnl: number,
  startingCapital: number,
  startedAtISO?: string,
  endedAtISO?: string
) {
  try {
    await fetch("/api/sessions/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: supabaseUserId,
        pnl,
        startingCapital,   // NEW: include this
        startedAt: startedAtISO,
        endedAt: endedAtISO,
      }),
    });
  } catch (e) {
    console.error("Failed to insert session:", e);
  }
}

/* =========================
   Root Page (provider first)
   ========================= */
export default function Page() {
  useEffect(() => {
    document.title = "Ultimate Scalper Tool";
  }, []);
  return (
    <ToastProvider>
      <AuthGate>
        <PageInner />
      </AuthGate>
    </ToastProvider>
  );
}

/* =========================================================================
   Main page content
============================================================================ */
function PageInner() {
  const supabase = getBrowserSupabase();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error.message);
    } else {
      window.location.href = "/sign-in";
    }
  }

  const { user } = useSupabaseUser();
  const { push } = useToast();

  /* Core state */
  const [startBalance, setStartBalance] = useLocalStorage<number>("ust-start-balance", 1000);
  const [riskPct, setRiskPct] = useLocalStorage<number>("ust-risk-pct", 5);
  const [trades, setTrades] = useLocalStorage<TradeRow[]>("ust-trades", []);
  const [sessionId, setSessionId] = useLocalStorage<string | null>("ust-session-id", null);

  /* Discipline & Goals */
  const [maxLoss, setMaxLoss] = useLocalStorage<number>("ust-max-loss", 0);
  const [lockOnHit, setLockOnHit] = useLocalStorage<boolean>("ust-lock-on-hit", true);
  const [locked, setLocked] = useLocalStorage<boolean>("ust-locked", false);

  const [weeklyTarget, setWeeklyTarget] = useLocalStorage<number>("ust-weekly-target", 0);
  const [monthlyTarget, setMonthlyTarget] = useLocalStorage<number>("ust-monthly-target", 0);

  /* Equity + Risk */
  const totalPnlAllTime = useMemo(
    () => trades.reduce((acc, t) => acc + (t.pnl || 0), 0),
    [trades]
  );
  const equity = useMemo(() => startBalance + totalPnlAllTime, [startBalance, totalPnlAllTime]);
  const riskAmount = useMemo(() => (equity * riskPct) / 100, [equity, riskPct]);
  const allTimeGrowthPct = startBalance ? ((equity - startBalance) / startBalance) * 100 : 0;

  /* Session-scope */
  const sessionTrades = useMemo(
    () => trades.filter((t) => !sessionId || (t.ts || 0) >= Number(sessionId)),
    [trades, sessionId]
  );
  const pnl = useMemo(() => sessionTrades.reduce((a, t) => a + (t.pnl || 0), 0), [sessionTrades]);
  const closed = sessionTrades.length;
  const wins = sessionTrades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = sessionTrades.filter((t) => (t.pnl || 0) < 0).length;
  const bes = sessionTrades.filter((t) => (t.pnl || 0) === 0).length;
  const winRate = closed ? (wins / closed) * 100 : 0;

  /* Today / Week / Month */
  const today = new Date();
  const todayKey = ymdLocal(today);
  const todayPnl = useMemo(
    () =>
      trades
        .filter((t) => t.ts && ymdLocal(new Date(t.ts)) === todayKey)
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [trades, todayKey]
  );

  // Lock when threshold hit
  const prevLocked = useRef<boolean>(locked);
  useEffect(() => {
    if (!lockOnHit || maxLoss <= 0) return;
    if (todayPnl <= -Math.abs(maxLoss)) {
      if (!locked) {
        setLocked(true);
        push({
          title: "Trading locked for today",
          desc: `Daily max loss (${currency(maxLoss)}) reached.`,
        });
      }
    }
  }, [todayPnl, maxLoss, lockOnHit, locked, setLocked, push]);
  useEffect(() => {
    prevLocked.current = locked;
  }, [locked]);

  // Auto-unlock at local midnight
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(now.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    const ms = Math.max(100, nextMidnight.getTime() - now.getTime());
    const t = setTimeout(() => {
      setLocked(false);
      push({ title: "New day", desc: "Trading unlocked." });
    }, ms);
    return () => clearTimeout(t);
  }, [setLocked, push, todayKey]);

  function resetDailyLock() {
    setLocked(false);
    push({ title: "Lock reset", desc: "Trading unlocked for today." });
  }

  const weeklyProgress = useMemo(
    () =>
      trades
        .filter((t) => t.ts && isSameISOWeek(new Date(t.ts), today))
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [trades]
  );
  const monthlyProgress = useMemo(
    () => trades.filter((t) => t.ts && isSameMonth(new Date(t.ts), today)).reduce((a, t) => a + (t.pnl || 0), 0),
    [trades]
  );

  /* Badges */
  const sessionsCount = useMemo(() => {
    const raw = localStorage.getItem("ust-session-history");
    const hist: string[] = raw ? JSON.parse(raw) : [];
    const uniq = new Set(hist);
    if (sessionId) uniq.add(sessionId);
    return uniq.size;
  }, [sessionId]);

  const [badge, setBadge] = useState<{ name: string; imagePath: string } | null>(null);
  useEffect(() => {
    const s = sessionsCount;
    if (s >= 30) setBadge({ name: "Legendary • 30 Sessions Untouchable", imagePath: "/badges/legendary.png" });
    else if (s >= 25) setBadge({ name: "Elite • 25 Sessions Mastered", imagePath: "/badges/elite.png" });
    else if (s >= 20) setBadge({ name: "Diamond • 20 Sessions Mastered", imagePath: "/badges/diamond.png" });
    else if (s >= 15) setBadge({ name: "Platinum • 15 Sessions Dominated", imagePath: "/badges/platinum.png" });
    else if (s >= 10) setBadge({ name: "Gold • 10 Sessions Conquered", imagePath: "/badges/gold.png" });
    else if (s >= 5) setBadge({ name: "Silver • 5 Sessions Survived", imagePath: "/badges/silver.png" });
    else setBadge(null);
  }, [sessionsCount]);

  /* Equity series (all time) */
  const equitySeries = useMemo(() => {
    const sorted = [...trades].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const pts: { t: string; equity: number }[] = [];
    let running = startBalance;
    if (sorted.length) pts.push({ t: new Date(sorted[0].ts || Date.now()).toLocaleTimeString(), equity: running });
    sorted.forEach((tr) => {
      running += tr.pnl || 0;
      pts.push({ t: new Date(tr.ts || Date.now()).toLocaleTimeString(), equity: Number(running.toFixed(2)) });
    });
    if (!pts.length) pts.push({ t: "Start", equity: startBalance });
    return pts;
  }, [trades, startBalance]);

  /* Trades helpers */
  function addTrade(t: Omit<TradeRow, "id" | "ts">) {
    if (locked && lockOnHit) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row: TradeRow = { id, ts: Date.now(), ...t };
    setTrades([row, ...trades]);
  }
  function deleteTrade(id: string) {
    setTrades(trades.filter((t) => t.id !== id));
  }
  function newSessionId() {
    const ts = String(Date.now());
    setSessionId(ts);
    const raw = localStorage.getItem("ust-session-history");
    const hist: string[] = raw ? JSON.parse(raw) : [];
    if (!hist.includes(ts)) {
      hist.push(ts);
      localStorage.setItem("ust-session-history", JSON.stringify(hist));
    }
    return ts;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold">
            Ultimate Scalper Tool – Strategy Console
          </h1>
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
              locked && lockOnHit
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
            title={locked && lockOnHit ? "Trading locked for today (max loss hit)" : "Active"}
          >
            <span className={`h-2 w-2 rounded-full ${locked && lockOnHit ? "bg-rose-500" : "bg-emerald-500"}`} />
            {locked && lockOnHit ? "Locked" : "Active"}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
<Button
  onClick={async () => {
    try {
      const userId = user?.id;
      const pnlNumber = Number(pnl || 0);
      const startedAtISO = new Date(Number(sessionId)).toISOString(); // session start
      const endedAtISO = new Date().toISOString();

      if (userId) {
        // ✅ Call your new API route to save the session into Supabase
        await fetch("/api/sessions/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,              // Supabase user id
            sessionPnl: pnlNumber,
            startingCapital: startBalance,
            startedAt: startedAtISO,
            endedAt: endedAtISO,
          }),
        });
      }

      // Reset to new session locally
      newSessionId();
    } catch (e) {
      console.error("Error ending session:", e);
      newSessionId();
    }
  }}
>
  End Session / Start New
</Button>



          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList className="mb-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="risk">Risk &amp; Sizing</TabsTrigger>
          <TabsTrigger value="journal">Trade Journal</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="asetups">A-Setups</TabsTrigger>

          {/* External link to dedicated page */}
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Leaderboard
          </Link>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <DashCard title="Win rate" value={`${fmt(winRate)}%`} hint={`${wins}W / ${losses}L / ${bes}BE`} />
            <DashCard title="PNL (this session)" value={currency(pnl)} hint={`Closed trades: ${closed}`} />
            <DashCard title="Sessions" value={`${sessionsCount}`} hint={badge ? badge.name : "Starter"} />
            <DashCard title="Equity" value={currency(equity)} hint={`Start: ${currency(startBalance)}`} />
          </div>

          {/* SUMMARY ROW */}
          <div className="grid md:grid-cols-3 gap-4">
            <DashCard title="Starting Capital" value={currency(startBalance)} />
            <DashCard
              title="All-time PnL"
              value={`${totalPnlAllTime >= 0 ? "+" : ""}${currency(Number(totalPnlAllTime.toFixed(2)))}`}
            />
            <DashCard title="All-time Growth" value={`${fmt(allTimeGrowthPct)}%`} hint="Based on starting capital" />
          </div>

          {/* Discipline & Goals */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <h4 className="text-lg font-semibold">Session Discipline</h4>
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <Label>Daily Max Loss (USD)</Label>
                    <Input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value))} />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Stop trading at -Max Loss</Label>
                    <Select value={String(lockOnHit)} onValueChange={(v: string) => setLockOnHit(v === "true")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Enabled</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>Today PnL</Label>
                    <div
                      className={`h-10 grid place-items-center rounded-md border ${
                        todayPnl < 0 ? "bg-red-50" : todayPnl > 0 ? "bg-blue-50" : "bg-white"
                      }`}
                    >
                      <strong>
                        {todayPnl >= 0 ? "+" : ""}
                        {currency(Number(todayPnl.toFixed(2)))}
                      </strong>
                    </div>
                  </div>
                </div>
                <div
                  className={`rounded-md border p-3 text-sm ${
                    locked && lockOnHit
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>Status:</strong> {locked && lockOnHit ? "Locked for today (max loss hit)" : "Active"}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetDailyLock}>
                        Reset Lock
                      </Button>
                      {locked && lockOnHit && (
                        <Button
                          onClick={() => {
                            setLockOnHit(false);
                            push({ title: "Override", desc: "Lock disabled for today." });
                          }}
                        >
                          Override (Disable lock)
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  When enabled, Quick Logger and New Trade are disabled once today&apos;s PnL ≤ -Daily Max Loss.
                  Auto-unlocks at local midnight.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h4 className="text-lg font-semibold">Goals</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Weekly Target (USD)</Label>
                    <Input type="number" value={weeklyTarget} onChange={(e) => setWeeklyTarget(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Monthly Target (USD)</Label>
                    <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value))} />
                  </div>
                </div>
                <GoalProgress label="Weekly Progress" progress={Number(weeklyProgress.toFixed(2))} target={weeklyTarget || 0} />
                <GoalProgress label="Monthly Progress" progress={Number(monthlyProgress.toFixed(2))} target={monthlyTarget || 0} />
              </CardContent>
            </Card>
          </div>

          {/* Badge + Equity */}
          <BadgeShowcase badge={badge} sessionsCount={sessionsCount} />
          <Card>
            <CardContent className="p-5">
              <h4 className="text-lg font-semibold mb-2">Equity Curve (All Time)</h4>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equitySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" />
                    <YAxis />
                    <RTooltip />
                    <Line type="monotone" dataKey="equity" stroke="#2563eb" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYZER */}
        <TabsContent value="analyzer" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <SetupAnalyzer />
            <MarketAnalyzer riskAmount={riskAmount} />
          </div>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <AnalyticsPanel trades={trades} />
        </TabsContent>

        {/* RISK & SIZING */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <Label>Starting Capital</Label>
                <Input
                  type="number"
                  value={startBalance}
                  onChange={(e) => setStartBalance(Number(e.target.value))}
                  disabled={trades.length > 0}
                />
                {trades.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    Locked after first trade{" "}
                    <button
                      className="underline text-rose-600"
                      onClick={() => {
                        if (confirm("Reset ALL trades and sessions and unlock starting capital?")) {
                          localStorage.removeItem("ust-trades");
                          localStorage.removeItem("ust-session-id");
                          localStorage.removeItem("ust-session-history");
                          location.reload();
                        }
                      }}
                    >
                      Reset equity
                    </button>
                  </div>
                )}
              </div>
              <div className="md:col-span-1">
                <Label>Risk % per Trade</Label>
                <Input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
              </div>
              <InfoStat label="Current Equity" value={currency(equity)} />
              <InfoStat label="Risk Amount (auto)" value={currency(riskAmount)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-lg font-semibold">Per-Market Lot Size</h4>
              <p className="text-sm text-slate-600">Enter risk pips for each market. Risk amount uses current equity × risk%.</p>
              <div className="space-y-3">
                {MARKET_OPTIONS.map((mkt) => (
                  <MarketSizerRow key={mkt} market={mkt} riskAmount={riskAmount} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JOURNAL */}
        <TabsContent value="journal" className="space-y-4">
          {locked && lockOnHit && (
            <Card>
              <CardContent className="p-3 text-sm text-rose-700 bg-rose-50 border-rose-200">
                Trading is locked for today (max loss hit). Adjust settings on Dashboard to override.
              </CardContent>
            </Card>
          )}
          <MultiQuickLogger
            initialRows={3}
            maxRows={4}
            locked={locked && lockOnHit}
            onLogged={(rows) => {
              if (locked && lockOnHit) return;
              rows.forEach((row) => addTrade({ symbol: row.market, notes: row.strategy, pnl: row.pnl }));
            }}
          />
          <JournalGrouped trades={trades} onDelete={deleteTrade} sessionId={sessionId} />
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar">
          <OldCalendar trades={trades} />
        </TabsContent>

        {/* A-SETUPS */}
        <TabsContent value="asetups">
          <ASetupsGallery />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== UI helpers ============== */
function DashCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-slate-600">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </CardContent>
    </Card>
  );
}
function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/* ============== Big Badge ============== */
function BadgeShowcase({
  badge,
  sessionsCount,
}: {
  badge: { name: string; imagePath: string } | null;
  sessionsCount: number;
}) {
  const tiers = [
    { key: "Silver", name: "Silver • 5 Sessions Survived", at: 5, img: "/badges/silver.png" },
    { key: "Gold", name: "Gold • 10 Sessions Conquered", at: 10, img: "/badges/gold.png" },
    { key: "Platinum", name: "Platinum • 15 Sessions Dominated", at: 15, img: "/badges/platinum.png" },
    { key: "Diamond", name: "Diamond • 20 Sessions Mastered", at: 20, img: "/badges/diamond.png" },
    { key: "Elite", name: "Elite • 25 Sessions Mastered", at: 25, img: "/badges/elite.png" },
    { key: "Legendary", name: "Legendary • 30 Sessions Untouchable", at: 30, img: "/badges/legendary.png" },
  ];
  const current =
    badge ?? (sessionsCount >= 5 ? { name: tiers[0].name, imagePath: tiers[0].img } : null);
  const nextTier = tiers.find((t) => sessionsCount < t.at);
  const pct = nextTier ? Math.min(100, Math.round((sessionsCount / nextTier.at) * 100)) : 100;
  const left = nextTier ? Math.max(0, nextTier.at - sessionsCount) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid md:grid-cols-3 gap-5 items-center">
          <div className="flex justify-center">
            <div className="w-36 h-44 rounded-md border bg-white grid place-items-center overflow-hidden">
              <img
                src={current?.imagePath || "/badges/silver.png"}
                alt={current?.name || "Silver"}
                className="object-contain w-32 h-40"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xl font-semibold">{current?.name || "Starter • Keep building sessions"}</div>
            <div className="text-sm text-slate-600 mt-1">
              Sessions completed: <strong>{sessionsCount}</strong>
            </div>
            {nextTier ? (
              <>
                <div className="text-sm text-slate-600 mt-2">
                  Next badge: <strong>{nextTier.key}</strong> at {nextTier.at} sessions.
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                  <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {left} more session(s) to {nextTier.key}.
                </div>
              </>
            ) : (
              <div className="text-sm text-emerald-600 mt-3">You’ve reached the top tier. 🏆</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== Risk rows ============== */
function MarketSizerRow({ market, riskAmount }: { market: MarketName; riskAmount: number }) {
  const storageKey = `ust-riskpips-${market}`;
  const [riskPips, setRiskPips] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    return raw ? Number(raw) : 0;
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(riskPips || 0));
    }
  }, [storageKey, riskPips]);

  const lot = calcLotSize(riskAmount, market, riskPips);

  return (
    <div className="grid md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-white/60">
      <div className="md:col-span-5 font-medium">{market}</div>
      <div className="md:col-span-3">
        <Label>Risk Pips</Label>
        <Input type="number" value={riskPips} onChange={(e) => setRiskPips(Number(e.target.value))} />
      </div>
      <div className="md:col-span-4">
        <Label>Lot Size (auto)</Label>
        <div className="h-10 grid place-items-center rounded-md border bg-white">
          <strong>{lot}</strong>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Risk: {currency(riskAmount)}</div>
      </div>
    </div>
  );
}

/* ============== Multi Quick Logger ============== */
function MultiQuickLogger({
  initialRows = 3,
  maxRows = 4,
  locked,
  onLogged,
}: {
  initialRows?: number;
  maxRows?: number;
  locked?: boolean;
  onLogged: (rows: { market: MarketName; strategy: StrategyName; pnl: number }[]) => void;
}) {
  type Pending = { id: string; market: MarketName; strategy: StrategyName; pnl: number };
  const emptyRow = (): Pending => ({
    id: `${Math.random().toString(36).slice(2, 8)}`,
    market: "Volatility 75 (1s)",
    strategy: "Ultimate M1 Trend setup",
    pnl: 0,
  });

  const [rows, setRows] = useState<Pending[]>(Array.from({ length: initialRows }, emptyRow));

  function updateRow(id: string, patch: Partial<Pending>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeRow(id: string) {
    setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  }

  function logAll() {
    if (locked) return;
    const valid = rows.filter((r) => !isNaN(r.pnl));
    if (!valid.length) return;
    onLogged(valid);
    setRows([emptyRow(), ...rows.slice(0, initialRows - 1)]);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Quick Logger (up to {maxRows})</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={rows.length >= maxRows || locked}
              onClick={() => setRows([...rows, emptyRow()])}
            >
              + Add Slot
            </Button>
            <Button onClick={logAll} disabled={locked}>
              Log All
            </Button>
          </div>
        </div>
        {locked && <div className="text-xs text-rose-700">Locked due to daily max loss. Adjust on Dashboard.</div>}
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={`grid md:grid-cols-12 gap-3 items-end rounded-lg border p-3 ${
                locked ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <div className="md:col-span-1 text-xs text-slate-500">#{idx + 1}</div>

              <div className="md:col-span-3">
                <Label>Market</Label>
                <Select value={r.market} onValueChange={(v: string) => updateRow(r.id, { market: v as MarketName })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKET_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-5">
                <Label>Strategy</Label>
                <Select
                  value={r.strategy}
                  onValueChange={(v: string) => updateRow(r.id, { strategy: v as StrategyName })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>PnL (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={r.pnl}
                  onChange={(e) => updateRow(r.id, { pnl: Number(e.target.value) })}
                />
              </div>

              <div className="md:col-span-1">
                <Button variant="destructive" onClick={() => removeRow(r.id)} disabled={locked}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== Journal Grouped by Session ============== */
function JournalGrouped({
  trades,
  onDelete,
  sessionId,
}: {
  trades: TradeRow[];
  onDelete: (id: string) => void;
  sessionId: string | null;
}) {
  const histRaw = typeof window !== "undefined" ? localStorage.getItem("ust-session-history") : "[]";
  const hist: string[] = histRaw ? JSON.parse(histRaw) : [];
  const sessionsSorted = [...hist].map(Number).sort((a, b) => a - b);

  const buckets: { title: string; rows: TradeRow[] }[] = [];
  const all = [...trades].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  function titleFor(ts: number, idx: number) {
    const d = new Date(ts);
    return `Session ${idx + 1} (${d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })})`;
  }

  if (sessionsSorted.length) {
    for (let i = 0; i < sessionsSorted.length; i++) {
      const start = sessionsSorted[i];
      const end = i < sessionsSorted.length - 1 ? sessionsSorted[i + 1] : Infinity;
      const rows = all.filter((t) => (t.ts || 0) >= start && (t.ts || 0) < end);
      if (rows.length) buckets.push({ title: titleFor(start, i), rows });
    }
  } else {
    if (all.length) buckets.push({ title: "All Trades", rows: all });
  }

  const totalAll = (rows: TradeRow[]) => rows.reduce((a, t) => a + (t.pnl || 0), 0);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium flex items-center justify-between">
          <div>Trade Journal (grouped by session)</div>
          <Button variant="outline" onClick={() => exportCsv(trades)}>
            Export CSV
          </Button>
        </div>

        {buckets.length ? (
          buckets
            .slice()
            .reverse()
            .map((b, i) => (
              <div key={i} className="border-b">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium bg-white">
                  <div>{b.title}</div>
                  <div className={`${totalAll(b.rows) >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                    {totalAll(b.rows) >= 0 ? "+" : ""}
                    {currency(totalAll(b.rows))}
                  </div>
                </div>

                <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium bg-slate-50">
                  <div className="col-span-3">Time</div>
                  <div className="col-span-3">Market</div>
                  <div className="col-span-4">Strategy / Notes</div>
                  <div className="col-span-1 text-right">PnL</div>
                  <div className="col-span-1 text-right pr-1">Actions</div>
                </div>

                {b.rows
                  .slice()
                  .reverse()
                  .map((t) => (
                    <div key={t.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm">
                      <div className="col-span-3">{t.ts ? new Date(t.ts).toLocaleString() : "—"}</div>
                      <div className="col-span-3">{t.symbol}</div>
                      <div className="col-span-4">{t.notes || "—"}</div>
                      <div className={`col-span-1 text-right ${t.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.pnl >= 0 ? "+" : ""}
                        {currency(t.pnl)}
                      </div>
                      <div className="col-span-1 text-right">
                        <Button variant="destructive" onClick={() => onDelete(t.id)} size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ))
        ) : (
          <div className="p-4 text-sm text-slate-600">No trades yet. Use Quick Logger above.</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== Analytics ============== */
function AnalyticsPanel({ trades }: { trades: TradeRow[] }) {
  const byStrategy = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach((t) => {
      const key = t.notes === "Ultimate M1 Range setup" ? "Ultimate M1 Range setup" : "Ultimate M1 Trend setup";
      map[key] = (map[key] || 0) + (t.pnl || 0);
    });
    return Object.entries(map).map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
  }, [trades]);

  const byMarket = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach((t) => {
      const key = t.symbol || "Unknown";
      map[key] = (map[key] || 0) + (t.pnl || 0);
    });
    return Object.entries(map).map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
  }, [trades]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5">
          <h4 className="text-lg font-semibold mb-2">PnL by Strategy (All Time)</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStrategy}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="pnl" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h4 className="text-lg font-semibold mb-2">PnL by Market (All Time)</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMarket}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="pnl" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== Setup Analyzer ============== */
function SetupAnalyzer() {
  type SetupKind = "Trend Buy" | "Trend Sell" | "Range Buy" | "Range Sell";
  const [setup, setSetup] = useState<SetupKind>("Trend Buy");

  const [ck, setCk] = useState<Record<string, boolean>>({
    emaPos: false,
    sslAligned: false,
    arrow: false,
    moneyFlow: false,
    modAtr: false,
    ranging: false,
    sr: false,
    edge: false,
  });

  const pass =
    (setup === "Trend Buy" && ck.emaPos && ck.sslAligned && ck.arrow && ck.moneyFlow && ck.modAtr) ||
    (setup === "Trend Sell" && ck.emaPos && ck.sslAligned && ck.arrow && ck.moneyFlow && ck.modAtr) ||
    (setup === "Range Buy" && ck.ranging && ck.sr && ck.edge) ||
    (setup === "Range Sell" && ck.ranging && ck.sr && ck.edge);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="text-lg font-semibold">Setup Analyzer</h4>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Setup</Label>
            <Select value={setup} onValueChange={(v: string) => setSetup(v as SetupKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Trend Buy">Ultimate Trend Buy A-Setup</SelectItem>
                <SelectItem value="Trend Sell">Ultimate Trend Sell A-Setup</SelectItem>
                <SelectItem value="Range Buy">Ultimate Range Buy A-Setup</SelectItem>
                <SelectItem value="Range Sell">Ultimate Range Sell A-Setup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 rounded-lg border bg-white p-3">
            {setup.includes("Trend") ? (
              <div className="grid gap-2">
                <Chk label={setup === "Trend Buy" ? "Price above EMA 315" : "Price below EMA 315"} k="emaPos" ck={ck} setCk={setCk} />
                <Chk label={setup === "Trend Buy" ? "SSL above EMA 315" : "SSL below EMA 315"} k="sslAligned" ck={ck} setCk={setCk} />
                <Chk label={setup === "Trend Buy" ? "Green Buy Arrow" : "Red Sell Arrow"} k="arrow" ck={ck} setCk={setCk} />
                <Chk label="Money Flow cross near 20/80" k="moneyFlow" ck={ck} setCk={setCk} />
                <Chk label={setup === "Trend Buy" ? "Close above MOD ATR (Red)" : "Close below MOD ATR (Green)"} k="modAtr" ck={ck} setCk={setCk} />
              </div>
            ) : (
              <div className="grid gap-2">
                <Chk label={setup === "Range Buy" ? "Market ranging above EMA 315" : "Market ranging below EMA 315"} k="ranging" ck={ck} setCk={setCk} />
                <Chk label="Support & Resistance in same areas" k="sr" ck={ck} setCk={setCk} />
                <Chk label={setup === "Range Buy" ? "Buying at bottom of range" : "Selling at top of range"} k="edge" ck={ck} setCk={setCk} />
              </div>
            )}
          </div>
        </div>

        <div
          className={`rounded-lg p-3 text-sm ${
            pass ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
          }`}
        >
          <strong>{pass ? "GO" : "NO-GO"}:</strong>{" "}
          {pass ? "All key checklist items passed for this setup." : "One or more required checklist items are not met."}
        </div>
      </CardContent>
    </Card>
  );
}
function Chk({
  label,
  k,
  ck,
  setCk,
}: {
  label: string;
  k: string;
  ck: Record<string, boolean>;
  setCk: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={ck[k]}
        onChange={(e) => setCk((s) => ({ ...s, [k]: e.target.checked }))}
      />
      <span>{label}</span>
    </label>
  );
}

/* ============== Market Analyzer ============== */
function MarketAnalyzer({ riskAmount }: { riskAmount: number }) {
  const [market, setMarket] = useState<MarketName>("Volatility 75 (1s)");
  const [mode, setMode] = useState<"Trending" | "Ranging">("Trending");
  const [riskPips, setRiskPips] = useState<number>(0);

  const lot = calcLotSize(riskAmount, market, riskPips);
  const suggestion = mode === "Trending" ? "Ultimate M1 Trend setup" : "Ultimate M1 Range setup";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="text-lg font-semibold">Market Analyzer</h4>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Market</Label>
            <Select value={market} onValueChange={(v: string) => setMarket(v as MarketName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKET_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>State</Label>
            <Select value={mode} onValueChange={(v: string) => setMode(v as "Trending" | "Ranging")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Trending">Trending</SelectItem>
                <SelectItem value="Ranging">Ranging</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Risk Pips</Label>
            <Input type="number" value={riskPips} onChange={(e) => setRiskPips(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <InfoStat label="Risk Amount (auto)" value={currency(riskAmount)} />
          <InfoStat label="Lot Size (auto)" value={String(lot)} />
          <InfoStat label="Suggested Strategy" value={suggestion} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== A-Setups ============== */
function ASetupsGallery() {
  const [items, setItems] = useLocalStorage<ASetup[]>("ust-asetups", []);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function addItem() {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const id = `${Date.now()}-${Math.random().toString(36).slice(0, 6)}`;
    setItems([{ id, title: title || file.name, dataUrl, notes }, ...items]);
    setTitle("");
    setNotes("");
    setFile(null);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="p-4 grid md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ultimate Trend Buy A-Setup" />
          </div>
          <div className="md:col-span-5">
            <Label>Notes / Checklist</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Price above EMA315, SSL above EMA315, …" />
          </div>
          <div className="md:col-span-2">
            <Label>Image</Label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="md:col-span-2 self-end">
            <Button disabled={!file} onClick={addItem}>
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      {!items.length && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            Upload screenshots for your A-Setups once. Review them at the start of every session.
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold">{it.title}</div>
              <img
                src={it.dataUrl}
                alt={it.title}
                className="w-full rounded-md border object-contain"
              />
              {it.notes && <div className="text-xs text-slate-600">{it.notes}</div>}
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type });
  return await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(blob);
  });
}

/* ============== CSV Export ============== */
function exportCsv(trades: TradeRow[]) {
  try {
    const headers = ["time", "market", "strategy", "pnl"];
    const rows = trades.map((t) => [
      t.ts ? new Date(t.ts).toISOString() : "",
      t.symbol || "",
      t.notes || "",
      (t.pnl || 0).toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ultimate-scalper-trades-${ymdLocal(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
  }
}
function csvEscape(s: string) {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ============== Goal progress bar ============== */
function GoalProgress({
  label,
  progress,
  target,
}: {
  label: string;
  progress: number; // current PnL within the period
  target: number;   // goal for the period
}) {
  const pct = useMemo(() => {
    if (!target || !isFinite(target)) return 0;
    return Math.max(0, Math.min(100, (progress / target) * 100));
  }, [progress, target]);

  const reached = target > 0 && progress >= target;

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-end justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-600">
          {target ? `${pct.toFixed(0)}%` : "—"}
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
        <div
          className={`h-2 transition-all ${reached ? "bg-emerald-600" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
        <span>Progress: <strong>{currency(Number(progress.toFixed(2)))}</strong></span>
        <span>Target: <strong>{currency(Number((target || 0).toFixed(2)))}</strong></span>
      </div>

      {reached && (
        <div className="mt-1 text-[11px] text-emerald-700">
          🎯 Goal reached for this period — nice work!
        </div>
      )}
    </div>
  );
}

/* =========================
   Old Calendar Component (with Daily PnL)
   ========================= */
function OldCalendar({ trades }: { trades: { ts?: number; pnl?: number }[] }) {
  // Sum PnL per yyyy-mm-dd
  const { tradeDays, dailyTotals } = useMemo(() => {
    const set = new Set<string>();
    const totals = new Map<string, number>();
    trades.forEach((t) => {
      if (!t.ts) return;
      const d = new Date(t.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      set.add(key);
      const prev = totals.get(key) || 0;
      totals.set(key, prev + (t.pnl ?? 0));
    });
    return { tradeDays: set, dailyTotals: totals };
  }, [trades]);

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function startOfCalendar(d: Date) {
    const x = startOfMonth(d);
    const dow = (x.getDay() + 6) % 7; // Monday=0
    x.setDate(x.getDate() - dow);
    return x;
  }

  const days = useMemo(() => {
    const start = startOfCalendar(viewDate);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      arr.push(x);
    }
    return arr;
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function keyOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  const todayKey = keyOf(new Date());
  const viewMonth = viewDate.getMonth();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            onClick={() => {
              const d = new Date(viewDate);
              d.setMonth(d.getMonth() - 1);
              setViewDate(startOfMonth(d));
            }}
          >
            ← Prev
          </Button>

        <div className="text-lg font-semibold">{monthLabel}</div>

          <Button
            variant="outline"
            onClick={() => {
              const d = new Date(viewDate);
              d.setMonth(d.getMonth() + 1);
              setViewDate(startOfMonth(d));
            }}
          >
            Next →
          </Button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium text-slate-600 mb-1">
          <div className="p-2 text-center">Mon</div>
          <div className="p-2 text-center">Tue</div>
          <div className="p-2 text-center">Wed</div>
          <div className="p-2 text-center">Thu</div>
          <div className="p-2 text-center">Fri</div>
          <div className="p-2 text-center">Sat</div>
          <div className="p-2 text-center">Sun</div>
        </div>

        <div className="grid grid-cols-7 gap-[6px]">
          {days.map((d, i) => {
            const k = keyOf(d);
            const inMonth = d.getMonth() === viewMonth;
            const isToday = k === todayKey;
            const hasTrades = tradeDays.has(k);
            const dayPnl = dailyTotals.get(k) ?? 0;

            return (
              <div
                key={i}
                className={[
                  "h-20 rounded-md border p-2 flex flex-col justify-between bg-white",
                  inMonth ? "" : "opacity-40",
                  isToday ? "border-indigo-500 ring-2 ring-indigo-200" : "",
                ].join(" ")}
                title={hasTrades ? `${dayPnl >= 0 ? "+" : ""}${currency(Number(dayPnl.toFixed(2)))}` : undefined}
              >
                <div className="text-xs">{d.getDate()}</div>

                {hasTrades && (
                  <div className="flex justify-end">
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                        dayPnl > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : dayPnl < 0
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-50 text-slate-700 border-slate-200",
                      ].join(" ")}
                    >
                      {dayPnl >= 0 ? "+" : ""}
                      {currency(Number(dayPnl.toFixed(2)))}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
