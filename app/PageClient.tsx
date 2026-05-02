/* PageClient.tsx — Ultimate Scalper Tool (3× Risk & Sizing + Combobox Logger) */
"use client";

import { useEffect, useMemo, useState, useContext, useCallback } from "react";
import * as React from "react";
import AuthGate from "@/components/AuthGate";
import { useSupabaseUser } from "@/lib/useSupabaseUser";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";
import { SHEETS_WEBAPP_URL as SHEETS_URL, READ_TOKEN as SHEETS_TOKEN, DEFAULT_UST_ACCOUNT as DEFAULT_ACCOUNT } from "@/lib/env";
import WatchlistPanel from "@/components/WatchlistPanel";


/* ========== shadcn/ui ========== */
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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
import { ChevronsUpDown, Check, Wallet, TrendingUp, TrendingDown, BarChart3, CalendarDays, Target, ShieldCheck, Activity, Info, PieChart, Star, Scale } from "lucide-react";

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

// ====== AUTO IMPORT HELPERS (UST ⇄ Google Sheets) ======

type TradeRow = {
  id: string;
  symbol: string;

  // For trades:
  pnl: number;

  // For withdrawals:
  kind?: "trade" | "withdrawal";
  amount?: number; // positive number withdrawn (e.g. 200 = $200)

  notes?: string;
  ts?: number;

  // NEW:
  source?: "manual" | "auto";
  extId?: string; // deal_ticket or order_ticket for dedupe
};

