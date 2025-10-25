
/* PageClient.tsx — Ultimate Scalper Tool (3× Risk & Sizing + Combobox Logger) */
"use client";

import { useEffect, useMemo, useState, useContext } from "react";
import AuthGate from "@/components/AuthGate";
import { useSupabaseUser } from "@/lib/useSupabaseUser";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

/* ========== shadcn/ui ========== */
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

/* New: solid, searchable combobox pieces */
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";

/* ========== recharts ========== */
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

/* =========================================================================
   Tiny Toasts (local, no external deps)
============================================================================ */
type ToastItem = { id: string; title: string; desc?: string };
import React from "react";
const ToastContext = React.createContext<{
  push: (t: Omit<ToastItem, "id">) => void;
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  function push(t: Omit<ToastItem, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((s) => [...s, { id, ...t }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000);
  }
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {items.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white shadow px-3 py-2 w-72">
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc && <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t.desc}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* =========================================================================
   Utils / State
============================================================================ */
type TradeRow = {
  id: string;
  symbol: string;
  pnl: number;
  notes?: string;
  ts?: number;
};

const MARKET_OPTIONS = [
  "Step Index",
  "Volatility 75 (1s)",
  "Volatility 75",
  "Volatility 25 (1s)",
  "Volatility 25",
  "Volatility 10 (1s)",
  "Withdrawals",
] as const;
type MarketName = (typeof MARKET_OPTIONS)[number];

const STRATEGIES = [
  "Ultimate M1 Trend setup",
  "Ultimate M1 Range setup",
  "Withdrawals",
] as const;
type StrategyName = (typeof STRATEGIES)[number];

type ASetup = { id: string; title: string; dataUrl: string; notes?: string };

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

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const fmt = (n: number) => (isFinite(n) ? n.toFixed(2) : "0.00");

// % helper — returns "12.34%" or null if denominator invalid
function formatPct(numerator: number, denominator?: number | null) {
  const den = Number(denominator) || 0;
  if (den <= 0) return null;
  return `${((Number(numerator) / den) * 100).toFixed(2)}%`;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameISOWeek(a: Date, b: Date) {
  return getMonday(a).getTime() === getMonday(b).getTime();
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/* Lot-size formulas — Deriv */
function calcLotSizeDeriv(riskAmount: number, market: MarketName, riskPips: number) {
  const ra = Number(riskAmount) || 0;
  const rp = Number(riskPips) || 0;
  if (ra <= 0 || rp <= 0) return 0;

  switch (market) {
    case "Step Index":
      return +(ra / rp).toFixed(3);

    case "Volatility 75 (1s)":
    case "Volatility 75":
    case "Volatility 25 (1s)":
    case "Volatility 10 (1s)":
      return +((ra / rp) * 100).toFixed(3);

    case "Volatility 25":
      return +(ra / (rp / 1000)).toFixed(3);

    default:
      return 0; // Withdrawals
  }
}

/* Universal lot-size formula (FX / Metals / Indices / Crypto)
   Lot = riskAmount / (riskPips * pipValuePerLotUSD)
*/
function calcLotSizeUniversal(
  riskAmount: number,
  riskPips: number,
  pipValuePerLotUSD: number
) {
  const ra = Number(riskAmount) || 0;
  const rp = Number(riskPips) || 0;
  const pv = Number(pipValuePerLotUSD) || 0;
  if (ra <= 0 || rp <= 0 || pv <= 0) return 0;
  return +(ra / (rp * pv)).toFixed(3);
}

/* Send session close → API (Supabase RPC behind it) */
async function recordSessionToLeaderboard(
  supabaseUserId: string,
  pnl: number,
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
        startedAt: startedAtISO,
        endedAt: endedAtISO,
      }),
    });
  } catch (e) {
    console.error("Failed to insert session:", e);
  }
}

/* =========================================================================
   Page wrapper
============================================================================ */
export default function Page() {
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
  const { user } = useSupabaseUser();
  const { push } = useToast();

  /* Core state */
  const [startBalance, setStartBalance] = useLocalStorage<number>("ust-start-balance", 1000);
  const [riskPct, setRiskPct] = useLocalStorage<number>("ust-risk-pct", 5);
  const [trades, setTrades] = useLocalStorage<TradeRow[]>("ust-trades", []);
  const [sessionId, setSessionId] = useLocalStorage<string | null>("ust-session-id", null);
  // Checklist-only state (no app-side effects)
  const [whyTrade, setWhyTrade] = useLocalStorage<string>("ust-checklist-why",
    "To gain financial freedom, spend more time with family, travel, and help others.");
  const [mentalReady, setMentalReady] = useLocalStorage<string>("ust-checklist-ready",
    "Yes, fresh as ever after a good rest.");
  const [sessionTarget, setSessionTarget] = useLocalStorage<string>("ust-checklist-target",
    "Stop if I give back 15% of gains today.");
  const [setupsToday, setSetupsToday] = useLocalStorage<string>("ust-checklist-setups",
    "Only A+ setups with potential to trend longer.");
  const [thresholdPct, setThresholdPct] = useLocalStorage<number>("ust-checklist-thresholdPct", 30);
  const [givebackPct, setGivebackPct] = useLocalStorage<number>("ust-checklist-givebackPct", 50);


  /* Discipline & Goals */
  const [maxLoss, setMaxLoss] = useLocalStorage<number>("ust-max-loss", 0);
  const [lockOnHit, setLockOnHit] = useLocalStorage<boolean>("ust-lock-on-hit", true);
  const [locked, setLocked] = useLocalStorage<boolean>("ust-locked", false);

  const [weeklyTarget, setWeeklyTarget] = useLocalStorage<number>("ust-weekly-target", 0);
  const [monthlyTarget, setMonthlyTarget] = useLocalStorage<number>("ust-monthly-target", 0);

  /* Derived */
  const totalPnlAllTime = useMemo(
    () => trades.reduce((acc, t) => acc + (t.pnl || 0), 0),
    [trades]
  );
  const equity = useMemo(() => startBalance + totalPnlAllTime, [startBalance, totalPnlAllTime]);
  /* === Guardrails (derived; checklist-only, read-only) === */
  const realizedProfit = useMemo(() => Math.max(0, equity - startBalance), [equity, startBalance]);
  const realizedProfitPct = useMemo(
    () => (startBalance ? (realizedProfit / startBalance) * 100 : 0),
    [realizedProfit, startBalance]
  );
  const profitOnlyMode = useMemo(
    () => realizedProfitPct >= (thresholdPct || 30),
    [realizedProfitPct, thresholdPct]
  );

  // Giveback lock from Checklist "Giveback Stop %"
  const givebackLockAmt = useMemo(
    () => (realizedProfit > 0 ? (givebackPct / 100) * realizedProfit : 0),
    [givebackPct, realizedProfit]
  );

  // Session guard = stricter of profit/4 and giveback lock (ignore giveback if 0%)
  const maxSessionLossGuard = useMemo(() => {
    const profitQuarter = realizedProfit / 4;
    const givebackGuard = givebackPct > 0 ? givebackLockAmt : Number.POSITIVE_INFINITY;
    return Math.min(profitQuarter, givebackGuard);
  }, [realizedProfit, givebackPct, givebackLockAmt]);

  // Effective cap = min(daily maxLoss, session guard)
  const effectiveLossCap = useMemo(() => {
    const dailyCap = maxLoss && maxLoss > 0 ? maxLoss : Number.POSITIVE_INFINITY;
    return Math.min(dailyCap, maxSessionLossGuard);
  }, [maxLoss, maxSessionLossGuard]);

  // Per-trade guidance so 6 losses == giveback
  const sixLossBudget = useMemo(
    () => (givebackLockAmt > 0 ? givebackLockAmt / 6 : 0),
    [givebackLockAmt]
  );
  const recommendedRiskPct = useMemo(
    () => (equity > 0 ? (sixLossBudget / equity) * 100 : 0),
    [sixLossBudget, equity]
  );

  const riskAmount = useMemo(() => (equity * riskPct) / 100, [equity, riskPct]);
  const allTimeGrowthPct = startBalance ? ((equity - startBalance) / startBalance) * 100 : 0;

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
  
  // session % base = startBalance + pnl from trades BEFORE sessionId
  const priorPnl = useMemo(() => {
    if (!sessionId) return 0;
    return trades
      .filter((t) => (t.ts || 0) < Number(sessionId))
      .reduce((a, t) => a + (t.pnl || 0), 0);
  }, [trades, sessionId]);
  const sessionBaseEquity = startBalance + priorPnl;
  const sessionPct = formatPct(pnl, sessionBaseEquity);

  const today = new Date();
  const todayKey = ymdLocal(today);
  const todayPnl = useMemo(
    () =>
      trades
        .filter((t) => t.ts && ymdLocal(new Date(t.ts)) === todayKey)
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [trades, todayKey]
  );

  // Lock when max-loss hit
  useEffect(() => {
    if (!lockOnHit || maxLoss <= 0) return;
    if (todayPnl <= -Math.abs(maxLoss) && !locked) {
      setLocked(true);
      push({ title: "Trading locked for today", desc: `Daily max loss (${currency(maxLoss)}) reached.` });
    }
  }, [todayPnl, maxLoss, lockOnHit, locked, setLocked, push]);

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
    () => trades.filter((t) => t.ts && isSameISOWeek(new Date(t.ts), today)).reduce((a, t) => a + (t.pnl || 0), 0),
    [trades, today]
  );
  const monthlyProgress = useMemo(
    () => trades.filter((t) => t.ts && isSameMonth(new Date(t.ts), today)).reduce((a, t) => a + (t.pnl || 0), 0),
    [trades, today]
  );

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
  {/* LEFT: logo + title + status */}
  <div className="flex items-center gap-3">
    <img
      src="/ust-logo.png"
      alt="Ultimate Scalper Tool"
      className="h-9 w-auto select-none"
    />
    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
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
      <span
        className={`h-2 w-2 rounded-full ${
          locked && lockOnHit ? "bg-rose-500" : "bg-emerald-500"
        }`}
      />
      {locked && lockOnHit ? "Locked" : "Active"}
    </span>
  </div>

  {/* RIGHT: theme toggle + actions */}
  <div className="flex items-center gap-2">
    <ThemeToggle />

    <Button
      onClick={async () => {
        try {
          if (!user?.id) {
            push({ title: "Please sign in", desc: "You need to sign in to save sessions." });
            return;
          }
          const startedAtISO = new Date(Number(sessionId || Date.now())).toISOString();
          const endedAtISO = new Date().toISOString();
          await recordSessionToLeaderboard(user.id, Number(pnl || 0), startedAtISO, endedAtISO);
          newSessionId();
          push({ title: "Session saved", desc: "Leaderboard updated." });
        } catch (e) {
          console.error(e);
          newSessionId();
        }
      }}
    >
      End Session / Start New
    </Button>

    {user && (
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await supabase.auth.signOut();
            push({ title: "Signed out", desc: "See you next session." });
          } catch (e) {
            console.error(e);
            push({ title: "Sign out failed", desc: "Please try again." });
          }
        }}
      >
        Sign Out
      </Button>
    )}
  </div>