// tiny localStorage hook (unique key names to avoid collision)
function useLS<T>(key: string, initial: T) {
  const [v, setV] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

type SheetItem = {
  timestamp?: string;
  account?: string;
  symbol?: string;
  action?: string; // ORDER_OPEN / ORDER_CLOSE
  side?: string;
  deal_ticket?: string | number;
  order_ticket?: string | number;
  volume?: number | string;
  price?: number | string;
  sl?: number | string;
  tp?: number | string;
  profit?: number | string;
  commission?: number | string;
  swap?: number | string;
  comment?: string;
};


function buildSheetsUrl(account: string, since?: string) {
  // Guard against missing/invalid env vars to avoid crashing the whole app.
  if (!SHEETS_URL || !SHEETS_TOKEN || !account) return null;
  try {
    const u = new URL(SHEETS_URL);
    u.searchParams.set("readToken", SHEETS_TOKEN);
    u.searchParams.set("account", account);
    if (since) u.searchParams.set("since", since);
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeToTradeRows(items: SheetItem[]): TradeRow[] {
  const rows: TradeRow[] = [];
  for (const it of items) {
    // import only closed trades into Journal
    if ((it.action || "").toUpperCase() !== "ORDER_CLOSE") continue;

    const ts = it.timestamp ? new Date(it.timestamp).getTime() : Date.now();
    const profit = Number(it.profit || 0);
    const commission = Number(it.commission || 0);
    const swap = Number(it.swap || 0);
    const pnl = Number((profit - commission - swap).toFixed(2));
    const extId = String(it.deal_ticket || it.order_ticket || "");

    rows.push({
      id: `${ts}-${extId || Math.random().toString(36).slice(2,6)}`,
      ts,
      symbol: it.symbol || "Unknown",
      pnl,
      notes: `AUTO • ${it.side || ""} • vol ${it.volume ?? ""} @ ${it.price ?? ""}`,
      source: "auto",
      extId,
    });
  }
  // newest first
  rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  return rows;
}

function useSheetsImporter(addTradesBulk: (rows: TradeRow[]) => void) {
  const [enabled, setEnabled] = useLS<boolean>("ust:autoEnabled", true);
  const [account, setAccount] = useLS<string>("ust:autoAccount", DEFAULT_ACCOUNT || "");
  const [since, setSince] = useLS<string>("ust:autoSince", "");
  const [lastSync, setLastSync] = useLS<number>("ust:lastSync", 0);
  const [seen, setSeen] = useLS<string[]>("ust:seenExtIds", []);

  const runImport = React.useCallback(async () => {
    if (!enabled || !SHEETS_URL || !SHEETS_TOKEN || !account) return;
    try {
      const url = buildSheetsUrl(account, since);
                  if (!url) return;
if (!url) return;
const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();
      if (!data?.ok) return;
      const items: SheetItem[] = data.items || [];
      const rows = normalizeToTradeRows(items)
        .filter(r => !r.extId || !seen.includes(r.extId));
      if (rows.length) {
        addTradesBulk(rows);
        const nextSeen = [
          ...seen,
          ...rows.filter(r => !!r.extId).map(r => r.extId as string),
        ];
        // keep memory bounded
        setSeen(Array.from(new Set(nextSeen)).slice(-6000));
      }
      setLastSync(Date.now());
    } catch (e) {
      // swallow; we don’t want to interrupt the app
      console.warn("Auto-import failed:", e);
    }
  }, [enabled, account, since, seen, addTradesBulk, setSeen, setLastSync]);

  // poll every 20s
  React.useEffect(() => {
    runImport(); // first tick
    const t = setInterval(runImport, 20000);
    return () => clearInterval(t);
  }, [runImport]);

  return { enabled, setEnabled, account, setAccount, since, setSince, lastSync, runImport };
}

/* =========================================================================
   Tiny Toasts (local, no external deps)
============================================================================ */
type ToastItem = { id: string; title: string; desc?: string };
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
          <div key={t.id} className="rounded-lg border bg-white shadow px-3 py-2 w-72 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t.desc}</div>
            ) : null}
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

const MARKET_OPTIONS = [
  "Step Index",
  "Volatility 75 (1s) Index",
  "Volatility 75 Index",
  "Volatility 50 Index",
  "Volatility 25 (1s) Index",
  "Volatility 25 Index",
] as const;
type MarketName = (typeof MARKET_OPTIONS)[number];

const STRATEGIES = [
  "Ultimate M1 Trend setup",
  "Ultimate M1 Range setup",
  "Withdrawals",
] as const;
type StrategyName = (typeof STRATEGIES)[number];

type ASetup = { id: string; title: string; dataUrl: string; notes?: string };

type SessionSummary = {
  sessionId: string;   // ✅ ADD THIS
  startedAt: string; // ISO
  endedAt: string;   // ISO
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number; // 0-100
  topMarket: string;
  disciplineScore: number; // 0-100
  badges: string[];
};

// === UST WOW helpers (Discipline + Rules) ===
function computeRuleBadges(input: {
  lockOnHit: boolean;
  maxLoss: number;
  locked: boolean;
  profitOnlyMode: boolean;
  riskPct: number;
  recommendedRiskPct: number;
}) {
  const badges: string[] = [];
  if (input.maxLoss > 0) badges.push("Max Loss Guard");
  if (input.lockOnHit) badges.push("Auto-Lock Enabled");
  if (input.locked) badges.push("Auto-Lock Triggered");
  if (input.profitOnlyMode) badges.push("Profit-Only Mode");

  // Risk guidance: if recommendedRiskPct is meaningful, compare to current
  if (input.recommendedRiskPct > 0) {
    if (input.riskPct <= input.recommendedRiskPct * 1.1) badges.push("Risk Controlled");
    if (input.riskPct <= input.recommendedRiskPct) badges.push("Risk Reduced");
  }

  // Remove duplicates
  return Array.from(new Set(badges));
}

function computeDisciplineScore(input: {
  startBalance: number;
  equity: number;
  pnl: number;
  tradesCount: number;
  maxLoss: number;
  lockOnHit: boolean;
  locked: boolean;
  profitOnlyMode: boolean;
  riskPct: number;
  recommendedRiskPct: number;
  whyTrade: string;
  mentalReady: string;
  sessionTarget: string;
  setupsToday: string;
}) {
  // Start at 100 and subtract penalties (simple + explainable)
  let score = 100;

  // Basic reality checks
  if (input.startBalance <= 0) score -= 20;
  if (input.equity <= 0) score -= 20;

  // Guardrails
  if (input.maxLoss <= 0) score -= 12;
  if (!input.lockOnHit) score -= 10;

  // If max loss is set and pnl blew past it, big penalty
  if (input.maxLoss > 0 && input.pnl < -Math.abs(input.maxLoss)) score -= 35;
  if (input.locked && input.pnl < 0) score -= 6; // got locked on a losing day

  // Over-risking (keep realistic)
  if (input.riskPct > 10) score -= 20;
  else if (input.riskPct > 6) score -= 12;

  // Reward when user follows the recommended risk (6 losses = giveback)
  if (input.recommendedRiskPct > 0 && input.riskPct <= input.recommendedRiskPct) score += 4;
  if (input.profitOnlyMode) score += 3;

  // Preparation fields (legit psychology)
  const filled = [input.whyTrade, input.mentalReady, input.sessionTarget, input.setupsToday].filter(
    (v) => String(v || "").trim().length > 0
  ).length;
  if (filled <= 1) score -= 12;
  else if (filled === 2) score -= 6;

  // Trading behavior
  if (input.tradesCount === 0) score -= 18;
  if (input.tradesCount > 10) score -= 10;

  // Clamp 0..100
  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
}

function buildSessionSummary(input: {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  pnl: number;
  trades: Array<{ market?: string; pnl?: number }>;
  disciplineScore: number;
  badges: string[];
}): SessionSummary {
  const tradesCount = input.trades.length;
  const wins = input.trades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = input.trades.filter((t) => (t.pnl || 0) < 0).length;
  const bes = input.trades.filter((t) => (t.pnl || 0) === 0).length;
  const winRate = tradesCount ? (wins / tradesCount) * 100 : 0;

  // Top market = most frequent
  const freq: Record<string, number> = {};
  for (const t of input.trades) {
    const m = (t.market || "Unknown").trim() || "Unknown";
    freq[m] = (freq[m] || 0) + 1;
  }
  let topMarket = "—";
  let topCount = 0;
  for (const [k, v] of Object.entries(freq)) {
    if (v > topCount) {
      topMarket = k;
      topCount = v;
    }
  }

  return {
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    pnl: input.pnl,
    trades: tradesCount,
    wins,
    losses,
    bes,
    winRate,
    topMarket,
    disciplineScore: input.disciplineScore,
    badges: input.badges,
  };
}

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

    case "Volatility 75 (1s) Index":
    case "Volatility 75 Index":
    case "Volatility 25 (1s) Index":
        return +((ra / rp) * 100).toFixed(3);

    case "Volatility 25 Index":
      return +(ra / (rp / 1000)).toFixed(3);

      case "Volatility 50 Index":
      return +(ra / (rp / 10000)).toFixed(3);

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
function PageClientWrapper() {
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
  const [startBalance, setStartBalance] = useLocalStorage<number>("ust-start-balance", 0);
  const [riskPct, setRiskPct] = useLocalStorage<number>("ust-risk-pct", 2.5);
  const [trades, setTrades] = useLocalStorage<TradeRow[]>("ust-trades", []);
  const [sessionId, setSessionId] = useLocalStorage<string | null>("ust-session-id", null);
  const [lastSessionSummary, setLastSessionSummary] = useLocalStorage<SessionSummary | null>("ust-last-session-summary", null);
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
  // Withdrawal logger UI
  const [withdrawAmt, setWithdrawAmt] = useState<number>(0);
  const [withdrawNote, setWithdrawNote] = useState<string>("");



  // --- MIGRATE old "Withdrawals" entries so they stop counting as losses ---
  useEffect(() => {
    setTrades((prev) => {
      let changed = false;

      const next = prev.map((t) => {
        const kind = t.kind ?? "trade";

        const looksLikeWithdrawal =
          kind === "trade" &&
          (String(t.symbol || "").toLowerCase() === "withdrawals" ||
            String(t.notes || "").toLowerCase().includes("withdraw"));

        if (!looksLikeWithdrawal) {
          // ensure kind exists going forward
          if (!t.kind) changed = true;
          return { ...t, kind };
        }

        changed = true;
        const amt = Math.abs(Number(t.pnl || 0));
        return {
          ...t,
          kind: "withdrawal",
          amount: amt,
          pnl: 0,
          symbol: "Withdrawals",
          notes: t.notes || "Withdrawal recorded",
        };
      });

      return changed ? next : prev;
    });
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ---------- Watchlist (shared, editable by admin) ---------- */
  // Create a table in Supabase named: ust_watchlist
  // Columns: id (uuid), content (text), created_at (timestamptz default now()), created_by (uuid nullable)
  // RLS idea:
  // - SELECT: enabled for everyone
  // - INSERT/UPDATE/DELETE: only for admin (by user.id or email)
  const WATCHLIST_TABLE = "ust_watchlist";


  // --- Watchlist helpers (handles older DB schemas safely) ---
  const getWatchlistContent = (row: any): string =>
    (row?.content ??
      row?.watchlist_text ??
      row?.watchlist ??
      row?.body ??
      row?.text ??
      "").toString();

  const getWatchlistImages = (row: any): string[] =>
    (row?.images ??
      row?.image_urls ??
      row?.watchlist_images ??
      row?.screenshots ??
      []) as string[];


  // Set either of these env vars (recommended) to unlock the editor only for you:
  // NEXT_PUBLIC_UST_ADMIN_USER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  // NEXT_PUBLIC_UST_ADMIN_EMAIL="you@example.com"
  const ADMIN_USER_ID = process.env.NEXT_PUBLIC_UST_ADMIN_USER_ID;
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_UST_ADMIN_EMAIL;

  const isAdmin = useMemo(() => {
    const uid = (user as any)?.id || (user as any)?.user?.id; // supports both shapes
    const email = (user as any)?.email || (user as any)?.user?.email;

    // Fallback admin UID (your provided UUID) if env var is not set.
    const adminUid = ADMIN_USER_ID || "39127777-9fd8-4183-96bf-03f943b56a24";

    if (!uid) return false;

    // Primary check: UID match
    if (uid === adminUid) return true;

    // Optional secondary check: email match (only if env var is set)
    if (ADMIN_EMAIL && email && String(email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) return true;

    return false;
  }, [user, ADMIN_USER_ID, ADMIN_EMAIL]);

  const [watchlistDraft, setWatchlistDraft] = useState("");
  const [watchlistImages, setWatchlistImages] = useState<File[]>([]);
  const [watchlistScreenshotUrls, setWatchlistScreenshotUrls] = useState<string[]>([]);

  // Upload UI state
  const [watchlistUploading, setWatchlistUploading] = useState(false);
  const [watchlistUploadError, setWatchlistUploadError] = useState<string | null>(null);

  // Admin check (editor should only show for admin)
  const watchlistCanEdit = isAdmin;
  const [watchlistLatest, setWatchlistLatest] = useState<any | null>(null);
  const [watchlistHistory, setWatchlistHistory] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    setWatchlistError(null);

    try {
      const { data, error } = await supabase
        .from(WATCHLIST_TABLE)
          .select('*')
        .order("created_at", { ascending: false })
        .limit(7);

      if (error) throw error;

      const latest = data?.[0] ?? null;
      setWatchlistLatest(latest);
      setWatchlistHistory(data ?? []);
      setWatchlistScreenshotUrls((latest as any)?.image_urls ?? []);
      // keep local selected files separate
      if (latest?.content) setWatchlistDraft(latest.content);
    } catch (e: any) {
      // Common causes: table not created yet, or RLS not configured
      setWatchlistError(e?.message ?? "Failed to load watchlist.");
      setWatchlistLatest(null);
      setWatchlistHistory([]);
    } finally {
      setWatchlistLoading(false);
    }
  }, []);


  const WATCHLIST_BUCKET = "ust-watchlist";

  async function uploadWatchlistScreenshot(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `watchlists/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage.from(WATCHLIST_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/png",
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(WATCHLIST_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  // Parse a single textarea into two DB fields (primary_focus + monitor_list).
  // This keeps your older UI (one text box) while supporting the newer table schema.
  function splitWatchlistSections(text: string) {
    const t = (text || "").trim();
    if (!t) return { primary_focus: "", monitor_list: "" };

    const lower = t.toLowerCase();
    const idxPrimary = lower.indexOf("primary focus");
    const idxMonitor = lower.indexOf("monitor list");

    // If headings exist, slice around them; otherwise treat everything as primary focus.
    if (idxPrimary !== -1 && idxMonitor !== -1 && idxMonitor > idxPrimary) {
      const primary = t.slice(idxPrimary, idxMonitor).trim();
      const monitor = t.slice(idxMonitor).trim();
      return { primary_focus: primary, monitor_list: monitor };
    }

    // Fallback: if only Monitor List exists, treat text before it as primary.
    if (idxMonitor !== -1) {
      const primary = t.slice(0, idxMonitor).trim();
      const monitor = t.slice(idxMonitor).trim();
      return { primary_focus: primary, monitor_list: monitor };
    }

    return { primary_focus: t, monitor_list: "" };
  }

  const publishWatchlist = useCallback(async () => {
    const content = watchlistDraft.trim();
    if (!content) return;

    setWatchlistSaving(true);
    setWatchlistError(null);

    try {
      // Upload any selected screenshots (optional)
      setWatchlistUploadError(null);
      setWatchlistUploading(true);
      const uploaded = watchlistImages.length
        ? await Promise.all(watchlistImages.map((f) => uploadWatchlistScreenshot(f)))
        : [];
      const allUrls = [...(watchlistScreenshotUrls || []), ...uploaded];

      // Try saving watchlist; handle older DB schemas (missing columns) gracefully.
      const baseText = watchlistDraft.trim();
      if (!baseText) throw new Error("Watchlist text is empty.");
      const sections = splitWatchlistSections(baseText);

      // One watchlist per day (with edits): write to today's row.
      // If a row already exists for today, we UPDATE (or UPSERT) instead of INSERT.
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Ensure we never send undefined for NOT NULL columns.
      const safeSections = {
        primary_focus: sections.primary_focus ?? "",
        monitor_list: sections.monitor_list ?? "",
      };

      // Prefer newer schema: upsert on watchlist_date (unique per day)
      const tryUpsert = async (payload: any) =>
        supabase.from(WATCHLIST_TABLE).upsert(payload, { onConflict: "watchlist_date" });

      const tryUpdateToday = async (payload: any) =>
        supabase.from(WATCHLIST_TABLE).update(payload).eq("watchlist_date", today);

      // 1) Try with new schema fields + content + image_urls (UPSERT by date)
      let insertErr: any = null;
      let res = await tryUpsert({
        watchlist_date: today,
        content: baseText,
        ...safeSections,
        created_by: user.id,
        ...(allUrls.length ? { image_urls: allUrls } : {}),
      });
      insertErr = res.error;

      // If upsert isn't supported by this schema (missing watchlist_date), fall back to INSERT.
      const tryInsert = async (payload: any) => supabase.from(WATCHLIST_TABLE).insert(payload);

      if (insertErr && String(insertErr.message || "").toLowerCase().includes("watchlist_date")) {
        // Retry without watchlist_date (older schema)
        const rLegacy = await tryInsert({
          content: baseText,
          ...safeSections,
          created_by: user.id,
          ...(allUrls.length ? { image_urls: allUrls } : {}),
        });
        insertErr = rLegacy.error;
      }

      // If we hit the unique constraint anyway, do a plain UPDATE for today.
      if (
        insertErr &&
        String(insertErr.message || "").toLowerCase().includes("duplicate key")
      ) {
        const rUpdate = await tryUpdateToday({
          content: baseText,
          ...safeSections,
          ...(allUrls.length ? { image_urls: allUrls } : {}),
        });
        insertErr = rUpdate.error;
      }

      // 2) If 'content' column doesn't exist, retry with common older names
      if (insertErr && String(insertErr.message || "").toLowerCase().includes("content")) {
        const candidates = ["watchlist_text", "watchlist", "body", "text"];
        for (const col of candidates) {
          // Try UPSERT first (newer schema), then fall back to UPDATE/INSERT as needed.
          const r2 = await tryUpsert({
            watchlist_date: today,
            [col]: baseText,
            ...safeSections,
            created_by: user.id,
            ...(allUrls.length ? { image_urls: allUrls } : {}),
          });
          insertErr = r2.error;

          if (
            insertErr &&
            String(insertErr.message || "").toLowerCase().includes("duplicate key")
          ) {
            const r2u = await tryUpdateToday({
              [col]: baseText,
              ...safeSections,
              ...(allUrls.length ? { image_urls: allUrls } : {}),
            });
            insertErr = r2u.error;
          }

          if (insertErr && String(insertErr.message || "").toLowerCase().includes("watchlist_date")) {
            const r2i = await tryInsert({
              [col]: baseText,
              ...safeSections,
              created_by: user.id,
              ...(allUrls.length ? { image_urls: allUrls } : {}),
            });
            insertErr = r2i.error;
          }
          if (!insertErr) break;
        }
      }

      // 3) If 'image_urls' column doesn't exist, retry without images (text will still save)
      if (insertErr && String(insertErr.message || "").toLowerCase().includes("image_urls")) {
        // First try again with content
        const r3 = await tryUpsert({
          watchlist_date: today,
          content: baseText,
          ...safeSections,
          created_by: user.id,
        });
        insertErr = r3.error;

        if (
          insertErr &&
          String(insertErr.message || "").toLowerCase().includes("duplicate key")
        ) {
          const r3u = await tryUpdateToday({ content: baseText, ...safeSections });
          insertErr = r3u.error;
        }

        if (insertErr && String(insertErr.message || "").toLowerCase().includes("watchlist_date")) {
          const r3i = await tryInsert({ content: baseText, ...safeSections, created_by: user.id });
          insertErr = r3i.error;
        }

        // Then try older text columns
        if (insertErr && String(insertErr.message || "").toLowerCase().includes("content")) {
          const candidates = ["watchlist_text", "watchlist", "body", "text"];
          for (const col of candidates) {
            const r4 = await tryUpsert({
              watchlist_date: today,
              [col]: baseText,
              ...safeSections,
              created_by: user.id,
            });
            insertErr = r4.error;

            if (
              insertErr &&
              String(insertErr.message || "").toLowerCase().includes("duplicate key")
            ) {
              const r4u = await tryUpdateToday({ [col]: baseText, ...safeSections });
              insertErr = r4u.error;
            }

            if (insertErr && String(insertErr.message || "").toLowerCase().includes("watchlist_date")) {
              const r4i = await tryInsert({ [col]: baseText, ...safeSections, created_by: user.id });
              insertErr = r4i.error;
            }
            if (!insertErr) break;
          }
        }
      }

      if (insertErr) throw insertErr;


      // Clear local selections after successful publish
      setWatchlistImages([]);
      setWatchlistScreenshotUrls(allUrls);
      // Keep the text so you can keep editing/updating today's watchlist.
      setWatchlistDraft(baseText);
      setWatchlistError(null);

      // Reload latest post (so everyone sees it immediately)
      await loadWatchlist();
    } catch (e: any) {
      setWatchlistError(e?.message ?? "Failed to publish watchlist.");
    } finally {
      setWatchlistSaving(false);
      setWatchlistUploading(false);
      setWatchlistImages([]);
    }
  }, [watchlistDraft, watchlistImages, user, loadWatchlist]);

  useEffect(() => {
    // Load on first mount so everyone sees the latest watchlist immediately
    void loadWatchlist();
  }, [loadWatchlist]);


  /* Derived */
  const tradeRows = useMemo(
    () =>
      trades
        .map((t) => ({ ...t, kind: (t.kind ?? "trade") as "trade" | "withdrawal" }))
        .filter((t) => t.kind === "trade"),
    [trades]
  );

  const withdrawalRows = useMemo(
    () =>
      trades
        .map((t) => ({ ...t, kind: (t.kind ?? "trade") as "trade" | "withdrawal" }))
        .filter((t) => t.kind === "withdrawal"),
    [trades]
  );

  const totalTradePnlAllTime = useMemo(
    () => tradeRows.reduce((acc, t) => acc + (t.pnl || 0), 0),
    [tradeRows]
  );

  const totalWithdrawnAllTime = useMemo(
    () => withdrawalRows.reduce((acc, w) => acc + (w.amount || 0), 0),
    [withdrawalRows]
  );

  // Equity = starting capital + trading PnL - withdrawals
  const equity = useMemo(
    () => startBalance + totalTradePnlAllTime - totalWithdrawnAllTime,
    [startBalance, totalTradePnlAllTime, totalWithdrawnAllTime]
  );

  // Monthly withdrawals (current month)
  const monthlyWithdrawn = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0, 0).getTime();
    const end = new Date(y, m + 1, 1, 0, 0, 0, 0).getTime();
    return withdrawalRows
      .filter((w) => (w.ts || 0) >= start && (w.ts || 0) < end)
      .reduce((acc, w) => acc + (w.amount || 0), 0);
  }, [withdrawalRows]);
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
  const allTimeGrowthPct = startBalance ? (totalTradePnlAllTime / startBalance) * 100 : 0;

  const sessionTrades = useMemo(
    () => tradeRows.filter((t) => !sessionId || (t.ts || 0) >= Number(sessionId)),
    [tradeRows, sessionId]
  );

  const currentRuleBadges = useMemo(
    () =>
      computeRuleBadges({
        lockOnHit,
        maxLoss,
        locked,
        profitOnlyMode,
        riskPct,
        recommendedRiskPct,
      }),
    [lockOnHit, maxLoss, locked, profitOnlyMode, riskPct, recommendedRiskPct]
  );

  // PnL for the current session trades
  const pnl = useMemo(
    () => sessionTrades.reduce((a, t) => a + (t.pnl || 0), 0),
    [sessionTrades]
  );

  const disciplineScore = useMemo(
    () =>
      computeDisciplineScore({
        startBalance,
        equity,
        pnl,
        tradesCount: sessionTrades.length,
        maxLoss,
        lockOnHit,
        locked,
        profitOnlyMode,
        riskPct,
        recommendedRiskPct,
        whyTrade,
        mentalReady,
        sessionTarget,
        setupsToday,
      }),
    [
      startBalance,
      equity,
      pnl,
      sessionTrades.length,
      maxLoss,
      lockOnHit,
      locked,
      profitOnlyMode,
      riskPct,
      recommendedRiskPct,
      whyTrade,
      mentalReady,
      sessionTarget,
      setupsToday,
    ]
  );
  // === Session activity guard: require at least one trade OR equity change (pnl != 0) before ending a session ===
  const hasSessionActivity = useMemo(() => {
    return (sessionTrades.length > 0) || (Math.abs(pnl) > 0.0000001);
  }, [sessionTrades, pnl]);
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
  const todayTradePnl = useMemo(
    () =>
      tradeRows
        .filter((t) => t.ts && ymdLocal(new Date(t.ts)) === todayKey)
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [tradeRows, todayKey]
  );

  // Lock when max-loss hit
  useEffect(() => {
    if (!lockOnHit || maxLoss <= 0) return;
    if (todayTradePnl <= -Math.abs(maxLoss) && !locked) {
      setLocked(true);
      push({ title: "Trading locked for today", desc: `Daily max loss (${currency(maxLoss)}) reached.` });
    }
  }, [todayTradePnl, maxLoss, lockOnHit, locked, setLocked, push]);

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
  function addTrade(
    t: Omit<TradeRow, "id" | "ts"> & Partial<Pick<TradeRow, "source">>
  ) {
    if (locked && lockOnHit) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const row: TradeRow = {
      id,
      ts: Date.now(),
      kind: (t.kind ?? "trade") as "trade" | "withdrawal",
      // default to manual if not provided
      source: t.source ?? "manual",
      ...t,
    };

    setTrades(prev => [row, ...prev]);
  }

  function addTradesBulk(rows: TradeRow[]) {
    if (!rows.length) return;
    setTrades(prev => [
      ...rows.map(r => ({
        ...r,
        kind: (r.kind ?? "trade") as "trade" | "withdrawal",
        source: r.source ?? "auto",
      })),
      ...prev,
    ]);
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
    <div className="mx-auto max-w-7xl space-y-4 px-3 pb-24 pt-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        {/* LEFT: logo + title + status */}
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/ust-logo.png"
            alt="Ultimate Scalper Tool"
            className="h-8 w-auto shrink-0 select-none sm:h-9"
          />
          <h1 className="max-w-[14rem] text-2xl font-bold leading-tight tracking-tight sm:max-w-none md:text-3xl">
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
        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:justify-end">
          <ThemeToggle />

          <Button disabled={!hasSessionActivity}
            onClick={async () => {
              if (!hasSessionActivity) {
                push({ title: "No trades logged", desc: "You can’t end the session without at least one trade or equity change." });
                return;
              }
              try {
                if (!user?.id) {
                  push({ title: "Please sign in", desc: "You need to sign in to save sessions." });
                  return;
                }
                const startedAtISO = new Date(Number(sessionId || Date.now())).toISOString();
                const endedAtISO = new Date().toISOString();

                // Build + store local Session Summary (shows on Dashboard)
                const safeSessionId = sessionId ?? crypto.randomUUID();
                const summary = buildSessionSummary({
                  sessionId: safeSessionId,
                  startedAt: startedAtISO,
                  endedAt: endedAtISO,
                  pnl: Number(pnl || 0),
                  trades: sessionTrades.map((t) => ({ market: t.symbol, pnl: t.pnl })),
                  disciplineScore,
                  badges: currentRuleBadges,
                });
                setLastSessionSummary(summary);

                await recordSessionToLeaderboard(user.id, Number(pnl || 0), startedAtISO, endedAtISO);
                newSessionId();
                push({
                  title: "Session saved",
                  desc: `Leaderboard updated • Discipline ${summary.disciplineScore}/100`,
                });
              } catch (e) {
                console.error(e);
                newSessionId();
              }
            }}
          >
            <span className="hidden sm:inline">End Session / Start New</span><span className="sm:hidden">End / New</span>
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
          className="no-scrollbar mb-3 flex w-full snap-x gap-2 overflow-x-auto whitespace-nowrap bg-transparent p-0 pb-2"
        >
          {/* Dashboard */}
         <TabsTrigger
  value="dashboard"
  className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
  Dashboard
</TabsTrigger>


          {/* Analytics */}
          <TabsTrigger
            value="analytics"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Analytics
          </TabsTrigger>

          {/* Risk & Sizing (Deriv) */}
          <TabsTrigger
            value="risk-deriv"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Risk &amp; Sizing (Deriv)
          </TabsTrigger>

          {/* Risk & Sizing (FX) */}
          <TabsTrigger
            value="risk-fx"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Risk &amp; Sizing (FX)
          </TabsTrigger>

          {/* Risk & Sizing (XAU/NAS/US30/BTC) */}
          <TabsTrigger
            value="risk-majors"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Risk &amp; Sizing (XAU/NAS/US30/BTC)
          </TabsTrigger>

          {/* Trade Journal */}
          <TabsTrigger
            value="journal"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Trade Journal
          </TabsTrigger>

          {/* Calendar */}
          <TabsTrigger
            value="calendar"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Calendar
          </TabsTrigger>
            <TabsTrigger
              value="watchlist"
              className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black"
            >
              Watchlist
            </TabsTrigger>

          {/* A-Setups */}
          <TabsTrigger
            value="asetups"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            A-Setups
          </TabsTrigger>

          {/* Checklist */}
          <TabsTrigger
            value="checklist"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Checklist
          </TabsTrigger>

          {/* Leaderboard */}
          <a
            href="/leaderboard"
            className="snap-start rounded-xl px-4 py-2 text-sm data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:data-[state=active]:bg-[#D4AF37] dark:data-[state=active]:text-black transition-colors"
>
            Leaderboard
          </a>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.13),transparent_28%),linear-gradient(135deg,#07111f_0%,#0b1220_55%,#101827_100%)] p-3 shadow-2xl shadow-black/25 dark:border-slate-700/70 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#F6C945]">Trading Command Centre</p>
                <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">Dashboard Overview</h2>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold shadow-lg ${locked && lockOnHit ? "border-rose-500/50 bg-rose-500/10 text-rose-300 shadow-rose-950/30" : "border-emerald-400/50 bg-emerald-500/10 text-emerald-300 shadow-emerald-950/30"}`}>
                <Activity className="h-4 w-4" />
                {locked && lockOnHit ? "Trading Locked" : "Trading Active"}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <DashCard title="Equity" value={currency(equity)} hint={`Start: ${currency(startBalance)}`} tone={equity >= startBalance ? "positive" : "negative"} featured icon="wallet" spark="up" />
              <DashCard
                title="PNL (this session)"
                value={currency(pnl)}
                hint={`Closed trades: ${closed}${sessionPct ? ` • ${sessionPct}` : ""}`}
                tone={pnl > 0 ? "positive" : pnl < 0 ? "negative" : "blue"}
                featured
                icon="trend"
                spark="flat"
              />
              <DashCard title="Win rate" value={`${fmt(winRate)}%`} hint={`${wins}W / ${losses}L / ${bes}BE`} tone={winRate >= 50 ? "purple" : closed > 0 ? "warning" : "purple"} featured icon="pie" />
              <DashCard title="Discipline" value={`${disciplineScore}/100`} hint={currentRuleBadges.length ? `${currentRuleBadges.length} rules active` : "Checklist pending"} tone={disciplineScore >= 80 ? "positive" : disciplineScore >= 60 ? "gold" : "negative"} featured icon="shield" progress={disciplineScore} />
            </div>
          </div>

          <SectionLabel title="Capital & Growth" icon="bars" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DashCard title="Starting Capital" value={currency(startBalance)} icon="wallet" />
            <DashCard
              title="All-time Trade PnL"
              value={`${totalTradePnlAllTime >= 0 ? "+" : ""}${currency(Number(totalTradePnlAllTime.toFixed(2)))}`}
              tone={totalTradePnlAllTime > 0 ? "positive" : totalTradePnlAllTime < 0 ? "negative" : "neutral"}
              icon="growth"
            />
            <DashCard
              title="Total Withdrawn"
              value={`-${currency(Number(totalWithdrawnAllTime.toFixed(2)))}`}
              hint="All time"
              tone={totalWithdrawnAllTime > 0 ? "negative" : "neutral"}
              icon="down"
            />
            <DashCard
              title="Monthly Withdrawals"
              value={`-${currency(Number(monthlyWithdrawn.toFixed(2)))}`}
              hint="Current month"
              tone={monthlyWithdrawn > 0 ? "negative" : "neutral"}
              icon="calendar"
            />
            <DashCard title="All-time Growth" value={`${fmt(allTimeGrowthPct)}%`} hint="Based on starting capital" tone={allTimeGrowthPct > 0 ? "positive" : allTimeGrowthPct < 0 ? "negative" : "neutral"} icon="growth" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]"><BarChart3 className="h-4 w-4" /></div>
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-white">Performance Summary</h4>
                </div>
                <div className="space-y-2">
                  <MetricRow label="Best Day" value={currency(Math.max(todayTradePnl, pnl, 0))} tone="positive" icon="trophy" />
                  <MetricRow label="Worst Day" value={currency(Math.min(todayTradePnl, pnl, 0))} tone="negative" icon="down" />
                  <MetricRow label="Average Daily PnL" value={currency(Number(todayTradePnl.toFixed(2)))} tone={todayTradePnl >= 0 ? "blue" : "negative"} icon="bars" />
                  <MetricRow label="Profit Factor" value={closed ? fmt(wins / Math.max(losses, 1)) : "0.00"} tone="purple" icon="scale" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/5 text-white"><Target className="h-4 w-4" /></div>
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-white">Daily Target Progress</h4>
                </div>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Daily Target</span>
                  <span>{currency(sessionTarget || 0)}</span>
                </div>
                <div className="text-3xl font-black text-[#F6C945]">{sessionTarget > 0 ? fmt(Math.max(0, Math.min(100, (pnl / sessionTarget) * 100))) : "0"}%</div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F6C945] to-amber-400" style={{ width: `${sessionTarget > 0 ? Math.max(0, Math.min(100, (pnl / sessionTarget) * 100)) : 0}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>{currency(Math.max(0, pnl))} achieved</span>
                  <span>{currency(Math.max(0, (sessionTarget || 0) - pnl))} remaining</span>
                </div>
                <div className="mt-4 rounded-lg border border-[#F6C945]/30 bg-[#F6C945]/10 px-3 py-2 text-sm text-slate-200">
                  <Star className="mr-2 inline h-4 w-4 text-[#F6C945]" /> Stay focused. Consistency compounds.
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]"><CalendarDays className="h-4 w-4" /></div>
                    <div>
                      <h4 className="text-base font-extrabold uppercase tracking-wide text-white">Last Session Summary</h4>
                      <p className="text-xs text-slate-400">{lastSessionSummary ? `${new Date(lastSessionSummary.endedAt).toLocaleString()} • ${lastSessionSummary.topMarket}` : "No previous session recorded"}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">{lastSessionSummary ? "Completed" : "No Trades"}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <MiniStat label="Trades" value={`${lastSessionSummary?.trades ?? 0}`} tone="blue" />
                  <MiniStat label="Win Rate" value={`${fmt(lastSessionSummary?.winRate ?? 0)}%`} tone="positive" />
                  <MiniStat label="Best Trade" value={currency(Math.max(...sessionTrades.map(t => t.pnl || 0), 0))} tone="positive" />
                  <MiniStat label="Worst Trade" value={currency(Math.min(...sessionTrades.map(t => t.pnl || 0), 0))} tone="negative" />
                </div>
                <div className="mt-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
                  <Info className="mr-2 inline h-4 w-4" />
                  {closed ? "Review entries with precision. Repeat what worked and remove what failed." : "No trades recorded this session. Execute with precision. Review with purpose."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-gradient-to-r from-[#0b1220] to-[#111827] px-4 py-3 text-center text-sm text-slate-300 shadow-lg">
            <span className="text-[#F6C945]">⚡</span> Discipline is doing what needs to be done, even when you don&apos;t feel like doing it.
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
              <CardContent className="p-5 space-y-3">
                <h4 className="text-lg font-semibold text-white">Session Discipline</h4>
                <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">Discipline Score</span>
                    <span className="text-sm font-bold text-[#F6C945]">{disciplineScore}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-2 bg-[#D4AF37]" style={{ width: `${disciplineScore}%` }} />
                  </div>
                  {currentRuleBadges.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400">Rules Enforced</div>
                      <div className="flex flex-wrap gap-2">
                      {currentRuleBadges.slice(0, 6).map((b: string) => (
                        <span key={b} className="px-2 py-1 rounded-full text-xs border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-slate-200">{b}</span>
                      ))}
                    </div>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1"><Label>Daily Max Loss (USD)</Label><Input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value) || 0)} /></div>
                  <div className="md:col-span-1"><Label>Stop trading at -Max Loss</Label><Select value={String(lockOnHit)} onValueChange={(v: string) => setLockOnHit(v === "true")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="z-[70] bg-white border shadow-md"><SelectItem value="true">Enabled</SelectItem><SelectItem value="false">Disabled</SelectItem></SelectContent></Select></div>
                  <div className="md:col-span-1"><Label>Today PnL</Label><div className={`h-10 grid place-items-center rounded-md border ${todayTradePnl < 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : todayTradePnl > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-200"}`}><strong>{todayTradePnl >= 0 ? "+" : ""}{currency(Number(todayTradePnl.toFixed(2)))}</strong></div></div>
                </div>
                <div className={`rounded-md border p-3 text-sm ${locked && lockOnHit ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>
                  <div className="flex items-center justify-between gap-2"><span><strong>Status:</strong> {locked && lockOnHit ? "Locked for today (max loss hit)" : "Active"}</span><div className="flex gap-2"><Button variant="outline" onClick={resetDailyLock}>Reset Lock</Button>{locked && lockOnHit && (<Button onClick={() => { setLockOnHit(false); push({ title: "Override", desc: "Lock disabled for today." }); }}>Override</Button>)}</div></div>
                </div>
                <div className="text-xs text-slate-400">When enabled, Quick Logger and New Trade are disabled once today&apos;s PnL ≤ -Daily Max Loss. Auto-unlocks at local midnight.</div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
              <CardContent className="p-5 space-y-4">
                <h4 className="text-lg font-semibold text-white">Goals</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Weekly Target (USD)</Label><Input type="number" value={weeklyTarget} onChange={(e) => setWeeklyTarget(Number(e.target.value) || 0)} /></div>
                  <div><Label>Monthly Target (USD)</Label><Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value) || 0)} /></div>
                </div>
                <GoalProgress label="Weekly Progress" progress={Number(weeklyProgress.toFixed(2))} target={weeklyTarget || 0} />
                <GoalProgress label="Monthly Progress" progress={Number(monthlyProgress.toFixed(2))} target={monthlyTarget || 0} />
              </CardContent>
            </Card>
          </div>

          <BadgeShowcase badge={badge} sessionsCount={sessionsCount} />

          <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
            <CardContent className="p-5">
              <h4 className="text-lg font-semibold mb-2 text-white">Equity Curve (All Time)</h4>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equitySeries} margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <RTooltip labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} />
                    <Line type="monotone" dataKey="equity" stroke="#22c55e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <AnalyticsPanel trades={tradeRows} />
        </TabsContent>

        {/* RISK & SIZING — DERIV */}
        <TabsContent value="risk-deriv" className="space-y-4">
          <CapitalAndRiskSummary equity={equity} riskAmount={riskAmount} riskPct={riskPct} />

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
              { id: "nas", defaultSymbol: "US Tech 100", defaultPipValue: 1 },   // placeholder
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

          {/* Auto-Import from Google Sheets */}
          <div className="border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-2">Auto-Import Closed Trades (Google Sheets)</h3>
            {/* FIX: pass addTradesBulk as a prop so it's in scope */}
            <AutoImportPanel addTradesBulkFn={addTradesBulk} />
          </div>


          {/* Record Withdrawal (does not count as trading loss) */}
          <Card className="border-[#D4AF37]/40 mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Withdrawal</h3>
                <span className="text-xs text-slate-500">Affects equity only (not a trading loss)</span>
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <Label>Amount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 250"
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="md:col-span-6">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. Paid rent / withdrew profits"
                    value={withdrawNote}
                    onChange={(e) => setWithdrawNote(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    className="w-full bg-[#D4AF37] text-black hover:bg-yellow-400"
                    disabled={withdrawAmt <= 0}
                    onClick={() => {
                      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                      setTrades((prev) => [
                        {
                          id,
                          ts: Date.now(),
                          kind: "withdrawal",
                          amount: Number(withdrawAmt.toFixed(2)),
                          pnl: 0,
                          symbol: "Withdrawals",
                          notes: withdrawNote || "Withdrawal recorded",
                          source: "manual",
                        },
                        ...prev,
                      ]);
                      setWithdrawAmt(0);
                      setWithdrawNote("");
                      push({ title: "Withdrawal recorded", desc: "Saved (does not count as a trading loss)." });
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
          <OldCalendar trades={tradeRows} withdrawals={withdrawalRows} />
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
                Use this tab to confirm your plan and set your Start Capital + Risk % before starting a session.
                Copy the summary and paste to Telegram/Slack if you like.
              </p>

              {/* Set Start Capital + Risk % here (recommended before every session) */}
              <CapitalAndRiskCard
                startBalance={startBalance}
                setStartBalance={setStartBalance}
                riskPct={riskPct}
                setRiskPct={setRiskPct}
                equity={equity}
                riskAmount={riskAmount}
                tradesCount={trades.length}
              />


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
                      <Label>Profit-Only Trigger (info, % of start)</Label>
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
                    <div className="text-sm font-medium mb-1">Live Snapshot (read-only)</div>
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
                        `Profit-Only threshold: ${thresholdPct}% (${currency((thresholdPct/100)*startBalance)})`,
                        givebackPct ? `Giveback lock (info): ${givebackPct}%` : null,
                        `Time: ${new Date().toLocaleString()}`
                      ].filter(Boolean).join("\n");
                      navigator.clipboard.writeText(txt).then(()=>{
                        push({ title: "Copied", desc: "Checklist summary copied." });
                      });
                    }}>Copy Summary</Button>

                    <Button variant="outline" onClick={()=>{
                      const id = newSessionId();
                      push({ title: "Session started", desc: `Session ID: ${id}` });
                    }}>Start Session</Button>
                  </div>

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

      
        {/* Watchlist */}
        <TabsContent value="watchlist" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Daily Watchlist</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Updated by the UST admin — everyone sees the same latest plan.
                </p>
                <p className="text-xs opacity-70 mt-1">Signed in UID: {(user as any)?.id || (user as any)?.user?.id || "—"} {isAdmin ? "(admin)" : ""}</p>
              </div>

              <Button
                variant="secondary"
                onClick={() => void loadWatchlist()}
                disabled={watchlistLoading}
              >
                {watchlistLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </CardHeader>

            <CardContent>
              {watchlistError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  {watchlistError}
                  <div className="mt-2 text-xs opacity-80">
                    If this is your first time using it: create the Supabase table{" "}
                    <code className="px-1">ust_watchlist</code> and allow{" "}
                    <code className="px-1">SELECT</code> for everyone.
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    Latest update:{" "}
                    <span className="text-foreground">
                      {watchlistLatest?.created_at
                        ? new Date(watchlistLatest.created_at).toLocaleString()
                        : "—"}
                    </span>
                  </span>
                </div>

                <div className="rounded-lg border bg-card/40 p-4">
                  {getWatchlistContent(watchlistLatest) ? (
                    <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {watchlistLatest.content}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No watchlist posted yet.
                    </p>
                  )}

                  {watchlistScreenshotUrls?.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {watchlistScreenshotUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-md border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Watchlist screenshot"
                            className="h-auto w-full"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>

                {watchlistHistory?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Recent history
                    </p>
                    <div className="grid gap-2">
                      {watchlistHistory.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-start justify-between gap-3 rounded-md border bg-background/20 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {w.content?.split("\n")?.[0] ?? "Watchlist"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {w.created_at
                                ? new Date(w.created_at).toLocaleString()
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Admin Editor</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Edit the watchlist here and publish — it updates for everyone.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={watchlistDraft}
                  onChange={(e) => setWatchlistDraft(e.target.value)}
                  placeholder="Paste your daily watchlist here…"
                  className="min-h-[220px] w-full rounded-md border bg-background/30 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />

                <div className="rounded-md border bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Screenshots (optional)</p>
                    {watchlistUploading ? (
                      <p className="text-xs text-muted-foreground">Uploading…</p>
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Add chart screenshots for your watchlist/monitor list. Only the admin can upload; everyone can view.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        setWatchlistUploadError(null);
                        const files = Array.from(e.target.files || []);
                        setWatchlistImages(files);
                      }}
                    />
                    {watchlistImages.length ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setWatchlistImages([])}
                      >
                        Clear selected
                      </Button>
                    ) : null}
                  </div>

                  {watchlistUploadError ? (
                    <p className="mt-2 text-xs text-red-400">{watchlistUploadError}</p>
                  ) : null}

                  {watchlistImages.length ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                      {watchlistImages.map((f) => (
                        <li key={f.name}>{f.name}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void publishWatchlist()}
                    disabled={watchlistSaving || watchlistLoading || !watchlistDraft.trim()}
                  >
                    {watchlistSaving ? "Publishing..." : "Publish Watchlist"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => setWatchlistDraft(getWatchlistContent(watchlistLatest) ?? "")}
                    disabled={watchlistSaving || watchlistLoading}
                  >
                    Reset to Latest
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Tip: set <code className="px-1">NEXT_PUBLIC_UST_ADMIN_USER_ID</code>{" "}
                  or <code className="px-1">NEXT_PUBLIC_UST_ADMIN_EMAIL</code> so only
                  you can see this editor.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>


        <TabsList className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur md:hidden">
          <TabsTrigger value="dashboard" className="rounded-xl px-2 py-2 text-[11px] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Home</TabsTrigger>
          <TabsTrigger value="journal" className="rounded-xl px-2 py-2 text-[11px] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Journal</TabsTrigger>
          <TabsTrigger value="calendar" className="rounded-xl px-2 py-2 text-[11px] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Calendar</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl px-2 py-2 text-[11px] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Stats</TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-xl px-2 py-2 text-[11px] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Plan</TabsTrigger>
        </TabsList>

</Tabs>
    </div>
  );
}

/* =========================================================================
   Reusable UI blocks
============================================================================ */
type DashTone = "neutral" | "positive" | "negative" | "warning" | "gold" | "blue" | "purple";
type DashIcon = "wallet" | "trend" | "growth" | "down" | "calendar" | "shield" | "pie" | "bars" | "trophy" | "scale";

function SectionLabel({ title, icon }: { title: string; icon?: DashIcon }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      {icon && (
        <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/30 bg-[#F6C945]/10 text-[#F6C945]">
          <DashIconView icon={icon} className="h-4 w-4" />
        </div>
      )}
      <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-100">{title}</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/70 to-transparent" />
    </div>
  );
}

function DashIconView({ icon, className = "h-5 w-5" }: { icon: DashIcon; className?: string }) {
  switch (icon) {
    case "wallet":
      return <Wallet className={className} />;
    case "trend":
    case "growth":
    case "trophy":
      return <TrendingUp className={className} />;
    case "down":
      return <TrendingDown className={className} />;
    case "calendar":
      return <CalendarDays className={className} />;
    case "shield":
      return <ShieldCheck className={className} />;
    case "pie":
      return <PieChart className={className} />;
    case "scale":
      return <Scale className={className} />;
    case "bars":
    default:
      return <BarChart3 className={className} />;
  }
}

function toneClasses(tone: DashTone = "neutral") {
  switch (tone) {
    case "positive":
      return "border-emerald-500/35 bg-gradient-to-br from-emerald-500/14 to-slate-950 text-emerald-300 shadow-emerald-950/25";
    case "negative":
      return "border-rose-500/35 bg-gradient-to-br from-rose-500/14 to-slate-950 text-rose-300 shadow-rose-950/25";
    case "warning":
      return "border-amber-500/35 bg-gradient-to-br from-amber-500/14 to-slate-950 text-amber-300 shadow-amber-950/25";
    case "gold":
      return "border-[#F6C945]/40 bg-gradient-to-br from-[#F6C945]/14 to-slate-950 text-[#F6C945] shadow-amber-950/25";
    case "blue":
      return "border-blue-500/35 bg-gradient-to-br from-blue-500/14 to-slate-950 text-blue-300 shadow-blue-950/25";
    case "purple":
      return "border-violet-500/35 bg-gradient-to-br from-violet-500/14 to-slate-950 text-violet-300 shadow-violet-950/25";
    default:
      return "border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 shadow-black/20";
  }
}

function toneText(tone: DashTone = "neutral") {
  switch (tone) {
    case "positive":
      return "text-emerald-400";
    case "negative":
      return "text-rose-400";
    case "warning":
      return "text-amber-300";
    case "gold":
      return "text-[#F6C945]";
    case "blue":
      return "text-blue-400";
    case "purple":
      return "text-violet-400";
    default:
      return "text-white";
  }
}

function SparkLine({ kind = "flat", tone = "positive" }: { kind?: "up" | "flat"; tone?: DashTone }) {
  const stroke = tone === "positive" ? "#22c55e" : tone === "negative" ? "#f43f5e" : tone === "blue" ? "#3b82f6" : "#F6C945";
  const points = kind === "up" ? "0,44 18,42 34,36 50,24 68,30 86,30 104,20 122,27 140,24 158,18 176,29 194,28 212,10 230,14 248,19 266,11 284,2" : "0,28 22,28 44,25 66,30 88,27 110,29 132,27 154,28 176,28 198,26 220,30 242,24 264,31 284,23";
  return (
    <svg viewBox="0 0 284 48" className="mt-4 h-12 w-full opacity-90">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="0" y1="44" x2="284" y2="44" stroke={stroke} strokeOpacity="0.18" />
    </svg>
  );
}

function DashCard({
  title,
  value,
  hint,
  tone = "neutral",
  featured = false,
  icon,
  spark,
  progress,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: DashTone;
  featured?: boolean;
  icon?: DashIcon;
  spark?: "up" | "flat";
  progress?: number;
}) {
  return (
    <Card className={`group overflow-hidden border shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${toneClasses(tone)}`}>
      <CardContent className={featured ? "relative min-h-[150px] p-5" : "relative min-h-[105px] p-4"}>
        {icon && (
          <div className={`absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border bg-white/5 ${toneText(tone)} border-current/30`}>
            <DashIconView icon={icon} className="h-5 w-5" />
          </div>
        )}
        <div className="pr-12 text-sm font-bold text-slate-200">{title}</div>
        <div className={`${featured ? "text-3xl" : "text-2xl"} mt-2 font-black tracking-tight ${toneText(tone)}`}>{value}</div>
        {hint && <div className="mt-1 text-sm text-slate-400">{hint}</div>}
        {spark && <SparkLine kind={spark} tone={tone} />}
        {typeof progress === "number" && (
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-[#F6C945] to-amber-400" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value, tone = "neutral", icon = "bars" }: { label: string; value: string; tone?: DashTone; icon?: DashIcon }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-3">
        <div className={`grid h-8 w-8 place-items-center rounded-lg bg-white/5 ${toneText(tone)}`}>
          <DashIconView icon={icon} className="h-4 w-4" />
        </div>
        <span className="font-semibold text-slate-200">{label}</span>
      </div>
      <span className={`font-extrabold ${toneText(tone)}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: DashTone }) {
  return (
    <div>
      <div className={`mb-1 text-xl font-black ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function MiniProgress({ title, current, target }: { title: string; current: number; target: number }) {
  const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const tone = current >= target && target > 0 ? "text-emerald-400" : current < 0 ? "text-rose-400" : "text-[#F6C945]";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-100">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-slate-400">Target: {target > 0 ? currency(target) : "Not set"}</div>
        </div>
        <div className={`text-right text-lg font-bold ${tone}`}>{current >= 0 ? "+" : ""}{currency(Number(current.toFixed(2)))}</div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-[#D4AF37] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-right text-xs text-slate-400">{target > 0 ? `${fmt(pct)}% reached` : "Add a target in Goals"}</div>
    </div>
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
    <div className="grid md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-[#D4AF37]/10 border-[#D4AF37]">
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
    <div className="grid md:grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-[#D4AF37]/10 border-[#D4AF37]">
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
  "Volatility 75 (1s) Index",
  "Volatility 75 Index",
  "Volatility 50 Index",      // ✅ ADD THIS
  "Volatility 25 (1s) Index",
  "Volatility 25 Index",
  ];

  // Default FX + Major indices if nothing is stored yet
  const defaults = [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCAD",
    "XAUUSD",
    "US Tech 100",
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
    market: "Volatility 75 (1s) Index",
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
                <Button
  variant="outline"
  className="text-yellow-500 border-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors"
  onClick={() => removeRow(r.id)}
  disabled={locked}
>
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
  const [journalSearch, setJournalSearch] = React.useState("");
  const [journalFilter, setJournalFilter] = React.useState<"all" | "wins" | "losses" | "withdrawals">("all");
  const [selectedTrade, setSelectedTrade] = React.useState<TradeRow | null>(null);

  const histRaw = typeof window !== "undefined" ? localStorage.getItem("ust-session-history") : "[]";
  const hist: string[] = histRaw ? JSON.parse(histRaw) : [];
  const sessionsSorted = [...hist].map(Number).sort((a, b) => a - b);
  const all = [...trades].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const tradeOnly = all.filter((t) => (t.kind ?? "trade") !== "withdrawal");
  const withdrawalsOnly = all.filter((t) => (t.kind ?? "trade") === "withdrawal");
  const wins = tradeOnly.filter((t) => (t.pnl || 0) > 0).length;
  const losses = tradeOnly.filter((t) => (t.pnl || 0) < 0).length;
  const be = tradeOnly.filter((t) => (t.pnl || 0) === 0).length;
  const totalPnl = tradeOnly.reduce((a, t) => a + (t.pnl || 0), 0);
  const totalWithdrawn = withdrawalsOnly.reduce((a, t) => a + (t.amount || 0), 0);
  const winRate = tradeOnly.length ? (wins / tradeOnly.length) * 100 : 0;
  const avgPnl = tradeOnly.length ? totalPnl / tradeOnly.length : 0;
  const bestTrade = tradeOnly.length ? Math.max(...tradeOnly.map((t) => t.pnl || 0)) : 0;
  const worstTrade = tradeOnly.length ? Math.min(...tradeOnly.map((t) => t.pnl || 0)) : 0;

  const filteredAll = all.filter((t) => {
    const q = journalSearch.trim().toLowerCase();
    const matchesText = !q || `${t.symbol} ${t.notes || ""} ${t.source || ""}`.toLowerCase().includes(q);
    const kind = t.kind ?? "trade";
    const matchesFilter = journalFilter === "all" ||
      (journalFilter === "wins" && kind !== "withdrawal" && (t.pnl || 0) > 0) ||
      (journalFilter === "losses" && kind !== "withdrawal" && (t.pnl || 0) < 0) ||
      (journalFilter === "withdrawals" && kind === "withdrawal");
    return matchesText && matchesFilter;
  });

  type Bucket = { title: string; rows: TradeRow[]; startTs?: number };
  const buckets: Bucket[] = [];
  function titleFor(ts: number, idx: number) {
    const d = new Date(ts);
    return `Session ${idx + 1} (${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })})`;
  }
  if (sessionsSorted.length) {
    for (let i = 0; i < sessionsSorted.length; i++) {
      const start = sessionsSorted[i];
      const end = i < sessionsSorted.length - 1 ? sessionsSorted[i + 1] : Infinity;
      const rows = filteredAll.filter((t) => (t.ts || 0) >= start && (t.ts || 0) < end);
      if (rows.length) buckets.push({ title: titleFor(start, i), rows, startTs: start });
    }
  } else if (filteredAll.length) buckets.push({ title: "All Trades", rows: filteredAll });

  const totalAll = (rows: TradeRow[]) => rows.reduce((a, t) => a + ((t.kind ?? "trade") === "withdrawal" ? 0 : (t.pnl || 0)), 0);
  const priorPnlBefore = (ts: number) => all.filter((t) => (t.ts || 0) < ts && (t.kind ?? "trade") !== "withdrawal").reduce((a, t) => a + (t.pnl || 0), 0);
  const qualityLabel = winRate >= 60 && totalPnl >= 0 ? "A-Grade Execution" : winRate >= 45 ? "Needs Review" : tradeOnly.length ? "Protect Capital" : "No Trades Yet";
  const qualityTone = winRate >= 60 && totalPnl >= 0 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : winRate >= 45 ? "border-[#F6C945]/40 bg-[#F6C945]/10 text-[#F6C945]" : tradeOnly.length ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-slate-600 bg-slate-800/60 text-slate-300";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_28%),linear-gradient(135deg,#07111f_0%,#0b1220_55%,#101827_100%)] p-4 text-slate-100 shadow-2xl shadow-black/25 md:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#F6C945]">Trade Intelligence Centre</p>
            <h3 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">Journal Overview</h3>
            <p className="mt-1 text-sm text-slate-400">Review execution quality, market performance, and every logged trade.</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold shadow-lg ${qualityTone}`}>
            <ShieldCheck className="h-4 w-4" />{qualityLabel}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="col-span-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 shadow-lg shadow-emerald-950/20 xl:col-span-2">
            <p className="text-sm font-bold text-slate-300">Net Trade PnL</p>
            <div className={`mt-2 text-4xl font-black ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{totalPnl >= 0 ? "+" : ""}{currency(Number(totalPnl.toFixed(2)))}</div>
            <p className="mt-1 text-sm text-slate-400">Growth: {formatPct(totalPnl, startBalance) || "0.00%"}</p>
          </div>
          <JournalStat label="Trades" value={`${tradeOnly.length}`} hint={`${wins}W / ${losses}L / ${be}BE`} tone="blue" />
          <JournalStat label="Win Rate" value={`${fmt(winRate)}%`} hint="Closed trades" tone={winRate >= 50 ? "positive" : "warning"} />
          <JournalStat label="Avg PnL" value={currency(Number(avgPnl.toFixed(2)))} hint="Per trade" tone={avgPnl >= 0 ? "positive" : "negative"} />
          <JournalStat label="Withdrawn" value={`-${currency(Number(totalWithdrawn.toFixed(2)))}`} hint="All time" tone={totalWithdrawn > 0 ? "gold" : "neutral"} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-2">
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]"><BarChart3 className="h-4 w-4" /></div>
                <div><h4 className="text-base font-extrabold uppercase tracking-wide text-white">Trade Log</h4><p className="text-xs text-slate-400">Grouped by session with smart filters.</p></div>
              </div>
              <Button variant="outline" onClick={() => exportCsv(trades)} className="border-[#F6C945]/50 bg-[#F6C945]/10 text-[#F6C945] hover:bg-[#F6C945] hover:text-black">Export CSV</Button>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <Input value={journalSearch} onChange={(e) => setJournalSearch(e.target.value)} placeholder="Search market, notes, source..." className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
              <div className="flex flex-wrap gap-2">
                {(["all", "wins", "losses", "withdrawals"] as const).map((f) => (
                  <Button key={f} type="button" variant="outline" onClick={() => setJournalFilter(f)} className={`${journalFilter === f ? "border-[#F6C945] bg-[#F6C945] text-black" : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800"} capitalize`}>{f}</Button>
                ))}
              </div>
            </div>
            {buckets.length ? <div className="space-y-4">{buckets.slice().reverse().map((b, i) => {
              const total = totalAll(b.rows); const baseEquity = b.startTs ? startBalance + priorPnlBefore(b.startTs) : startBalance; const pct = formatPct(total, baseEquity);
              const rowsTradeOnly = b.rows.filter((r) => (r.kind ?? "trade") !== "withdrawal"); const sw = rowsTradeOnly.filter((r) => (r.pnl || 0) > 0).length; const sessionWinRate = rowsTradeOnly.length ? (sw / rowsTradeOnly.length) * 100 : 0;
              return <div key={i} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-4 py-3"><div><div className="font-bold text-white">{b.title}</div><div className="text-xs text-slate-400">{rowsTradeOnly.length} trades • {fmt(sessionWinRate)}% WR</div></div><div className="flex items-baseline gap-2"><div className={`text-xl font-black ${total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{total >= 0 ? "+" : ""}{currency(Number(total.toFixed(2)))}</div>{pct && <span className="text-xs text-slate-400">({pct})</span>}</div></div>
                <div className="hidden grid-cols-12 border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 md:grid"><div className="col-span-2">Time</div><div className="col-span-2">Market</div><div className="col-span-4">Strategy / Notes</div><div className="col-span-2">Source</div><div className="col-span-1 text-right">PnL</div><div className="col-span-1 text-right">Action</div></div>
                {b.rows.slice().reverse().map((t) => { const isWithdrawal = (t.kind ?? "trade") === "withdrawal"; const amount = isWithdrawal ? (t.amount || 0) : (t.pnl || 0); const amountTone = isWithdrawal ? "text-[#F6C945]" : amount >= 0 ? "text-emerald-400" : "text-rose-400"; return <div key={t.id} onClick={() => setSelectedTrade(t)} className="mx-3 mb-3 grid cursor-pointer grid-cols-1 gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800/55 md:mx-0 md:mb-0 md:grid-cols-12 md:items-center md:rounded-none md:border-0 md:border-b md:border-slate-800/70 md:bg-transparent md:px-4"><div className="text-slate-300 md:col-span-2">{t.ts ? new Date(t.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</div><div className="flex items-center gap-2 font-bold text-white md:col-span-2"><span>{t.symbol}</span>{isWithdrawal && <span className="rounded-full bg-[#F6C945] px-2 py-[2px] text-[10px] font-black text-black">Withdrawal</span>}</div><div className="text-slate-300 md:col-span-4">{t.notes || "—"}</div><div className="md:col-span-2"><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs capitalize text-slate-300">{t.source || "manual"}</span></div><div className={`font-black md:col-span-1 md:text-right ${amountTone}`}>{isWithdrawal ? "-" : amount >= 0 ? "+" : ""}{currency(Number(amount.toFixed(2)))}</div><div className="md:col-span-1 md:text-right"><Button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} size="sm" className="border border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white">Delete</Button></div></div>})}
              </div>
            })}</div> : <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">No matching trades yet. Use Quick Logger above or adjust your filter.</div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20"><CardContent className="p-5"><div className="mb-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/35 bg-emerald-500/10 text-emerald-300"><Target className="h-4 w-4" /></div><h4 className="text-base font-extrabold uppercase tracking-wide text-white">Execution Snapshot</h4></div><div className="space-y-2"><MetricRow label="Best Trade" value={currency(Number(bestTrade.toFixed(2)))} tone="positive" icon="growth" /><MetricRow label="Worst Trade" value={currency(Number(worstTrade.toFixed(2)))} tone="negative" icon="down" /><MetricRow label="Break Even" value={`${be}`} tone="blue" icon="scale" /><MetricRow label="Total Trades" value={`${tradeOnly.length}`} tone="purple" icon="bars" /></div></CardContent></Card>
          <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20"><CardContent className="p-5"><div className="mb-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]"><Info className="h-4 w-4" /></div><h4 className="text-base font-extrabold uppercase tracking-wide text-white">Selected Trade</h4></div>{selectedTrade ? <div className="space-y-3 text-sm"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs uppercase tracking-widest text-slate-500">Market</p><p className="text-lg font-black text-white">{selectedTrade.symbol}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs uppercase tracking-widest text-slate-500">Result</p><p className={`text-xl font-black ${(selectedTrade.kind ?? "trade") === "withdrawal" ? "text-[#F6C945]" : (selectedTrade.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{(selectedTrade.kind ?? "trade") === "withdrawal" ? `-${currency(selectedTrade.amount || 0)}` : `${(selectedTrade.pnl || 0) >= 0 ? "+" : ""}${currency(selectedTrade.pnl || 0)}`}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs uppercase tracking-widest text-slate-500">Source</p><p className="text-lg font-black capitalize text-white">{selectedTrade.source || "manual"}</p></div></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs uppercase tracking-widest text-slate-500">Notes</p><p className="mt-1 text-slate-300">{selectedTrade.notes || "No notes captured."}</p></div></div> : <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">Click any trade row to inspect the full journal detail here.</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function JournalStat({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" | "warning" | "gold" | "blue" | "neutral" }) {
  const toneCls = tone === "positive" ? "text-emerald-400 border-emerald-400/25 bg-emerald-500/10" : tone === "negative" ? "text-rose-400 border-rose-400/25 bg-rose-500/10" : tone === "warning" || tone === "gold" ? "text-[#F6C945] border-[#F6C945]/25 bg-[#F6C945]/10" : tone === "blue" ? "text-blue-400 border-blue-400/25 bg-blue-500/10" : "text-white border-slate-700 bg-slate-900/70";
  return <div className={`rounded-xl border p-3 shadow-lg shadow-black/10 sm:p-4 ${toneCls}`}><p className="text-xs font-bold text-slate-300 sm:text-sm">{label}</p><div className="mt-2 break-words text-2xl font-black sm:text-3xl">{value}</div>{hint && <p className="mt-1 text-xs text-slate-400 sm:text-sm">{hint}</p>}</div>;
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
                barCategoryGap={20}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" />
                {/* Show ALL market names; angle a bit so they fit */}
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={56}
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
                <Bar dataKey="pnl" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
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
   Pro Calendar (heatmap + monthly/weekly summaries + click day drill-down)
============================================================================ */
function OldCalendar({
  trades,
  withdrawals,
}: {
  trades: { ts?: number; pnl?: number; symbol?: string; notes?: string }[];
  withdrawals: { ts?: number; amount?: number }[];
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
  function startOfCalendar(d: Date) { const x = startOfMonth(d); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; }
  function keyOf(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function keyFromTs(ts: number) { const d = new Date(ts); return keyOf(d); }

  const startBalanceRaw = typeof window !== "undefined" ? Number(localStorage.getItem("ust-start-balance") || 0) : 0;
  const startBalance = startBalanceRaw > 0 ? startBalanceRaw : 1000;
  const days = useMemo(() => {
    const start = startOfCalendar(viewDate);
    const arr: Date[] = [];
    for (let i=0; i<42; i++) { const x = new Date(start); x.setDate(start.getDate()+i); arr.push(x); }
    return arr;
  }, [viewDate]);
  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i=0; i<days.length; i+=7) out.push(days.slice(i, i+7));
    return out;
  }, [days]);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = keyOf(new Date());
  const viewMonth = viewDate.getMonth();

  const calendarStats = useMemo(() => {
    const byDay = new Map<string, { pnl: number; trades: number; wins: number; losses: number; withdrawals: number; symbols: Set<string>; items: { ts?: number; pnl?: number; symbol?: string; notes?: string }[] }>();
    const ensure = (key: string) => {
      if (!byDay.has(key)) byDay.set(key, { pnl: 0, trades: 0, wins: 0, losses: 0, withdrawals: 0, symbols: new Set(), items: [] });
      return byDay.get(key)!;
    };

    trades.forEach((t) => {
      if (!t.ts) return;
      const d = ensure(keyFromTs(t.ts));
      const pnl = Number(t.pnl || 0);
      d.pnl += pnl;
      d.trades += 1;
      if (pnl > 0) d.wins += 1;
      if (pnl < 0) d.losses += 1;
      if (t.symbol) d.symbols.add(t.symbol);
      d.items.push(t);
    });

    withdrawals.forEach((w) => {
      if (!w.ts) return;
      ensure(keyFromTs(w.ts)).withdrawals += Number(w.amount || 0);
    });

    const monthKeys = Array.from(byDay.keys()).filter((key) => {
      const d = new Date(`${key}T00:00:00`);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });

    const monthlyPnl = monthKeys.reduce((sum, key) => sum + (byDay.get(key)?.pnl || 0), 0);
    const monthlyTrades = monthKeys.reduce((sum, key) => sum + (byDay.get(key)?.trades || 0), 0);
    const monthlyWins = monthKeys.reduce((sum, key) => sum + (byDay.get(key)?.wins || 0), 0);
    const monthlyWithdrawals = monthKeys.reduce((sum, key) => sum + (byDay.get(key)?.withdrawals || 0), 0);
    const activeDays = monthKeys.filter((key) => (byDay.get(key)?.trades || 0) > 0).length;
    const bestDay = monthKeys.reduce((best, key) => Math.max(best, byDay.get(key)?.pnl || 0), 0);
    const worstDay = monthKeys.reduce((worst, key) => Math.min(worst, byDay.get(key)?.pnl || 0), 0);

    return {
      byDay,
      monthlyPnl,
      monthlyTrades,
      monthlyWins,
      monthlyWithdrawals,
      activeDays,
      bestDay,
      worstDay,
      monthlyWinRate: monthlyTrades ? (monthlyWins / monthlyTrades) * 100 : 0,
    };
  }, [trades, withdrawals, viewDate]);

  const selectedDay = selectedKey ? calendarStats.byDay.get(selectedKey) : null;

  function pnlTone(pnl: number) {
    if (pnl > 0) return "text-emerald-300";
    if (pnl < 0) return "text-rose-300";
    return "text-slate-100";
  }

  function heatClass(pnl: number, hasActivity: boolean) {
    if (!hasActivity) return "bg-[#101827] hover:bg-[#142033]";
    if (pnl > 0) return pnl >= startBalance * 0.25 ? "bg-emerald-500/20 border-emerald-400/45 shadow-[0_0_22px_rgba(16,185,129,0.18)]" : "bg-emerald-500/10 border-emerald-400/30";
    if (pnl < 0) return Math.abs(pnl) >= startBalance * 0.1 ? "bg-rose-500/20 border-rose-400/45 shadow-[0_0_22px_rgba(244,63,94,0.16)]" : "bg-rose-500/10 border-rose-400/30";
    return "bg-slate-700/20 border-slate-500/30";
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700/70 bg-[#07111f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#F6C945]">Trading Calendar</p>
              <h2 className="text-2xl font-extrabold text-slate-100">{monthLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800" onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(startOfMonth(d)); }}>← Prev</Button>
            <Button variant="outline" className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800" onClick={() => setViewDate(startOfMonth(new Date()))}>Today</Button>
            <Button variant="outline" className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800" onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(startOfMonth(d)); }}>Next →</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <CalendarMetric label="Month PnL" value={`${calendarStats.monthlyPnl >= 0 ? "+" : ""}${currency(Number(calendarStats.monthlyPnl.toFixed(2)))}`} tone={calendarStats.monthlyPnl > 0 ? "good" : calendarStats.monthlyPnl < 0 ? "bad" : "neutral"} />
          <CalendarMetric label="Win Rate" value={`${calendarStats.monthlyWinRate.toFixed(0)}%`} tone="blue" />
          <CalendarMetric label="Trades" value={String(calendarStats.monthlyTrades)} tone="neutral" />
          <CalendarMetric label="Active Days" value={String(calendarStats.activeDays)} tone="neutral" />
          <CalendarMetric label="Best Day" value={`${calendarStats.bestDay >= 0 ? "+" : ""}${currency(Number(calendarStats.bestDay.toFixed(2)))}`} tone="good" />
          <CalendarMetric label="Withdrawn" value={`-${currency(Number(calendarStats.monthlyWithdrawals.toFixed(2)))}`} tone="bad" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-700/70 bg-[#07111f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="grid grid-cols-7 text-xs font-bold uppercase tracking-wider text-slate-300">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="p-2 text-center">{d}</div>)}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-2">
            {days.map((d, i) => {
              const k = keyOf(d);
              const inMonth = d.getMonth() === viewMonth;
              const isToday = k === todayKey;
              const day = calendarStats.byDay.get(k);
              const dayPnl = day?.pnl || 0;
              const hasActivity = !!day && (day.trades > 0 || day.withdrawals > 0);
              const winRate = day?.trades ? (day.wins / day.trades) * 100 : 0;
              const pct = startBalance > 0 ? (dayPnl / startBalance) * 100 : 0;

              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedKey(k)}
                  className={[
                    "min-h-[118px] rounded-xl border border-slate-800 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#F6C945]/55",
                    heatClass(dayPnl, hasActivity),
                    inMonth ? "opacity-100" : "opacity-35",
                    isToday ? "ring-2 ring-[#F6C945]/80 shadow-[0_0_26px_rgba(246,201,69,0.20)]" : "",
                    selectedKey === k ? "border-[#F6C945]/80 ring-1 ring-[#F6C945]/45" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold text-slate-100">{d.getDate()}</span>
                    {hasActivity && (
                      <span className={[
                        "h-2.5 w-2.5 rounded-full",
                        dayPnl > 0 ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" : dayPnl < 0 ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.7)]" : "bg-slate-400"
                      ].join(" ")} />
                    )}
                  </div>

                  {hasActivity ? (
                    <div className="mt-5 space-y-1.5">
                      <div className={`text-lg font-extrabold ${pnlTone(dayPnl)}`}>{dayPnl >= 0 ? "+" : ""}{currency(Number(dayPnl.toFixed(2)))}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>{day?.trades || 0} trades</span>
                        <span>{winRate.toFixed(0)}% WR</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className={dayPnl >= 0 ? "h-full bg-emerald-400" : "h-full bg-rose-400"} style={{ width: `${Math.min(100, Math.max(8, Math.abs(pct)))}%` }} />
                      </div>
                      <div className="text-right text-[11px] text-slate-400">{dayPnl >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>
                    </div>
                  ) : (
                    <div className="mt-8 text-xs text-slate-500">No trades</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-700/70 bg-[#07111f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-2 text-slate-100">
              <Activity className="h-5 w-5 text-[#F6C945]" />
              <h3 className="font-extrabold">Day Drill-down</h3>
            </div>

            {selectedKey && selectedDay ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">{new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                  <p className={`mt-1 text-3xl font-black ${pnlTone(selectedDay.pnl)}`}>{selectedDay.pnl >= 0 ? "+" : ""}{currency(Number(selectedDay.pnl.toFixed(2)))}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><span className="text-slate-400">Trades</span><strong className="block text-slate-100">{selectedDay.trades}</strong></div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><span className="text-slate-400">Win Rate</span><strong className="block text-slate-100">{selectedDay.trades ? ((selectedDay.wins / selectedDay.trades) * 100).toFixed(0) : 0}%</strong></div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><span className="text-slate-400">Best Trade</span><strong className="block text-emerald-300">{currency(Number(Math.max(0, ...selectedDay.items.map(t => Number(t.pnl || 0))).toFixed(2)))}</strong></div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><span className="text-slate-400">Worst Trade</span><strong className="block text-rose-300">{currency(Number(Math.min(0, ...selectedDay.items.map(t => Number(t.pnl || 0))).toFixed(2)))}</strong></div>
                </div>

                {selectedDay.withdrawals > 0 && (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">Withdrawal: -{currency(Number(selectedDay.withdrawals.toFixed(2)))}</div>
                )}

                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {selectedDay.items.slice(0, 12).map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm">
                      <div>
                        <div className="font-semibold text-slate-100">{t.symbol || "Unknown"}</div>
                        <div className="text-xs text-slate-500">{t.ts ? new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      </div>
                      <div className={`font-extrabold ${pnlTone(Number(t.pnl || 0))}`}>{Number(t.pnl || 0) >= 0 ? "+" : ""}{currency(Number(Number(t.pnl || 0).toFixed(2)))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400">
                Click any calendar day to review its trades, win rate, best trade and worst trade.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-[#07111f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-2 text-slate-100">
              <BarChart3 className="h-5 w-5 text-[#F6C945]" />
              <h3 className="font-extrabold">Weekly Summary</h3>
            </div>
            <div className="mt-4 space-y-2">
              {weeks.map((week, idx) => {
                const keys = week.map(keyOf);
                const pnl = keys.reduce((sum, key) => sum + (calendarStats.byDay.get(key)?.pnl || 0), 0);
                const tradesCount = keys.reduce((sum, key) => sum + (calendarStats.byDay.get(key)?.trades || 0), 0);
                const wins = keys.reduce((sum, key) => sum + (calendarStats.byDay.get(key)?.wins || 0), 0);
                const wr = tradesCount ? (wins / tradesCount) * 100 : 0;
                return (
                  <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-300">Week {idx + 1}</span>
                      <span className={`font-extrabold ${pnlTone(pnl)}`}>{pnl >= 0 ? "+" : ""}{currency(Number(pnl.toFixed(2)))}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{tradesCount} trades</span>
                      <span>{wr.toFixed(0)}% WR</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarMetric({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "blue" | "neutral" }) {
  const toneClass =
    tone === "good" ? "text-emerald-300 border-emerald-400/25 bg-emerald-500/10" :
    tone === "bad" ? "text-rose-300 border-rose-400/25 bg-rose-500/10" :
    tone === "blue" ? "text-blue-300 border-blue-400/25 bg-blue-500/10" :
    "text-slate-100 border-slate-700 bg-slate-950/35";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

/* =========================================================================
   Auto-Import panel (FIXED to receive the bulk adder via props)
============================================================================ */
function AutoImportPanel({ addTradesBulkFn }: { addTradesBulkFn: (rows: TradeRow[]) => void }) {
  const { enabled, setEnabled, account, setAccount, since, setSince, lastSync, runImport } =
    useSheetsImporter(addTradesBulkFn);

  // Manual backfill/import range. This allows old trades to be pulled even after auto-sync has moved forward.
  const [manualFrom, setManualFrom] = React.useState<string>(since || "");
  const [manualTo, setManualTo] = React.useState<string>("");
  const [manualImporting, setManualImporting] = React.useState(false);

  async function runManualImport() {
    if (!SHEETS_URL || !SHEETS_TOKEN || !account) return;

    setManualImporting(true);

    try {
      const url = buildSheetsUrl(account, manualFrom);
      if (!url) return;

      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();
      if (!data?.ok) return;

      let rows = normalizeToTradeRows(data.items || []);

      // Optional end-date filter for manual backfills.
      if (manualTo) {
        const untilEnd = new Date(`${manualTo}T23:59:59`).getTime();
        rows = rows.filter((t) => (t.ts || 0) <= untilEnd);
      }

      // Dedupe against the actual journal, not the last sync time.
      // This lets you import older dates without creating duplicates.
      const existingRaw = localStorage.getItem("ust-trades");
      const existing: TradeRow[] = existingRaw ? JSON.parse(existingRaw) : [];
      const existingKeys = new Set(
        existing.map((t) => t.extId || `${t.ts}-${t.symbol}-${t.pnl}`)
      );

      const freshRows = rows.filter(
        (t) => !existingKeys.has(t.extId || `${t.ts}-${t.symbol}-${t.pnl}`)
      );

      if (freshRows.length) {
        addTradesBulkFn(freshRows);
      }

      localStorage.setItem("ust:lastSync", JSON.stringify(Date.now()));
    } catch (e) {
      console.warn("Manual import failed:", e);
    } finally {
      setManualImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs mb-1">Enabled</label>
          <select
            value={String(enabled)}
            onChange={(e) => setEnabled(e.target.value === "true")}
            className="w-full border rounded px-2 py-1"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs mb-1">Account #</label>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="12345789"
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs mb-1">Auto Since</label>
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div className="md:col-span-2">
          <button onClick={runImport} className="w-full border rounded px-3 py-1">
            Import Now
          </button>
        </div>

        <div className="md:col-span-2 text-xs text-slate-500">
          Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
        </div>
      </div>

      <div className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3">
        <div className="text-sm font-semibold mb-2">Manual Import / Backfill by Date</div>
        <div className="grid md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs mb-1">Import From</label>
            <input
              type="date"
              value={manualFrom}
              onChange={(e) => setManualFrom(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs mb-1">Import To</label>
            <input
              type="date"
              value={manualTo}
              onChange={(e) => setManualTo(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-2">
            <button
              onClick={runManualImport}
              disabled={manualImporting || !manualFrom}
              className="w-full border rounded px-3 py-1 bg-[#D4AF37] text-black disabled:opacity-60"
            >
              {manualImporting ? "Importing..." : "Import Dates"}
            </button>
          </div>

          <div className="md:col-span-2 text-xs text-slate-500">
            Use this for missed/older trades.
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageClientWrapper;