</div>


    {/* Tabs */}
<Tabs defaultValue="dashboard" className="w-full">
  <TabsList
    className="mb-3 flex gap-1 bg-transparent p-0 overflow-x-auto whitespace-nowrap no-scrollbar"
  >
    {/* Dashboard */}
    <TabsTrigger
      value="dashboard"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Dashboard
    </TabsTrigger>

    {/* Analytics */}
    <TabsTrigger
      value="analytics"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Analytics
    </TabsTrigger>

    {/* Risk & Sizing (Deriv) */}
    <TabsTrigger
      value="risk-deriv"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Risk &amp; Sizing (Deriv)
    </TabsTrigger>

    {/* Risk & Sizing (FX) */}
    <TabsTrigger
      value="risk-fx"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Risk &amp; Sizing (FX)
    </TabsTrigger>

    {/* Risk & Sizing (XAU/NAS/US30/BTC) */}
    <TabsTrigger
      value="risk-majors"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Risk &amp; Sizing (XAU/NAS/US30/BTC)
    </TabsTrigger>

    {/* Trade Journal */}
    <TabsTrigger
      value="journal"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Trade Journal
    </TabsTrigger>

    {/* Calendar */}
    <TabsTrigger
      value="calendar"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Calendar
    </TabsTrigger>

    {/* A-Setups */}
    <TabsTrigger
      value="asetups"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      A-Setups
    </TabsTrigger>

    {/* Checklist */}
    <TabsTrigger
      value="checklist"
      className="rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 data-[state=active]:bg-amber-400 data-[state=active]:text-black data-[state=active]:border-amber-400
                 dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-black"
    >
      Checklist
    </TabsTrigger>

    {/* Leaderboard */}
    <a
      href="/leaderboard"
      className="inline-flex items-center justify-center whitespace-nowrap
                 rounded-full px-3 py-1 text-[13px] font-medium
                 border border-slate-500/30
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:bg-slate-800/70
                 transition-colors"
    >
      Leaderboard
    </a>
  </TabsList>

  {/* Your existing <TabsContent> blocks go below */}



        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <DashCard title="Win rate" value={`${fmt(winRate)}%`} hint={`${wins}W / ${losses}L / ${bes}BE`} />
            <DashCard
              title="PNL (this session)"
              value={currency(pnl)}
              hint={`Closed trades: ${closed}${sessionPct ? ` • ${sessionPct}` : ""}`}
            />
            <DashCard title="Sessions" value={`${sessionsCount}`} hint={badge ? badge.name : "Starter"} />
            <DashCard title="Equity" value={currency(equity)} hint={`Start: ${currency(startBalance)}`} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <DashCard title="Starting Capital" value={currency(startBalance)} />
            <DashCard title="All-time PnL" value={`${totalPnlAllTime >= 0 ? "+" : ""}${currency(Number(totalPnlAllTime.toFixed(2)))}`} />
            <DashCard title="All-time Growth" value={`${fmt(allTimeGrowthPct)}%`} hint="Based on starting capital" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <h4 className="text-lg font-semibold">Session Discipline</h4>
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <Label>Daily Max Loss (USD)</Label>
                    <Input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value) || 0)} />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Stop trading at -Max Loss</Label>
                    <Select value={String(lockOnHit)} onValueChange={(v: string) => setLockOnHit(v === "true")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[70] bg-white border shadow-md">
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
                      <Button variant="outline" onClick={resetDailyLock}>Reset Lock</Button>
                      {locked && lockOnHit && (
                        <Button
                          onClick={() => {
                            setLockOnHit(false);
                            push({ title: "Override", desc: "Lock disabled for today." });
                          }}
                        >
                          Override
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  When enabled, Quick Logger and New Trade are disabled once today&apos;s PnL ≤ -Daily Max Loss. Auto-unlocks at local midnight.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h4 className="text-lg font-semibold">Goals</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Weekly Target (USD)</Label>
                    <Input type="number" value={weeklyTarget} onChange={(e) => setWeeklyTarget(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label>Monthly Target (USD)</Label>
                    <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value) || 0)} />
                  </div>
                </div>
                <GoalProgress label="Weekly Progress" progress={Number(weeklyProgress.toFixed(2))} target={weeklyTarget || 0} />
                <GoalProgress label="Monthly Progress" progress={Number(monthlyProgress.toFixed(2))} target={monthlyTarget || 0} />
              </CardContent>
            </Card>
          </div>

          <BadgeShowcase badge={badge} sessionsCount={sessionsCount} />

         <Card>
  <CardContent className="p-5">
    <h4 className="text-lg font-semibold mb-2">Equity Curve (All Time)</h4>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={equitySeries} margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis />

          <YAxis />
          <RTooltip
            labelFormatter={(v) =>
              new Date(v).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            }
          />
          <Line type="monotone" dataKey="equity" stroke="#2563eb" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </CardContent>
</Card>

        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <AnalyticsPanel trades={trades} />
        </TabsContent>

        {/* RISK & SIZING — DERIV */}
        <TabsContent value="risk-deriv" className="space-y-4">
          <CapitalAndRiskCard
            startBalance={startBalance}
            setStartBalance={setStartBalance}
            riskPct={riskPct}
            setRiskPct={setRiskPct}
            equity={equity}
            riskAmount={riskAmount}
            tradesCount={trades.length}
          />

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-lg font-semibold">Per-Market Lot Size (Deriv)</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Enter risk pips for each Deriv market. Risk amount uses current equity × risk%.
              </p>
              <div className="space-y-3">
                {MARKET_OPTIONS
                  .filter((m) => m !== "Withdrawals")
                  .map((mkt) => (
                    <MarketSizerRowDeriv key={mkt} market={mkt} riskAmount={riskAmount} />
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RISK & SIZING — FX (5 pairs) */}
        <TabsContent value="risk-fx" className="space-y-4">
          <CapitalAndRiskSummary equity={equity} riskAmount={riskAmount} riskPct={riskPct} />

          <RiskSizerUniversalPanel
            title="FX Pairs (edit symbols if you like)"
            storagePrefix="ust-fx"
            rows={[
              { id: "1", defaultSymbol: "EURUSD", defaultPipValue: 10 },
              { id: "2", defaultSymbol: "GBPUSD", defaultPipValue: 10 },
              { id: "3", defaultSymbol: "USDJPY", defaultPipValue: 9.1 }, // ~ $9.1/pip per lot around 110; user can change
              { id: "4", defaultSymbol: "AUDUSD", defaultPipValue: 10 },
              { id: "5", defaultSymbol: "USDCAD", defaultPipValue: 10 },
            ]}
            riskAmount={riskAmount}
          />
        </TabsContent>

        {/* RISK & SIZING — XAU/NAS/US30/BTC */}
        <TabsContent value="risk-majors" className="space-y-4">
          <CapitalAndRiskSummary equity={equity} riskAmount={riskAmount} riskPct={riskPct} />

          <RiskSizerUniversalPanel
            title="XAU / Indices / Crypto"
            storagePrefix="ust-majors"
            rows={[
              { id: "xau", defaultSymbol: "XAUUSD", defaultPipValue: 1 },   // placeholder; adjust to broker spec
              { id: "nas", defaultSymbol: "NAS100", defaultPipValue: 1 },   // placeholder
              { id: "us30", defaultSymbol: "US30", defaultPipValue: 1 },    // placeholder
              { id: "btc", defaultSymbol: "BTCUSD", defaultPipValue: 1 },   // placeholder
            ]}
            riskAmount={riskAmount}
          />
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
              rows.forEach((row) =>
                addTrade({ symbol: row.market, notes: row.strategy, pnl: row.pnl })
              );
            }}
          />

          <JournalGrouped trades={trades} onDelete={deleteTrade} sessionId={sessionId} startBalance={startBalance} />
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar">
          <OldCalendar trades={trades} />
        </TabsContent>

        {/* A-SETUPS */}
        <TabsContent value="asetups">
          <ASetupsGallery />
        </TabsContent>

        {/* CHECKLIST — Review & Targets (standalone tab; no guardrails wired) */}
        <TabsContent value="checklist">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h4 className="text-lg font-semibold">🧭 Checklist — Review & Targets</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use this tab to confirm plan and targets. It does not change risk or lock behavior.
                Copy the summary and paste to Telegram/Slack if you like.
              </p>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label>1️⃣ Why I Trade</Label>
                    <textarea className="w-full border rounded-md p-2 h-24" value={whyTrade} onChange={(e)=>setWhyTrade(e.target.value)} />
                  </div>
                  <div>
                    <Label>2️⃣ Mental Readiness</Label>
                    <textarea className="w-full border rounded-md p-2 h-20" value={mentalReady} onChange={(e)=>setMentalReady(e.target.value)} />
                  </div>
                  <div>
                    <Label>3️⃣ Target for the Session</Label>
                    <textarea className="w-full border rounded-md p-2 h-20" value={sessionTarget} onChange={(e)=>setSessionTarget(e.target.value)} />
                  </div>
                  <div>
                    <Label>6️⃣ Setups I'll Trade</Label>
                    <textarea className="w-full border rounded-md p-2 h-20" value={setupsToday} onChange={(e)=>setSetupsToday(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Profit‑Only Trigger (info, % of start)</Label>
                      <Input type="number" value={thresholdPct} onChange={(e)=>setThresholdPct(Number(e.target.value)||0)} />
                      <div className="text-[11px] text-slate-500 mt-1">Default 30%</div>
                    </div>
                    <div>
                      <Label>Giveback Lock (info, % of profit)</Label>
                      <Input type="number" value={givebackPct} onChange={(e)=>setGivebackPct(Number(e.target.value)||0)} />
                      <div className="text-[11px] text-slate-500 mt-1">E.g. 50%</div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 bg-slate-50">
                    <div className="text-sm font-medium mb-1">Live Snapshot (read‑only)</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="text-slate-600 dark:text-slate-300">Start Capital</div><div className="font-medium">{currency(startBalance)}</div>
                      <div className="text-slate-600 dark:text-slate-300">Equity</div><div className="font-medium">{currency(equity)}</div>
                      <div className="text-slate-600 dark:text-slate-300">Profit</div><div className="font-medium">{currency(Math.max(0, equity - startBalance))}</div>
                      <div className="text-slate-600 dark:text-slate-300">Threshold</div><div className="font-medium">{thresholdPct}% ({currency((thresholdPct/100)*startBalance)})</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={()=>{
                      const txt = [
                        "🧭 Session Checklist",
                        `Why: ${whyTrade || "-"}`,
                        `Ready: ${mentalReady || "-"}`,
                        `Target: ${sessionTarget || "-"}`,
                        `Setups: ${setupsToday || "-"}`,
                        "",
                        `Start: ${currency(startBalance)} • Equity: ${currency(equity)}`,
                        `Profit: ${currency(Math.max(0, equity - startBalance))}`,
                        `Profit‑Only threshold: ${thresholdPct}% (${currency((thresholdPct/100)*startBalance)})`,
                        givebackPct ? `Giveback lock (info): ${givebackPct}%` : null,
                        `Time: ${new Date().toLocaleString()}`
                      ].filter(Boolean).join("\\n");
                      navigator.clipboard.writeText(txt).then(()=>{
                        push({ title: "Copied", desc: "Checklist summary copied." });
                      });
                    }}>Copy Summary</Button>

                    <Button variant="outline" onClick={()=>{
                      const id = newSessionId();
                      push({ title: "Session started", desc: `Session ID: ${id}` });
                    }}>Start Session</Button>
                  </div>
                  {/* === Live Snapshot (read-only) === */}
                  <div className="rounded-md border p-3 bg-slate-50">
                    <div className="text-sm font-medium mb-1">Live Snapshot (read-only)</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="text-slate-600 dark:text-slate-300">Start Capital</div>
                      <div className="font-medium">{currency(startBalance)}</div>

                      <div className="text-slate-600 dark:text-slate-300">Equity</div>
                      <div className="font-medium">{currency(equity)}</div>

                      <div className="text-slate-600 dark:text-slate-300">Profit</div>
                      <div className="font-medium">
                        {currency(realizedProfit)} ({formatPct(realizedProfit, startBalance)})
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">Mode</div>
                      <div className="font-medium">{profitOnlyMode ? "Profit-Only" : "Standard"}</div>

                      <div className="text-slate-600 dark:text-slate-300">Max Session Loss (min of profit/4 & giveback)</div>
                      <div className="font-medium">{currency(maxSessionLossGuard)}</div>

                      <div className="text-slate-600 dark:text-slate-300">Effective Loss Cap</div>
                      <div className="font-medium">
                        {Number.isFinite(effectiveLossCap) ? currency(effectiveLossCap) : "—"}
                      </div>
                    </div>

                    {/* Giveback Plan — Recommendations */}
                    <div className="mt-3 rounded-md border bg-white p-3">
                      <div className="text-sm font-semibold mb-2">🎯 Giveback Plan — Recommendations</div>
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div className="text-slate-600 dark:text-slate-300">Giveback Lock Amount</div>
                        <div className="font-medium">{currency(givebackLockAmt)}</div>

                        <div className="text-slate-600 dark:text-slate-300">Per-Trade Budget (×6 losses)</div>
                        <div className="font-medium">{currency(sixLossBudget)}</div>

                        <div className="text-slate-600 dark:text-slate-300">Recommended Risk % per Trade</div>
                        <div className="font-medium">{recommendedRiskPct.toFixed(2)}%</div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        These are guidance values only for decision-making. This tab does not change risk elsewhere.
                      </div>
                    </div>
                  </div>


                  <div className="text-[11px] text-slate-500">
                    Note: This tab is informational only and won't change risk or locks elsewhere.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

/* =========================================================================
   Reusable UI blocks
============================================================================ */
function DashCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">{title}</div>
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

/* Shared capital/risk header blocks for Risk tabs */
function CapitalAndRiskCard({
  startBalance,
  setStartBalance,
  riskPct,
  setRiskPct,
  equity,
  riskAmount,
  tradesCount,
}: {
  startBalance: number;
  setStartBalance: (v: number) => void;
  riskPct: number;
  setRiskPct: (v: number) => void;
  equity: number;
  riskAmount: number;
  tradesCount: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 grid md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <Label>Starting Capital</Label>
          <Input
            type="number"
            value={startBalance}
            onChange={(e) => setStartBalance(Number(e.target.value) || 0)}
            disabled={tradesCount > 0}
          />
          {tradesCount > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              Locked after first trade.{" "}
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
          <Input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 0)} />
        </div>
        <InfoStat label="Current Equity" value={currency(equity)} />
        <InfoStat label="Risk Amount (auto)" value={currency(riskAmount)} />
      </CardContent>
    </Card>
  );
}
function CapitalAndRiskSummary({
  equity,
  riskAmount,
  riskPct,
}: {
  equity: number;
  riskAmount: number;
  riskPct: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 grid md:grid-cols-3 gap-4">
        <InfoStat label="Current Equity" value={currency(equity)} />
        <InfoStat label="Risk % per Trade" value={`${fmt(riskPct)}%`} />
        <InfoStat label="Risk Amount (auto)" value={currency(riskAmount)} />
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   Badge Showcase
============================================================================ */
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
  const current = badge ?? (sessionsCount >= 5 ? { name: tiers[0].name, imagePath: tiers[0].img } : null);
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
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Sessions completed: <strong>{sessionsCount}</strong>
            </div>
            {nextTier ? (
              <>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Next badge: <strong>{nextTier.key}</strong> at {nextTier.at} sessions.
                </div>
                <div className="w-full h-2 rounded-full bg-slate-50 dark:bg-slate-800 mt-2 overflow-hidden">
                  <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {left} more session(s) to {nextTier.key}.
                </div>
              </>
            ) : (
              <div className="text-sm text-emerald-600 mt-3">You've reached the top tier. 🏆</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   Risk rows — Deriv
============================================================================ */
function MarketSizerRowDeriv({ market, riskAmount }: { market: MarketName; riskAmount: number }) {
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

  const lot = calcLotSizeDeriv(riskAmount, market, riskPips);

  return (
    <div className="grid md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-white/60">
      <div className="md:col-span-5 font-medium">{market}</div>
      <div className="md:col-span-3">
        <Label>Risk Pips</Label>
        <Input
          type="number"
          value={riskPips}
          onChange={(e) => setRiskPips(Number(e.target.value) || 0)}
        />
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

/* =========================================================================
   Universal Risk Sizer (FX / Majors)
============================================================================ */
function RiskSizerUniversalPanel({
  title,
  storagePrefix,
  rows,
  riskAmount,
}: {
  title: string;
  storagePrefix: string;
  rows: { id: string; defaultSymbol: string; defaultPipValue?: number }[];
  riskAmount: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="text-lg font-semibold">{title}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Lot size = Risk Amount ÷ (Risk Pips × Pip Value per 1 lot). Enter your broker's pip value per lot.
        </p>
        <div className="space-y-3">
          {rows.map((r) => (
            <UniversalSizerRow
              key={r.id}
              storagePrefix={storagePrefix}
              rowId={r.id}
              defaultSymbol={r.defaultSymbol}
              defaultPipValue={r.defaultPipValue}
              riskAmount={riskAmount}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
function UniversalSizerRow({
  storagePrefix,
  rowId,
  defaultSymbol,
  defaultPipValue,
  riskAmount,
}: {
  storagePrefix: string;
  rowId: string;
  defaultSymbol: string;
  defaultPipValue?: number;
  riskAmount: number;
}) {
  const symKey = `${storagePrefix}-${rowId}-symbol`;
  const pipsKey = `${storagePrefix}-${rowId}-riskpips`;
  const pipValKey = `${storagePrefix}-${rowId}-pipval`;

  const [symbol, setSymbol] = useState<string>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(symKey) : null;
    return raw ?? defaultSymbol;
  });
  const [riskPips, setRiskPips] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(pipsKey) : null;
    return raw ? Number(raw) : 0;
  });
  const [pipVal, setPipVal] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(pipValKey) : null;
    const def = defaultPipValue ?? 0;
    return raw ? Number(raw) : def;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(symKey, symbol);
      localStorage.setItem(pipsKey, String(riskPips || 0));
      localStorage.setItem(pipValKey, String(pipVal || 0));
    }
  }, [symKey, pipsKey, pipValKey, symbol, riskPips, pipVal]);

  const lot = calcLotSizeUniversal(riskAmount, riskPips, pipVal);

  return (
    <div className="grid md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-white/60">
      <div className="md:col-span-4">
        <Label>Symbol</Label>
        <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
      </div>
      <div className="md:col-span-3">
        <Label>Risk Pips</Label>
        <Input type="number" value={riskPips} onChange={(e) => setRiskPips(Number(e.target.value) || 0)} />
      </div>
      <div className="md:col-span-3">
        <Label>Pip Value / Lot (USD)</Label>
        <Input type="number" step="0.01" value={pipVal} onChange={(e) => setPipVal(Number(e.target.value) || 0)} />
      </div>
      <div className="md:col-span-2">
        <Label>Lot Size (auto)</Label>
        <div className="h-10 grid place-items-center rounded-md border bg-white">
          <strong>{lot}</strong>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Searchable Combobox Market Picker for Journal
============================================================================ */
function getCustomSymbolsFromStorage() {
  if (typeof window === "undefined") return [] as string[];

  // fetch symbols from stored risk tabs if available
  const fxIds = ["1", "2", "3", "4", "5"];
  const majorIds = ["xau", "nas", "us30", "btc"];
  const grab = (key: string) => {
    const v = localStorage.getItem(key);
    return v && v.trim() ? v.trim().toUpperCase() : null;
  };

  const fx = fxIds.map(id => grab(`ust-fx-${id}-symbol`)).filter(Boolean) as string[];
  const majors = majorIds.map(id => grab(`ust-majors-${id}-symbol`)).filter(Boolean) as string[];

  // Default built-in markets
  const deriv = [
    "Step Index",
    "Volatility 75 (1s)",
    "Volatility 75",
    "Volatility 25 (1s)",
    "Volatility 25",
    "Volatility 10 (1s)",
  ];

  // Default FX + Major indices if nothing is stored yet
  const defaults = [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCAD",
    "XAUUSD",
    "NAS100",
    "US30",
    "BTCUSD",
  ];

  // Combine and dedupe
  const seen = new Set<string>();
  return [...deriv, ...defaults, ...fx, ...majors].filter(s =>
    seen.has(s) ? false : (seen.add(s), true)
  );
}


function MarketPicker({
  value,
  onChange,
  placeholder = "Select or type a symbol…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getCustomSymbolsFromStorage(), []);
  const display = value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className={value ? "" : "text-slate-400"}>{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0 z-[80] bg-white border shadow-lg">
        <Command>
          <CommandInput placeholder="Search markets or symbols…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>

            <CommandGroup heading="Saved & Deriv">
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onChange(opt); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${opt === value ? "opacity-100" : "opacity-0"}`} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>

            {value && !options.includes(value.toUpperCase()) && (
              <CommandGroup heading="Typed">
                <CommandItem
                  value={value.toUpperCase()}
                  onSelect={() => { onChange(value.toUpperCase()); setOpen(false); }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-100" />
                  {value.toUpperCase()}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================================
   Multi Quick Logger (updated to use MarketPicker)
============================================================================ */
function MultiQuickLogger({
  initialRows = 3,
  maxRows = 4,
  locked,
  onLogged,
}: {
  initialRows?: number;
  maxRows?: number;
  locked?: boolean;
  onLogged: (rows: { market: string; strategy: StrategyName; pnl: number }[]) => void;
}) {
  type Pending = { id: string; market: string; strategy: StrategyName; pnl: number };
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
                <MarketPicker
                  value={r.market}
                  onChange={(val) => updateRow(r.id, { market: val })}
                />
              </div>

              <div className="md:col-span-5">
                <Label>Strategy</Label>
                <Select value={r.strategy} onValueChange={(v: StrategyName) => updateRow(r.id, { strategy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[70] bg-white border shadow-md">
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
                  onChange={(e) => updateRow(r.id, { pnl: Number(e.target.value) || 0 })}
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

/* =========================================================================
   Journal (grouped by session) – with % next to totals
============================================================================ */
function JournalGrouped({
  trades,
  onDelete,
  sessionId,
  startBalance,
}: {
  trades: TradeRow[];
  onDelete: (id: string) => void;
  sessionId: string | null;
  startBalance: number;
}) {
  const histRaw = typeof window !== "undefined" ? localStorage.getItem("ust-session-history") : "[]";
  const hist: string[] = histRaw ? JSON.parse(histRaw) : [];
  const sessionsSorted = [...hist].map(Number).sort((a, b) => a - b);

  type Bucket = { title: string; rows: TradeRow[]; startTs?: number };
  const buckets: Bucket[] = [];
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
      if (rows.length) buckets.push({ title: titleFor(start, i), rows, startTs: start });
    }
  } else {
    if (all.length) buckets.push({ title: "All Trades", rows: all });
  }

  const totalAll = (rows: TradeRow[]) => rows.reduce((a, t) => a + (t.pnl || 0), 0);
  const priorPnlBefore = (ts: number) =>
    all.filter((t) => (t.ts || 0) < ts).reduce((a, t) => a + (t.pnl || 0), 0);

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
            .map((b, i) => {
              const total = totalAll(b.rows);
              const baseEquity = b.startTs ? startBalance + priorPnlBefore(b.startTs) : startBalance;
              const pct = formatPct(total, baseEquity);

              return (
                <div key={i} className="border-b">
                  <div className="flex items-center justify-between px-3 py-2 text-sm font-medium bg-white">
                    <div>{b.title}</div>
                    <div className="flex items-baseline gap-2">
                      <div className={`${total >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                        {total >= 0 ? "+" : ""}
                        {currency(total)}
                      </div>
                      {pct && <span className="text-xs text-slate-500">({pct})</span>}
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
              );
            })
        ) : (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No trades yet. Use Quick Logger above.</div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   Analytics
============================================================================ */
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
        <BarChart
          data={byMarket}
          margin={{ top: 8, right: 12, bottom: 32, left: 0 }}
          barCategoryGap={20}   // spacing between categories
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" />

          {/* Show ALL market names; angle a bit so they fit */}
          <XAxis
            dataKey="name"
            interval={0}                // ← never skip labels
            height={56}                 // room for angled text
            angle={-15}
            textAnchor="end"
            tickLine={false}
            axisLine={{ stroke: "#9aa7bd33" }}
            tick={{ fontSize: 12, fill: "currentColor" }}
          />

          <YAxis
            tickLine={false}
            axisLine={{ stroke: "#9aa7bd33" }}
            tick={{ fontSize: 12, fill: "currentColor" }}
          />

          <RTooltip
            formatter={(value: number) => [value, "pnl"]}
            labelFormatter={(label: string) => `Market: ${label}`}
          />
          <Legend />

          <Bar
            dataKey="pnl"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}             // caps column width on wide screens
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </CardContent>
</Card>

    </div>
  );
}

/* =========================================================================
   A-Setups Gallery
============================================================================ */
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
            <Button disabled={!file} onClick={addItem}>Upload</Button>
          </div>
        </CardContent>
      </Card>

      {!items.length && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-300">
            Upload screenshots for your A-Setups once. Review them at the start of every session.
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold">{it.title}</div>
              <img src={it.dataUrl} alt={it.title} className="w-full rounded-md border object-contain" />
              {it.notes && <div className="text-xs text-slate-600 dark:text-slate-300">{it.notes}</div>}
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

/* =========================================================================
   CSV Export
============================================================================ */
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

/* =========================================================================
   Goal Progress
============================================================================ */
function GoalProgress({
  label,
  progress,
  target,
}: {
  label: string;
  progress: number;
  target: number;
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
        <div className="text-xs text-slate-600 dark:text-slate-300">{target ? `${pct.toFixed(0)}%` : "—"}</div>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-50 dark:bg-slate-800 mt-2 overflow-hidden">
        <div className={`h-2 transition-all ${reached ? "bg-emerald-600" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
        <span>Progress: <strong>{currency(Number(progress.toFixed(2)))}</strong></span>
        <span>Target: <strong>{currency(Number((target || 0).toFixed(2)))}</strong></span>
      </div>

      {reached && <div className="mt-1 text-[11px] text-emerald-700">🎯 Goal reached for this period — nice work!</div>}
    </div>
  );
}

/* =========================================================================
   Old Calendar (with daily PnL chips)
============================================================================ */
function OldCalendar({ trades }: { trades: { ts?: number; pnl?: number }[] }) {
  const { tradeDays, dailyTotals } = useMemo(() => {
    const set = new Set<string>();
    const totals = new Map<string, number>();
    trades.forEach((t) => {
      if (!t.ts) return;
      const d = new Date(t.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
        2,
        "0"
      )}`;
      set.add(key);
      totals.set(key, (totals.get(key) || 0) + (t.pnl ?? 0));
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

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  function keyOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

        <div className="grid grid-cols-7 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
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
