/* PageClient.tsx — Ultimate Scalper Tool (3× Risk & Sizing + Combobox Logger) */
"use client";

import { useEffect, useMemo, useState, useContext, useCallback } from "react";
import * as React from "react";
import AuthGate from "@/components/AuthGate";
import { useSupabaseUser } from "@/lib/useSupabaseUser";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";
import {
  SHEETS_WEBAPP_URL as SHEETS_URL,
  READ_TOKEN as SHEETS_TOKEN,
  DEFAULT_UST_ACCOUNT as DEFAULT_ACCOUNT,
} from "@/lib/env";

/* ========== shadcn/ui ========== */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import {
  ChevronsUpDown,
  Check,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CalendarDays,
  Target,
  ShieldCheck,
  Activity,
  Info,
  PieChart,
  Star,
  Scale,
  Home,
  Settings,
  BookOpen,
  ClipboardCheck,
  RefreshCw,
  Calculator,
  FileText,
  MoreHorizontal,
} from "lucide-react";

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
  kind?: "trade" | "withdrawal" | "deposit";
  amount?: number; // positive cash movement (withdrawal or deposit)

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
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

type BattleMarketRow = {
  id: string;
  market: string;
  account: string;
  startingCapital: number;
  trades: number;
  targetTrades: number;
  profit: number;
  winRate: number;
  maxDd: number;
  profitFactor: number;
  bestRunnerR: number;
  avgR: number;
  discipline: number;
  manualInterruptions: number;
  status:
    | "Stable"
    | "Under Pressure"
    | "Recovery Mode"
    | "Failed Challenge"
    | "Certified";
  notes: string;
  periodStart?: string;
  periodEnd?: string;
};

const DEFAULT_BATTLE_ROWS: BattleMarketRow[] = [
  {
    id: "kuda-gold",
    market: "Gold",
    account: "Kuda_Gold",
    startingCapital: 0,
    trades: 0,
    targetTrades: 100,
    profit: 0,
    winRate: 0,
    maxDd: 0,
    profitFactor: 0,
    bestRunnerR: 0,
    avgR: 0,
    discipline: 100,
    manualInterruptions: 0,
    status: "Stable",
    notes: "Fresh 100 live-trade race. Waiting for the market to prove itself.",
  },
  {
    id: "kuda-silver",
    market: "Silver",
    account: "Kuda_Silver",
    startingCapital: 0,
    trades: 0,
    targetTrades: 100,
    profit: 0,
    winRate: 0,
    maxDd: 0,
    profitFactor: 0,
    bestRunnerR: 0,
    avgR: 0,
    discipline: 100,
    manualInterruptions: 0,
    status: "Stable",
    notes: "Separated from Gold so Silver can run its own race.",
  },
  {
    id: "kuda-nasdaq",
    market: "Nasdaq",
    account: "Kuda_Nasdaq",
    startingCapital: 0,
    trades: 0,
    targetTrades: 100,
    profit: 0,
    winRate: 0,
    maxDd: 0,
    profitFactor: 0,
    bestRunnerR: 0,
    avgR: 0,
    discipline: 100,
    manualInterruptions: 0,
    status: "Stable",
    notes:
      "Momentum market under observation for smooth continuation behaviour.",
  },
  {
    id: "kuda-us30",
    market: "US30",
    account: "Kuda_US30",
    startingCapital: 0,
    trades: 0,
    targetTrades: 100,
    profit: 0,
    winRate: 0,
    maxDd: 0,
    profitFactor: 0,
    bestRunnerR: 0,
    avgR: 0,
    discipline: 100,
    manualInterruptions: 0,
    status: "Stable",
    notes:
      "High-volatility test. Runner potential must prove it can survive drawdown.",
  },
  {
    id: "kuda-v90",
    market: "V90",
    account: "Kuda_V90",
    startingCapital: 0,
    trades: 0,
    targetTrades: 100,
    profit: 0,
    winRate: 0,
    maxDd: 0,
    profitFactor: 0,
    bestRunnerR: 0,
    avgR: 0,
    discipline: 100,
    manualInterruptions: 0,
    status: "Stable",
    notes: "Volatility market added as the 5th Battle Board contender.",
  },
];

const BATTLE_STATUS_STYLES: Record<BattleMarketRow["status"], string> = {
  Stable: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  "Under Pressure": "border-amber-400/40 bg-amber-500/10 text-amber-300",
  "Recovery Mode": "border-sky-400/40 bg-sky-500/10 text-sky-300",
  "Failed Challenge": "border-rose-400/40 bg-rose-500/10 text-rose-300",
  Certified: "border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F6C945]",
};

type SheetItem = {
  timestamp?: string;
  time?: string;
  account?: string;
  symbol?: string;
  action?: string; // ORDER_OPEN / ORDER_CLOSE / BALANCE / DEAL_*
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
  setup_grade?: string;
  grade?: string;
  session?: string;
  type?: string;
  entry?: string;
  reason?: string;
  [key: string]: any;
};

type PlanningCost = { id: string; name: string; amount: number };

function parseAmountFromText(text: string) {
  const cleaned = String(text || '').replace(/,/g, ' ');
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g) || [];
  const nums = matches.map(Number).filter((n) => Number.isFinite(n) && Math.abs(n) > 0);
  if (!nums.length) return 0;
  // Balance-operation comments often contain tickets and timestamps. The cash amount is normally
  // the meaningful decimal/large value, so use the largest absolute number as a safe fallback.
  return Math.abs(nums.sort((a, b) => Math.abs(b) - Math.abs(a))[0]);
}

function detectCashMovement(it: SheetItem): { kind: 'withdrawal' | 'deposit'; amount: number } | null {
  const text = [
    it.action,
    it.type,
    it.entry,
    it.side,
    it.symbol,
    it.comment,
    it.reason,
    it.setup_grade,
    it.grade,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasWithdrawal = /\b(withdraw|withdrawal|w\/d|cash\s*out|balance\s*out)\b/.test(text);
  const hasDeposit = /\b(deposit|cash\s*in|balance\s*in|funding|top\s*up|credit)\b/.test(text);
  if (!hasWithdrawal && !hasDeposit) return null;

  const signedProfit = Number(it.profit || 0);
  const amount = Math.abs(signedProfit) || parseAmountFromText(String(it.comment || '')) || parseAmountFromText(text);
  if (!amount) return null;

  if (hasWithdrawal && !hasDeposit) return { kind: 'withdrawal', amount: Number(amount.toFixed(2)) };
  if (hasDeposit && !hasWithdrawal) return { kind: 'deposit', amount: Number(amount.toFixed(2)) };

  // If both words appear, let the signed value decide. Negative = withdrawal, positive = deposit.
  return {
    kind: signedProfit < 0 ? 'withdrawal' : 'deposit',
    amount: Number(amount.toFixed(2)),
  };
}

function businessDaysInMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  let days = 0;
  for (let d = new Date(y, m, 1); d.getMonth() === m; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) days++;
  }
  return days;
}

function businessDaysRemainingInMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  let days = 0;
  for (let d = new Date(y, m, date.getDate()); d.getMonth() === m; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) days++;
  }
  return days;
}

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
    const ts = it.timestamp ? new Date(it.timestamp).getTime() : Date.now();
    const cash = detectCashMovement(it);

    if (cash) {
      const extId = [
        'cash',
        cash.kind,
        it.deal_ticket || it.order_ticket || '',
        it.timestamp || '',
        cash.amount.toFixed(2),
        it.comment || '',
      ].join('|');

      rows.push({
        id: `${ts}-${extId || Math.random().toString(36).slice(2, 6)}`,
        ts,
        kind: cash.kind,
        symbol: cash.kind === 'withdrawal' ? 'Withdrawals' : 'Deposits',
        amount: cash.amount,
        pnl: 0,
        notes: `AUTO • ${cash.kind === 'withdrawal' ? 'Withdrawal' : 'Deposit'} • ${it.comment || it.action || ''}`.trim(),
        source: 'auto',
        extId,
      });
      continue;
    }

    // import only closed trades into Journal; open market orders stay out unless they are balance movements above
    if ((it.action || '').toUpperCase() !== 'ORDER_CLOSE') continue;

    const profit = Number(it.profit || 0);
    const commission = Number(it.commission || 0);
    const swap = Number(it.swap || 0);
    const pnl = Number((profit - commission - swap).toFixed(2));
    const extId = [
      it.deal_ticket || it.order_ticket || '',
      it.symbol || 'Unknown',
      it.timestamp || '',
      Number(it.profit || 0).toFixed(2),
      Number(it.commission || 0).toFixed(2),
      Number(it.swap || 0).toFixed(2),
    ].join('|');

    rows.push({
      id: `${ts}-${extId || Math.random().toString(36).slice(2, 6)}`,
      ts,
      kind: 'trade',
      symbol: it.symbol || 'Unknown',
      pnl,
      notes: `AUTO • ${it.side || ''} • vol ${it.volume ?? ''} @ ${it.price ?? ''}`,
      source: 'auto',
      extId,
    });
  }
  // newest first
  rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  return rows;
}

function tradeUniqueKey(t: Partial<TradeRow>) {
  const ext = String(t.extId || "").trim();
  if (ext) return `ext:${ext}`;

  const ts = Number(t.ts || 0);
  const roundedTs = ts ? Math.floor(ts / 1000) : 0;
  const symbol = String(t.symbol || "Unknown")
    .trim()
    .toUpperCase();
  const pnl = Number(t.pnl || 0).toFixed(2);
  const notes = String(t.notes || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return `fallback:${roundedTs}|${symbol}|${pnl}|${notes}`;
}

function filterSheetItemsByPeriod(
  items: SheetItem[],
  start?: string,
  end?: string,
): SheetItem[] {
  if (!start && !end) return items;
  const startMs = start
    ? new Date(`${start}T00:00:00`).getTime()
    : Number.NEGATIVE_INFINITY;
  const endMs = end
    ? new Date(`${end}T23:59:59.999`).getTime()
    : Number.POSITIVE_INFINITY;
  return items.filter((it) => {
    const ts = it.timestamp ? new Date(it.timestamp).getTime() : NaN;
    return Number.isFinite(ts) && ts >= startMs && ts <= endMs;
  });
}

function getSastHour(timestamp?: string): number | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  return Number.isFinite(hour) ? hour : null;
}

function getSessionFromTimestamp(timestamp?: string): string {
  const hour = getSastHour(timestamp);
  if (hour === null) return "Unknown";
  if (hour >= 0 && hour < 8) return "Asia";
  if (hour >= 8 && hour < 15) return "London";
  if (hour >= 15 && hour < 22) return "New York";
  return "Late NY";
}

function extractSetupGrade(item: SheetItem): string {
  const direct = String(item.setup_grade || item.grade || "")
    .trim()
    .toUpperCase();
  if (["A+", "A", "B", "C", "D"].includes(direct)) return direct;
  const comment = String(item.comment || "").toUpperCase();
  const match = comment.match(
    /(?:GRADE|SETUP|UST)[_\s:-]*(A\+|A|B|C|D)\b|\b(A\+|A|B|C|D)[_\s-]*(?:SETUP|GRADE)\b/,
  );
  return match ? match[1] || match[2] || "Unknown" : "Unknown";
}

type BattleExplorerTrade = {
  id: string;
  timestamp: string;
  session: string;
  setupGrade: string;
  side: string;
  symbol: string;
  pnl: number;
  r: number;
  result: "Win" | "Loss" | "BE";
  comment: string;
};

type BattleStatGroup = {
  label: string;
  trades: number;
  profit: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
};

function groupBattleTrades(
  trades: BattleExplorerTrade[],
  key: "setupGrade" | "session",
): BattleStatGroup[] {
  const map = new Map<string, BattleExplorerTrade[]>();
  for (const t of trades) {
    const label = String(t[key] || "Unknown");
    map.set(label, [...(map.get(label) || []), t]);
  }
  return Array.from(map.entries())
    .map(([label, rows]) => {
      const wins = rows.filter((r) => r.pnl > 0).length;
      const grossProfit = rows
        .filter((r) => r.pnl > 0)
        .reduce((sum, r) => sum + r.pnl, 0);
      const grossLoss = Math.abs(
        rows.filter((r) => r.pnl < 0).reduce((sum, r) => sum + r.pnl, 0),
      );
      return {
        label,
        trades: rows.length,
        profit: Number(rows.reduce((sum, r) => sum + r.pnl, 0).toFixed(2)),
        winRate: rows.length
          ? Number(((wins / rows.length) * 100).toFixed(1))
          : 0,
        profitFactor:
          grossLoss > 0
            ? Number((grossProfit / grossLoss).toFixed(2))
            : grossProfit > 0
              ? 99
              : 0,
        avgR: rows.length
          ? Number(
              (rows.reduce((sum, r) => sum + r.r, 0) / rows.length).toFixed(2),
            )
          : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

type BattleCoachSummary = {
  title: string;
  tone: string;
  summary: string;
  action: string;
  chips: string[];
};

function buildBattleAiCoachSummary(
  rows: BattleMarketRow[],
  selectedMarket: BattleMarketRow | undefined,
  trades: BattleExplorerTrade[],
  gradeStats: BattleStatGroup[],
  sessionStats: BattleStatGroup[],
): BattleCoachSummary {
  const ranked = [...rows].sort(
    (a, b) => Number(b.profit || 0) - Number(a.profit || 0),
  );
  const bestMarket = ranked[0];
  const worstMarket = [...rows].sort(
    (a, b) => Number(a.profit || 0) - Number(b.profit || 0),
  )[0];
  const profitableMarkets = rows.filter(
    (r) => Number(r.profit || 0) > 0,
  ).length;
  const totalProfit = Number(
    rows.reduce((sum, r) => sum + Number(r.profit || 0), 0).toFixed(2),
  );
  const totalTrades = rows.reduce((sum, r) => sum + Number(r.trades || 0), 0);
  const avgWinRate = rows.length
    ? Number(
        (
          rows.reduce((sum, r) => sum + Number(r.winRate || 0), 0) / rows.length
        ).toFixed(1),
      )
    : 0;
  const bestGrade = gradeStats
    .filter((g) => g.trades > 0)
    .sort((a, b) => b.profit - a.profit)[0];
  const weakGrade = gradeStats
    .filter((g) => g.trades > 0)
    .sort((a, b) => a.profit - b.profit)[0];
  const bestSession = sessionStats
    .filter((g) => g.trades > 0)
    .sort((a, b) => b.profit - a.profit)[0];
  const weakSession = sessionStats
    .filter((g) => g.trades > 0)
    .sort((a, b) => a.profit - b.profit)[0];
  const recent = trades.slice(0, 5);
  const recentLosses = recent.filter((t) => t.pnl < 0).length;
  const selectedName = selectedMarket?.market || "selected market";

  let title = "Collecting Evidence";
  let tone = "border-sky-400/25 bg-sky-500/10 text-sky-100";
  let summary =
    "UST Coach is waiting for more closed trades before giving a strong decision.";
  let action =
    "Keep importing trades. Do not judge a market before there is enough sample size.";

  if (totalTrades >= 10) {
    if (totalProfit > 0 && profitableMarkets >= Math.ceil(rows.length / 2)) {
      title = "Controlled Growth";
      tone = "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
      summary = `The board is positive overall. ${bestMarket?.market || "The leader"} is currently leading, while ${worstMarket?.market || "the weakest market"} needs tighter review.`;
      action = bestSession
        ? `Prioritise the strongest session: ${bestSession.label}. Scale only after the same behaviour repeats.`
        : "Continue with normal risk and protect the current profitable curve.";
    } else if (totalProfit < 0 || profitableMarkets === 0) {
      title = "Defensive Mode";
      tone = "border-rose-400/25 bg-rose-500/10 text-rose-100";
      summary = `The board is under pressure. ${worstMarket?.market || selectedName} is dragging performance and needs protection before more exposure.`;
      action = weakSession
        ? `Reduce or pause trades during ${weakSession.label} until it becomes profitable again.`
        : "Reduce risk, pause weak markets, and wait for cleaner A/B setups.";
    } else {
      title = "Mixed Conditions";
      tone = "border-amber-400/25 bg-amber-500/10 text-amber-100";
      summary = `The system is mixed. Some markets are paying, but consistency is not yet strong enough for aggressive scaling.`;
      action = bestMarket
        ? `Focus on ${bestMarket.market} and keep weaker markets in observation mode.`
        : "Trade smaller until the strongest market becomes clear.";
    }
  }

  if (recent.length >= 3 && recentLosses >= 3) {
    title = "Short-Term Caution";
    tone = "border-amber-400/25 bg-amber-500/10 text-amber-100";
    summary = `${selectedName} has recent loss pressure. The next trade should be treated as a protection trade, not a recovery trade.`;
    action =
      "Avoid revenge entries. Wait for checklist confirmation and keep risk fixed.";
  }

  const chips = [
    `${totalTrades} total trades`,
    `${profitableMarkets}/${rows.length} markets positive`,
    `${avgWinRate}% avg win rate`,
    bestGrade ? `Best grade: ${bestGrade.label}` : "Best grade: pending",
    bestSession
      ? `Best session: ${bestSession.label}`
      : "Best session: pending",
    weakGrade && weakGrade.profit < 0
      ? `Review grade: ${weakGrade.label}`
      : "Grade risk: controlled",
  ];

  return { title, tone, summary, action, chips };
}

function buildBattleExplorerTrades(
  items: SheetItem[],
  base: BattleMarketRow,
  periodStart?: string,
  periodEnd?: string,
): BattleExplorerTrade[] {
  const scopedItems = filterSheetItemsByPeriod(items, periodStart, periodEnd);
  const riskUnit =
    Number(base.startingCapital || 0) > 0
      ? Number(base.startingCapital || 0) * 0.01
      : 0;
  return scopedItems
    .filter((it) => (it.action || "").toUpperCase() === "ORDER_CLOSE")
    .map((it) => {
      const profit = Number(it.profit || 0);
      const commission = Number(it.commission || 0);
      const swap = Number(it.swap || 0);
      const pnl = Number((profit - commission - swap).toFixed(2));
      const r = riskUnit > 0 ? Number((pnl / riskUnit).toFixed(2)) : 0;
      return {
        id: String(
          it.deal_ticket ||
            it.order_ticket ||
            `${it.timestamp}-${it.symbol}-${pnl}`,
        ),
        timestamp: String(it.timestamp || it.time || ""),
        session: String(
          it.session || getSessionFromTimestamp(it.timestamp || it.time),
        ),
        setupGrade: extractSetupGrade(it),
        side: String(it.side || ""),
        symbol: String(it.symbol || ""),
        pnl,
        r,
        result: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "BE",
        comment: String(it.comment || ""),
      } as BattleExplorerTrade;
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

function computeBattleStatsFromSheet(
  items: SheetItem[],
  base: BattleMarketRow,
  periodStart?: string,
  periodEnd?: string,
): BattleMarketRow {
  const scopedItems = filterSheetItemsByPeriod(items, periodStart, periodEnd);
  const closed = normalizeToTradeRows(scopedItems).sort(
    (a, b) => (a.ts ?? 0) - (b.ts ?? 0),
  );
  const trades = closed.length;
  const profit = Number(
    closed.reduce((sum, t) => sum + Number(t.pnl || 0), 0).toFixed(2),
  );
  const wins = closed.filter((t) => Number(t.pnl || 0) > 0).length;
  const losses = closed.filter((t) => Number(t.pnl || 0) < 0).length;
  const grossProfit = closed
    .filter((t) => Number(t.pnl || 0) > 0)
    .reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const grossLoss = Math.abs(
    closed
      .filter((t) => Number(t.pnl || 0) < 0)
      .reduce((sum, t) => sum + Number(t.pnl || 0), 0),
  );
  const winRate = trades ? Number(((wins / trades) * 100).toFixed(1)) : 0;
  const profitFactor =
    grossLoss > 0
      ? Number((grossProfit / grossLoss).toFixed(2))
      : grossProfit > 0
        ? 99
        : 0;

  const startingCapital = Number(base.startingCapital || 0);
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDd = 0;
  for (const t of closed) {
    equity += Number(t.pnl || 0);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - equity) / peak) * 100);
  }

  const riskUnit = startingCapital > 0 ? startingCapital * 0.01 : 0;
  const avgR =
    riskUnit > 0 && trades
      ? Number((profit / trades / riskUnit).toFixed(2))
      : 0;
  const bestRunnerR =
    riskUnit > 0 && closed.length
      ? Number(
          (
            Math.max(...closed.map((t) => Number(t.pnl || 0))) / riskUnit
          ).toFixed(2),
        )
      : 0;
  // Manual-vs-auto detection is not reliable from the Google Sheet feed, so it is no longer used
  // for Battle Board scoring. We keep this field at 0 only for backwards compatibility with
  // existing saved rows / database columns.
  const manualInterruptions = 0;

  // Battle health is now based on drawdown only, not assumed manual intervention.
  // This prevents profitable markets from being failed because of ORDER_CLOSE records.
  const discipline = Math.max(0, Math.min(100, Math.round(100 - maxDd)));

  const targetTrades = Number(base.targetTrades || 100);
  const accountBlown = startingCapital > 0 && equity <= 0;
  const completedChallenge = trades >= targetTrades;

  let status: BattleMarketRow["status"] = "Stable";

  // UST Market Challenge logic:
  // Failed only when the market has truly broken the survival rules.
  // Manual-vs-auto detection has been removed from the logic because the sheet feed
  // cannot reliably identify whether a close was manual or automated.
  if (maxDd > 60 || accountBlown || (completedChallenge && profit < 0)) {
    status = "Failed Challenge";
  } else if (completedChallenge && profit > 0 && maxDd <= 60) {
    status = "Certified";
  } else if (maxDd >= 40 || profit < 0) {
    status = "Recovery Mode";
  } else if (maxDd >= 25 || (trades >= 10 && winRate < 45)) {
    status = "Under Pressure";
  }

  return {
    ...base,
    trades,
    profit,
    winRate,
    maxDd: Number(maxDd.toFixed(1)),
    profitFactor,
    bestRunnerR,
    avgR,
    discipline,
    manualInterruptions,
    status,
    periodStart,
    periodEnd,
  };
}

function dedupeTrades(rows: TradeRow[]) {
  const seen = new Set<string>();
  const unique: TradeRow[] = [];
  let removed = 0;

  for (const row of rows) {
    const key = tradeUniqueKey(row);
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return { unique, removed };
}

function useSheetsImporter(addTradesBulk: (rows: TradeRow[]) => void) {
  const [enabled, setEnabled] = useLS<boolean>("ust:autoEnabled", true);
  const [account, setAccount] = useLS<string>(
    "ust:autoAccount",
    DEFAULT_ACCOUNT || "",
  );
  const [since, setSince] = useLS<string>("ust:autoSince", "");
  const [lastSync, setLastSync] = useLS<number>("ust:lastSync", 0);
  const [seen, setSeen] = useLS<string[]>("ust:seenExtIds", []);
  const [lastImported, setLastImported] = useLS<number>(
    "ust:lastImportedCount",
    0,
  );
  const [lastBlocked, setLastBlocked] = useLS<number>(
    "ust:lastDuplicateBlocked",
    0,
  );
  const [lastError, setLastError] = useLS<string>("ust:lastSyncError", "");

  const runImport = React.useCallback(async () => {
    if (!enabled || !SHEETS_URL || !SHEETS_TOKEN || !account) {
      setLastError("Sync is disabled or missing configuration.");
      return { imported: 0, blocked: 0, ok: false };
    }

    try {
      const url = buildSheetsUrl(account, since);
      if (!url) {
        setLastError("Could not build import URL.");
        return { imported: 0, blocked: 0, ok: false };
      }

      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();

      if (!data?.ok) {
        const msg = data?.error || "Import source returned an error.";
        setLastError(String(msg));
        return { imported: 0, blocked: 0, ok: false };
      }

      const items: SheetItem[] = data.items || [];
      const rows = normalizeToTradeRows(items);

      const existingRaw = localStorage.getItem("ust-trades");
      const existing: TradeRow[] = existingRaw ? JSON.parse(existingRaw) : [];
      const existingKeys = new Set(existing.map(tradeUniqueKey));
      const seenKeys = new Set(seen);

      const freshRows: TradeRow[] = [];
      let blocked = 0;

      for (const row of rows) {
        const key = tradeUniqueKey(row);
        if (existingKeys.has(key) || seenKeys.has(key)) {
          blocked++;
          continue;
        }
        existingKeys.add(key);
        seenKeys.add(key);
        freshRows.push(row);
      }

      const deduped = dedupeTrades(freshRows);
      blocked += deduped.removed;

      if (deduped.unique.length) {
        addTradesBulk(deduped.unique);
      }

      const nextSeen = [...seen, ...rows.map(tradeUniqueKey)];

      setSeen(Array.from(new Set(nextSeen)).slice(-8000));
      setLastImported(deduped.unique.length);
      setLastBlocked(blocked);
      setLastSync(Date.now());
      setLastError("");

      return { imported: deduped.unique.length, blocked, ok: true };
    } catch (e: any) {
      const msg = e?.message || "Auto-import failed.";
      setLastError(String(msg));
      console.warn("Auto-import failed:", e);
      return { imported: 0, blocked: 0, ok: false };
    }
  }, [
    enabled,
    account,
    since,
    seen,
    addTradesBulk,
    setSeen,
    setLastSync,
    setLastImported,
    setLastBlocked,
    setLastError,
  ]);

  // poll every 20s
  React.useEffect(() => {
    runImport(); // first tick
    const t = setInterval(runImport, 20000);
    return () => clearInterval(t);
  }, [runImport]);

  return {
    enabled,
    setEnabled,
    account,
    setAccount,
    since,
    setSince,
    lastSync,
    runImport,
    lastImported,
    lastBlocked,
    lastError,
  };
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
          <div
            key={t.id}
            className="rounded-lg border bg-white shadow px-3 py-2 w-72 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {t.desc}
              </div>
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
  "Deposits",
] as const;
type StrategyName = (typeof STRATEGIES)[number];

type ASetup = { id: string; title: string; dataUrl: string; notes?: string };

type SessionSummary = {
  sessionId: string; // ✅ ADD THIS
  startedAt: string; // ISO
  endedAt: string; // ISO
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
    if (input.riskPct <= input.recommendedRiskPct * 1.1)
      badges.push("Risk Controlled");
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
  if (input.recommendedRiskPct > 0 && input.riskPct <= input.recommendedRiskPct)
    score += 4;
  if (input.profitOnlyMode) score += 3;

  // Preparation fields (legit psychology)
  const filled = [
    input.whyTrade,
    input.mentalReady,
    input.sessionTarget,
    input.setupsToday,
  ].filter((v) => String(v || "").trim().length > 0).length;
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
function calcLotSizeDeriv(
  riskAmount: number,
  market: MarketName,
  riskPips: number,
) {
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
  pipValuePerLotUSD: number,
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
  endedAtISO?: string,
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
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Default UST to dark mode on first visit. Users can still switch theme afterwards.
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (!savedTheme) {
        localStorage.setItem("theme", "dark");
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      }
    } catch {}
  }, []);

  /* Core state */
  const [startBalance, setStartBalance] = useLocalStorage<number>(
    "ust-start-balance",
    0,
  );
  const [riskPct, setRiskPct] = useLocalStorage<number>("ust-risk-pct", 2.5);
  const [trades, setTrades] = useLocalStorage<TradeRow[]>("ust-trades", []);
  const [sessionId, setSessionId] = useLocalStorage<string | null>(
    "ust-session-id",
    null,
  );
  const [lastSessionSummary, setLastSessionSummary] =
    useLocalStorage<SessionSummary | null>("ust-last-session-summary", null);
  // Checklist-only state (no app-side effects)
  const [whyTrade, setWhyTrade] = useLocalStorage<string>(
    "ust-checklist-why",
    "To gain financial freedom, spend more time with family, travel, and help others.",
  );
  const [mentalReady, setMentalReady] = useLocalStorage<string>(
    "ust-checklist-ready",
    "Yes, fresh as ever after a good rest.",
  );
  const [sessionTarget, setSessionTarget] = useLocalStorage<string>(
    "ust-checklist-target",
    "Stop if I give back 15% of gains today.",
  );
  const [setupsToday, setSetupsToday] = useLocalStorage<string>(
    "ust-checklist-setups",
    "Only A+ setups with potential to trend longer.",
  );
  const [thresholdPct, setThresholdPct] = useLocalStorage<number>(
    "ust-checklist-thresholdPct",
    30,
  );
  const [givebackPct, setGivebackPct] = useLocalStorage<number>(
    "ust-checklist-givebackPct",
    50,
  );

  const [plannedTradesPerDay, setPlannedTradesPerDay] = useLocalStorage<number>(
    "ust-checklist-planned-trades-per-day",
    3,
  );
  const [plannedRewardR, setPlannedRewardR] = useLocalStorage<number>(
    "ust-checklist-planned-reward-r",
    2,
  );

  /* Discipline & Goals */
  const [maxLoss, setMaxLoss] = useLocalStorage<number>("ust-max-loss", 0);
  const [lockOnHit, setLockOnHit] = useLocalStorage<boolean>(
    "ust-lock-on-hit",
    true,
  );
  const [locked, setLocked] = useLocalStorage<boolean>("ust-locked", false);

  const [weeklyTarget, setWeeklyTarget] = useLocalStorage<number>(
    "ust-weekly-target",
    0,
  );
  const [monthlyTarget, setMonthlyTarget] = useLocalStorage<number>(
    "ust-monthly-target",
    0,
  );
  const [planningCosts, setPlanningCosts] = useLocalStorage<PlanningCost[]>(
    "ust-planning-costs",
    [
      { id: "rent", name: "Rent / Bond", amount: 0 },
      { id: "family", name: "Family Support", amount: 0 },
      { id: "food", name: "Food & Groceries", amount: 0 },
      { id: "transport", name: "Transport / Fuel", amount: 0 },
    ],
  );
  const monthlyCostTarget = useMemo(
    () => planningCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [planningCosts],
  );
  const tradingDaysThisMonth = useMemo(() => businessDaysInMonth(), []);
  const remainingTradingDaysThisMonth = useMemo(() => businessDaysRemainingInMonth(), []);
  const plannedDailyTarget = useMemo(
    () => monthlyCostTarget / Math.max(1, tradingDaysThisMonth),
    [monthlyCostTarget, tradingDaysThisMonth],
  );
  const dashboardDailyTarget = useMemo(() => {
    const planned = Number(plannedDailyTarget);
    if (Number.isFinite(planned) && planned > 0) return planned;

    const monthly = Number(monthlyTarget);
    if (Number.isFinite(monthly) && monthly > 0) {
      return monthly / Math.max(1, tradingDaysThisMonth);
    }

    return 0;
  }, [plannedDailyTarget, monthlyTarget, tradingDaysThisMonth]);

  useEffect(() => {
    if (monthlyCostTarget > 0) {
      setMonthlyTarget(Number(monthlyCostTarget.toFixed(2)));
      setWeeklyTarget(Number((plannedDailyTarget * 5).toFixed(2)));
    }
  }, [monthlyCostTarget, plannedDailyTarget, setMonthlyTarget, setWeeklyTarget]);

  // Cash movement logger UI
  const [withdrawAmt, setWithdrawAmt] = useState<number>(0);
  const [withdrawNote, setWithdrawNote] = useState<string>("");
  const [depositAmt, setDepositAmt] = useState<number>(0);
  const [depositNote, setDepositNote] = useState<string>("");

  // --- MIGRATE old "Withdrawals" entries so they stop counting as losses ---
  useEffect(() => {
    setTrades((prev) => {
      let changed = false;

      const next = prev.map((t) => {
        const kind = t.kind ?? "trade";

        const noteText = String(`${t.symbol || ""} ${t.notes || ""}`).toLowerCase();
        const looksLikeWithdrawal =
          kind === "trade" &&
          (String(t.symbol || "").toLowerCase() === "withdrawals" || noteText.includes("withdraw"));
        const looksLikeDeposit =
          kind === "trade" &&
          (String(t.symbol || "").toLowerCase() === "deposits" || noteText.includes("deposit"));

        if (!looksLikeWithdrawal && !looksLikeDeposit) {
          // ensure kind exists going forward
          if (!t.kind) changed = true;
          return { ...t, kind };
        }

        changed = true;
        const amt = Math.abs(Number(t.amount || t.pnl || 0));
        const newKind = looksLikeWithdrawal ? "withdrawal" : "deposit";
        return {
          ...t,
          kind: newKind,
          amount: amt,
          pnl: 0,
          symbol: newKind === "withdrawal" ? "Withdrawals" : "Deposits",
          notes: t.notes || (newKind === "withdrawal" ? "Withdrawal recorded" : "Deposit recorded"),
        };
      });

      return changed ? next : prev;
    });
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Admin access (used for Battle Board publishing) ---------- */
  const ADMIN_USER_ID = process.env.NEXT_PUBLIC_UST_ADMIN_USER_ID;
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_UST_ADMIN_EMAIL;

  const isAdmin = useMemo(() => {
    const uid = (user as any)?.id || (user as any)?.user?.id;
    const email = (user as any)?.email || (user as any)?.user?.email;
    const adminUid = ADMIN_USER_ID || "39127777-9fd8-4183-96bf-03f943b56a24";

    if (!uid) return false;
    if (uid === adminUid) return true;
    if (
      ADMIN_EMAIL &&
      email &&
      String(email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase()
    )
      return true;
    return false;
  }, [user, ADMIN_USER_ID, ADMIN_EMAIL]);

  /* ---------- UST Markets Battle Board (admin published, everyone can view) ---------- */
  // Recommended Supabase table: ust_market_battle_board
  // Columns: id text primary key, market text, account text, starting_capital numeric, trades int, target_trades int,
  // profit numeric, win_rate numeric, max_dd numeric, profit_factor numeric, best_runner_r numeric,
  // avg_r numeric, discipline int, manual_interruptions int, status text, notes text, updated_at timestamptz.
  const BATTLE_TABLE = "ust_market_battle_board";
  const [battleRows, setBattleRows] =
    useState<BattleMarketRow[]>(DEFAULT_BATTLE_ROWS);
  const [battleDraftRows, setBattleDraftRows] =
    useState<BattleMarketRow[]>(DEFAULT_BATTLE_ROWS);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleSaving, setBattleSaving] = useState(false);
  const [battleSyncing, setBattleSyncing] = useState<string | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battleUpdatedAt, setBattleUpdatedAt] = useState<string>("");
  const [battlePeriodStart, setBattlePeriodStart] = useState<string>("");
  const [battlePeriodEnd, setBattlePeriodEnd] = useState<string>("");
  const [battleExplorerMarketId, setBattleExplorerMarketId] = useState<string>(
    DEFAULT_BATTLE_ROWS[0]?.id || "",
  );
  const [battleExplorerTrades, setBattleExplorerTrades] = useState<
    BattleExplorerTrade[]
  >([]);
  const [battleExplorerLoading, setBattleExplorerLoading] = useState(false);
  const [battleExplorerError, setBattleExplorerError] = useState<string | null>(
    null,
  );

  const normalizeBattleRow = (
    row: any,
    fallback?: BattleMarketRow,
  ): BattleMarketRow => ({
    id: String(row?.id ?? fallback?.id ?? crypto.randomUUID()),
    market: String(row?.market ?? fallback?.market ?? "Market"),
    account: String(row?.account ?? fallback?.account ?? "Kuda_Market"),
    startingCapital: Number(
      row?.starting_capital ??
        row?.startingCapital ??
        fallback?.startingCapital ??
        0,
    ),
    trades: Number(row?.trades ?? fallback?.trades ?? 0),
    targetTrades: Number(
      row?.target_trades ?? row?.targetTrades ?? fallback?.targetTrades ?? 100,
    ),
    profit: Number(row?.profit ?? fallback?.profit ?? 0),
    winRate: Number(row?.win_rate ?? row?.winRate ?? fallback?.winRate ?? 0),
    maxDd: Number(row?.max_dd ?? row?.maxDd ?? fallback?.maxDd ?? 0),
    profitFactor: Number(
      row?.profit_factor ?? row?.profitFactor ?? fallback?.profitFactor ?? 0,
    ),
    bestRunnerR: Number(
      row?.best_runner_r ?? row?.bestRunnerR ?? fallback?.bestRunnerR ?? 0,
    ),
    avgR: Number(row?.avg_r ?? row?.avgR ?? fallback?.avgR ?? 0),
    discipline: Number(row?.discipline ?? fallback?.discipline ?? 100),
    manualInterruptions: Number(
      row?.manual_interruptions ??
        row?.manualInterruptions ??
        fallback?.manualInterruptions ??
        0,
    ),
    status: (row?.status ??
      fallback?.status ??
      "Stable") as BattleMarketRow["status"],
    notes: String(row?.notes ?? fallback?.notes ?? ""),
    periodStart: String(
      row?.period_start ?? row?.periodStart ?? fallback?.periodStart ?? "",
    ),
    periodEnd: String(
      row?.period_end ?? row?.periodEnd ?? fallback?.periodEnd ?? "",
    ),
  });

  const loadBattleBoard = useCallback(async () => {
    setBattleLoading(true);
    setBattleError(null);
    try {
      const { data, error } = await supabase
        .from(BATTLE_TABLE)
        .select("*")
        .order("profit", { ascending: false });
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        const rowsFromDb = data.map((r: any) => normalizeBattleRow(r));
        // Keep the board at 5 markets even when Supabase still has the older 4-market data.
        // The new market will appear for admin, then it can be calculated and published once.
        const missingDefaults = DEFAULT_BATTLE_ROWS.filter(
          (d) => !rowsFromDb.some((r) => r.id === d.id),
        );
        const rows = [...rowsFromDb, ...missingDefaults];
        setBattleRows(rows);
        setBattleDraftRows(rows);
        const latest = data
          .map((r: any) => r.updated_at)
          .filter(Boolean)
          .sort()
          .pop();
        if (latest) setBattleUpdatedAt(new Date(latest).toLocaleString());
        const periodRow = data.find((r: any) => r.period_start || r.period_end);
        if (periodRow) {
          setBattlePeriodStart(periodRow.period_start || "");
          setBattlePeriodEnd(periodRow.period_end || "");
        }
      } else {
        setBattleRows(DEFAULT_BATTLE_ROWS);
        setBattleDraftRows(DEFAULT_BATTLE_ROWS);
      }
    } catch (e: any) {
      setBattleError(
        e?.message ||
          "Battle Board table not connected yet. Showing starter board.",
      );
      setBattleRows(DEFAULT_BATTLE_ROWS);
      setBattleDraftRows(DEFAULT_BATTLE_ROWS);
    } finally {
      setBattleLoading(false);
    }
  }, []);

  const publishBattleBoard = useCallback(async () => {
    if (!isAdmin) return;
    setBattleSaving(true);
    setBattleError(null);
    try {
      const payload = battleDraftRows.map((r) => ({
        id: r.id,
        market: r.market,
        account: r.account,
        starting_capital: Number(r.startingCapital || 0),
        trades: Number(r.trades || 0),
        target_trades: Number(r.targetTrades || 100),
        profit: Number(r.profit || 0),
        win_rate: Number(r.winRate || 0),
        max_dd: Number(r.maxDd || 0),
        profit_factor: Number(r.profitFactor || 0),
        best_runner_r: Number(r.bestRunnerR || 0),
        avg_r: Number(r.avgR || 0),
        discipline: Number(r.discipline || 0),
        manual_interruptions: Number(r.manualInterruptions || 0),
        status: r.status,
        notes: r.notes,
        period_start: battlePeriodStart || null,
        period_end: battlePeriodEnd || null,
        updated_at: new Date().toISOString(),
      }));
      let { error } = await supabase
        .from(BATTLE_TABLE)
        .upsert(payload, { onConflict: "id" });
      if (
        error &&
        String(error.message || "")
          .toLowerCase()
          .includes("starting_capital")
      ) {
        const fallbackPayload = payload.map(
          ({ starting_capital, period_start, period_end, ...rest }) => rest,
        );
        const retry = await supabase
          .from(BATTLE_TABLE)
          .upsert(fallbackPayload, { onConflict: "id" });
        error = retry.error;
      }
      if (error) throw error;
      setBattleRows(battleDraftRows);
      setBattleUpdatedAt(new Date().toLocaleString());
      push({
        title: "Battle Board published",
        desc: "The weekly market stats are live for everyone.",
      });
      await loadBattleBoard();
    } catch (e: any) {
      setBattleError(e?.message || "Could not publish Battle Board.");
    } finally {
      setBattleSaving(false);
    }
  }, [
    battleDraftRows,
    battlePeriodStart,
    battlePeriodEnd,
    isAdmin,
    loadBattleBoard,
    push,
  ]);

  useEffect(() => {
    void loadBattleBoard();
  }, [loadBattleBoard]);
  const syncBattleMarket = useCallback(
    async (idx: number) => {
      if (!isAdmin) return;
      const base = battleDraftRows[idx];
      if (!base?.account) return;
      setBattleSyncing(base.id);
      setBattleError(null);
      try {
        const url = buildSheetsUrl(
          base.account,
          battlePeriodStart || undefined,
        );
        if (!url)
          throw new Error(
            "Google Sheet connection is missing. Check SHEETS_WEBAPP_URL and READ_TOKEN.",
          );
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
          throw new Error(`Sheet import failed for ${base.account}.`);
        const json = await res.json();
        const items: SheetItem[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.data)
              ? json.data
              : [];
        const calculated = computeBattleStatsFromSheet(
          items,
          base,
          battlePeriodStart || undefined,
          battlePeriodEnd || undefined,
        );
        setBattleDraftRows((prev) =>
          prev.map((r, i) => (i === idx ? calculated : r)),
        );
        push({
          title: "Market stats calculated",
          desc: `${base.account} updated from Google Sheet closed trades.`,
        });
      } catch (e: any) {
        setBattleError(e?.message || `Could not sync ${base.account}.`);
      } finally {
        setBattleSyncing(null);
      }
    },
    [battleDraftRows, battlePeriodStart, battlePeriodEnd, isAdmin, push],
  );

  const syncAllBattleMarkets = useCallback(async () => {
    if (!isAdmin) return;
    for (let i = 0; i < battleDraftRows.length; i++) {
      await syncBattleMarket(i);
    }
  }, [battleDraftRows.length, isAdmin, syncBattleMarket]);

  const loadBattleTradeExplorer = useCallback(
    async (marketId?: string) => {
      const selected =
        battleRows.find((r) => r.id === (marketId || battleExplorerMarketId)) ||
        battleRows[0];
      if (!selected?.account) return;
      setBattleExplorerMarketId(selected.id);
      setBattleExplorerLoading(true);
      setBattleExplorerError(null);
      try {
        const url = buildSheetsUrl(
          selected.account,
          battlePeriodStart || selected.periodStart || undefined,
        );
        if (!url)
          throw new Error(
            "Google Sheet connection is missing. Check SHEETS_WEBAPP_URL and READ_TOKEN.",
          );
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
          throw new Error(
            `Could not load trade explorer for ${selected.market}.`,
          );
        const json = await res.json();
        const items: SheetItem[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.data)
              ? json.data
              : [];
        setBattleExplorerTrades(
          buildBattleExplorerTrades(
            items,
            selected,
            battlePeriodStart || selected.periodStart || undefined,
            battlePeriodEnd || selected.periodEnd || undefined,
          ),
        );
      } catch (e: any) {
        setBattleExplorerError(e?.message || "Could not load Trade Explorer.");
        setBattleExplorerTrades([]);
      } finally {
        setBattleExplorerLoading(false);
      }
    },
    [battleRows, battleExplorerMarketId, battlePeriodStart, battlePeriodEnd],
  );

  useEffect(() => {
    if (battleRows.length && !battleExplorerTrades.length)
      void loadBattleTradeExplorer(battleRows[0].id);
  }, [battleRows.length]);

  const battleGradeStats = useMemo(
    () => groupBattleTrades(battleExplorerTrades, "setupGrade"),
    [battleExplorerTrades],
  );
  const battleSessionStats = useMemo(
    () => groupBattleTrades(battleExplorerTrades, "session"),
    [battleExplorerTrades],
  );
  const battleSelectedMarket = useMemo(
    () =>
      battleRows.find((r) => r.id === battleExplorerMarketId) || battleRows[0],
    [battleRows, battleExplorerMarketId],
  );
  const battleCoachSummary = useMemo(
    () =>
      buildBattleAiCoachSummary(
        battleRows,
        battleSelectedMarket,
        battleExplorerTrades,
        battleGradeStats,
        battleSessionStats,
      ),
    [
      battleRows,
      battleSelectedMarket,
      battleExplorerTrades,
      battleGradeStats,
      battleSessionStats,
    ],
  );

  const battleRankedRows = useMemo(() => {
    return [...battleRows].sort((a, b) => {
      const scoreA =
        (a.profit > 0 ? 30 : 0) +
        a.discipline * 0.25 +
        Math.min(a.trades / Math.max(1, a.targetTrades), 1) * 25 +
        Math.max(0, 20 - a.maxDd);
      const scoreB =
        (b.profit > 0 ? 30 : 0) +
        b.discipline * 0.25 +
        Math.min(b.trades / Math.max(1, b.targetTrades), 1) * 25 +
        Math.max(0, 20 - b.maxDd);
      return scoreB - scoreA;
    });
  }, [battleRows]);

  const battleOverallSummary = useMemo(() => {
    const activeRows = battleRows.filter((r) => String(r.market || "").trim());
    const totalProfit = activeRows.reduce(
      (sum, r) => sum + Number(r.profit || 0),
      0,
    );
    const totalTrades = activeRows.reduce(
      (sum, r) => sum + Number(r.trades || 0),
      0,
    );
    const weightedWinRate = totalTrades
      ? activeRows.reduce(
          (sum, r) => sum + Number(r.winRate || 0) * Number(r.trades || 0),
          0,
        ) / totalTrades
      : 0;
    const avgProfitFactor = activeRows.length
      ? activeRows.reduce((sum, r) => sum + Number(r.profitFactor || 0), 0) /
        activeRows.length
      : 0;
    const bestMarket = [...activeRows].sort(
      (a, b) => Number(b.profit || 0) - Number(a.profit || 0),
    )[0];
    return {
      activeRows,
      totalProfit,
      totalTrades,
      weightedWinRate,
      avgProfitFactor,
      bestMarket,
      marketCount: activeRows.length,
    };
  }, [battleRows]);

  const battleLeader = battleRankedRows[0];
  const battleRiskRows = useMemo(() => {
    return [...battleRows]
      .filter((r) => String(r.market || "").trim())
      .sort((a, b) => {
        const riskA =
          Math.max(0, Number(a.maxDd || 0)) +
          Math.max(0, 70 - Number(a.discipline || 0)) +
          (Number(a.profit || 0) < 0 ? 12 : 0);
        const riskB =
          Math.max(0, Number(b.maxDd || 0)) +
          Math.max(0, 70 - Number(b.discipline || 0)) +
          (Number(b.profit || 0) < 0 ? 12 : 0);
        return riskB - riskA;
      })
      .slice(0, 3);
  }, [battleRows]);

  const battleAiInsightLines = useMemo(() => {
    const active = battleOverallSummary.activeRows;
    const profitable = active.filter((r) => Number(r.profit || 0) > 0).length;
    const pressure = active.filter(
      (r) =>
        Number(r.maxDd || 0) >= 10 ||
        Number(r.discipline || 0) < 80 ||
        Number(r.profit || 0) < 0,
    ).length;
    const leader = battleRankedRows[0];
    const lagger = [...active].sort(
      (a, b) => Number(a.profit || 0) - Number(b.profit || 0),
    )[0];

    return [
      leader
        ? `${leader.market} is currently carrying the strongest battle score. Keep capital focus here only while drawdown stays controlled.`
        : "Waiting for enough market data to identify a clear leader.",
      `${profitable}/${active.length || 0} markets are currently profitable, with ${pressure} market${pressure === 1 ? "" : "s"} needing closer risk monitoring.`,
      lagger && Number(lagger.profit || 0) < 0
        ? `${lagger.market} is the weakest performer by net PnL. Reduce confidence until it proves recovery through clean closed trades.`
        : "No market is deeply negative by net PnL yet; continue collecting clean closed-trade data.",
    ];
  }, [battleOverallSummary.activeRows, battleRankedRows]);

  const battleSurvivalRaceRows = useMemo(() => {
    const active = battleRows.filter((m) => String(m.market || "").trim());
    const bestProfit = Math.max(
      1,
      ...active.map((m) => Math.max(0, Number(m.profit || 0))),
    );

    return active
      .map((m) => {
        const target = Math.max(1, Number(m.targetTrades || 100));
        const tradesDone = Math.max(0, Number(m.trades || 0));
        const progress = Math.min(100, (tradesDone / target) * 100);
        const remaining = Math.max(0, target - tradesDone);

        // UST Survival Race philosophy:
        // 1) number of completed trades is the main proof,
        // 2) profit comes next,
        // 3) drawdown, PF and win rate are supporting quality checks.
        const progressScore = Math.min(55, progress * 0.55); // 55% weight
        const profitScore = Math.min(
          20,
          (Math.max(0, Number(m.profit || 0)) / bestProfit) * 20,
        ); // 20% weight
        const ddScore = Math.max(
          0,
          15 - Math.max(0, Number(m.maxDd || 0)) * 0.375,
        ); // 15% weight
        const pfScore = Math.min(
          7,
          Math.max(0, Number(m.profitFactor || 0)) * 2.33,
        ); // 7% weight
        const winScore = Math.min(
          3,
          Math.max(0, Number(m.winRate || 0)) * 0.03,
        ); // 3% weight
        const survivalScore = Math.round(
          Math.max(
            0,
            Math.min(
              100,
              progressScore + profitScore + ddScore + pfScore + winScore,
            ),
          ),
        );

        const evidenceLevel =
          tradesDone >= target
            ? "UST Certified"
            : tradesDone >= 76
              ? "Elite Survivor"
              : tradesDone >= 51
                ? "Advanced Survivor"
                : tradesDone >= 26
                  ? "Proven Stability"
                  : tradesDone >= 11
                    ? "Emerging Edge"
                    : "Early Evidence";

        const status =
          tradesDone >= target &&
          Number(m.profit || 0) > 0 &&
          Number(m.maxDd || 0) <= 60
            ? "Certified"
            : Number(m.maxDd || 0) >= 40 || Number(m.profit || 0) < 0
              ? "Survival Risk"
              : tradesDone < 11
                ? "Early Evidence"
                : tradesDone < 26
                  ? "Evidence Building"
                  : Number(m.profitFactor || 0) >= 1.8 &&
                      Number(m.profit || 0) > 0
                    ? "Front Runner"
                    : "In The Race";

        return {
          ...m,
          progress,
          remaining,
          survivalScore,
          raceStatus: status,
          evidenceLevel,
        };
      })
      .sort((a, b) => {
        if (b.survivalScore !== a.survivalScore)
          return b.survivalScore - a.survivalScore;
        if (b.trades !== a.trades) return b.trades - a.trades;
        return Number(b.profit || 0) - Number(a.profit || 0);
      })
      .map((m, idx) => ({ ...m, raceRank: idx + 1 }));
  }, [battleRows]);

  const battleSurvivalSummary = useMemo(() => {
    const leader = battleSurvivalRaceRows[0];
    const avgProgress = battleSurvivalRaceRows.length
      ? battleSurvivalRaceRows.reduce((sum, r) => sum + r.progress, 0) /
        battleSurvivalRaceRows.length
      : 0;
    const certified = battleSurvivalRaceRows.filter(
      (r) => r.raceStatus === "Certified",
    ).length;
    const risk = battleSurvivalRaceRows.filter(
      (r) => r.raceStatus === "Survival Risk",
    ).length;
    return { leader, avgProgress, certified, risk };
  }, [battleSurvivalRaceRows]);

  const battleCertificationRows = useMemo(() => {
    return battleSurvivalRaceRows
      .map((m) => {
        const progress = Math.min(100, Math.max(0, Number(m.progress || 0)));
        const profitOk = Number(m.profit || 0) > 0;
        const ddOk = Number(m.maxDd || 0) <= 60;
        const pfOk = Number(m.profitFactor || 0) >= 1;
        const winOk = Number(m.winRate || 0) >= 45;
        const completed =
          Number(m.trades || 0) >= Number(m.targetTrades || 100);

        const certificationScore = Math.round(
          Math.min(
            100,
            progress * 0.4 +
              (profitOk ? 20 : 0) +
              (ddOk ? 20 : 0) +
              (pfOk ? 10 : 0) +
              (winOk ? 10 : 0),
          ),
        );

        const level =
          completed && profitOk && ddOk
            ? "UST Certified"
            : certificationScore >= 80
              ? "Gold Candidate"
              : certificationScore >= 60
                ? "Silver Candidate"
                : certificationScore >= 40
                  ? "Bronze Candidate"
                  : "Research Candidate";

        const requirements = [
          {
            label: "100 trades",
            ok: completed,
            value: `${m.trades}/${m.targetTrades}`,
          },
          {
            label: "Positive PnL",
            ok: profitOk,
            value: currency(Number(m.profit || 0)),
          },
          {
            label: "DD below 60%",
            ok: ddOk,
            value: `${fmt(Number(m.maxDd || 0))}%`,
          },
          {
            label: "PF above 1.00",
            ok: pfOk,
            value: fmt(Number(m.profitFactor || 0)),
          },
          {
            label: "WR above 45%",
            ok: winOk,
            value: `${fmt(Number(m.winRate || 0))}%`,
          },
        ];

        return {
          ...m,
          certificationScore,
          certificationLevel: level,
          requirements,
        };
      })
      .sort((a, b) => b.certificationScore - a.certificationScore);
  }, [battleSurvivalRaceRows]);

  const battleTransparencyPortal = useMemo(() => {
    const active = battleRows.filter((r) => String(r.market || "").trim());
    const markets = active.length || 1;
    const profitable = active.filter((r) => Number(r.profit || 0) > 0).length;
    const stable = active.filter((r) =>
      ["Stable", "Certified"].includes(String(r.status || "")),
    ).length;
    const totalTrades = active.reduce(
      (sum, r) => sum + Number(r.trades || 0),
      0,
    );
    const totalTarget =
      active.reduce((sum, r) => sum + Number(r.targetTrades || 100), 0) ||
      markets * 100;
    const avgDd =
      active.reduce((sum, r) => sum + Number(r.maxDd || 0), 0) / markets;
    const progressPct = Math.min(
      100,
      (totalTrades / Math.max(1, totalTarget)) * 100,
    );
    const publicScore = Math.round(
      Math.min(
        100,
        progressPct * 0.35 +
          (profitable / markets) * 25 +
          (stable / markets) * 20 +
          Math.max(0, 20 - Math.min(20, avgDd * 0.5)),
      ),
    );
    const mode =
      publicScore >= 75
        ? "Investor Ready Watchlist"
        : publicScore >= 50
          ? "Public Proof Building"
          : "Research Transparency Mode";
    const checklist = [
      {
        label: "Live market board published",
        ok: active.length >= 5,
        detail: `${active.length}/5 markets`,
      },
      {
        label: "100-trade race visible",
        ok: totalTrades > 0,
        detail: `${totalTrades}/${totalTarget} trades`,
      },
      {
        label: "Positive markets",
        ok: profitable >= Math.ceil(markets / 2),
        detail: `${profitable}/${markets}`,
      },
      {
        label: "Risk disclosed",
        ok: active.some((r) => Number(r.maxDd || 0) > 0),
        detail: `Avg DD ${fmt(avgDd)}%`,
      },
      {
        label: "Certification pathway active",
        ok: battleCertificationRows.length > 0,
        detail: `${battleCertificationRows.filter((r) => r.certificationLevel === "UST Certified").length} certified`,
      },
    ];
    return {
      publicScore,
      mode,
      checklist,
      progressPct,
      profitable,
      stable,
      markets,
      totalTrades,
      totalTarget,
      avgDd,
    };
  }, [battleRows, battleCertificationRows]);

  const battleSessionHeatmap = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const sessions = ["Asia", "London", "New York", "Late NY"];
    const cells: Record<
      string,
      {
        day: string;
        session: string;
        trades: number;
        profit: number;
        wins: number;
        avgR: number;
      }
    > = {};
    for (const day of days)
      for (const session of sessions)
        cells[`${day}-${session}`] = {
          day,
          session,
          trades: 0,
          profit: 0,
          wins: 0,
          avgR: 0,
        };

    for (const t of battleExplorerTrades) {
      const d = t.timestamp ? new Date(t.timestamp) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const day = days[(d.getDay() + 6) % 7];
      if (!day) continue;
      const session = sessions.includes(t.session) ? t.session : "Unknown";
      if (!sessions.includes(session)) continue;
      const key = `${day}-${session}`;
      const cell = cells[key];
      cell.trades += 1;
      cell.profit = Number((cell.profit + Number(t.pnl || 0)).toFixed(2));
      cell.wins += Number(t.pnl || 0) > 0 ? 1 : 0;
      cell.avgR = Number(
        (
          (cell.avgR * (cell.trades - 1) + Number(t.r || 0)) /
          cell.trades
        ).toFixed(2),
      );
    }

    const populated = Object.values(cells).filter((c) => c.trades > 0);
    const best = populated.length
      ? [...populated].sort((a, b) => b.profit - a.profit)[0]
      : null;
    const worst = populated.length
      ? [...populated].sort((a, b) => a.profit - b.profit)[0]
      : null;
    return { days, sessions, cells, best, worst };
  }, [battleExplorerTrades]);

  const exportBattleBoardPdf = useCallback(() => {
    if (typeof window === "undefined") return;

    const esc = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const reportDate = new Date().toLocaleString();
    const periodText = `${battlePeriodStart || "Start"} → ${battlePeriodEnd || "Today"}`;
    const selectedMarket =
      battleRows.find((r) => r.id === battleExplorerMarketId) || battleRows[0];
    const totalProfit = battleRows.reduce(
      (sum, r) => sum + Number(r.profit || 0),
      0,
    );
    const totalTrades = battleRows.reduce(
      (sum, r) => sum + Number(r.trades || 0),
      0,
    );
    const avgWinRate = battleRows.length
      ? battleRows.reduce((sum, r) => sum + Number(r.winRate || 0), 0) /
        battleRows.length
      : 0;
    const avgDd = battleRows.length
      ? battleRows.reduce((sum, r) => sum + Number(r.maxDd || 0), 0) /
        battleRows.length
      : 0;

    const marketRows = battleRankedRows
      .map(
        (m, idx) => `
      <tr>
        <td><strong>#${idx + 1} ${esc(m.market)}</strong></td>
        <td>${esc(m.trades)}/${esc(m.targetTrades)}</td>
        <td class="${m.profit >= 0 ? "positive" : "negative"}">${esc(currency(m.profit))}</td>
        <td>${esc(fmt(m.winRate))}%</td>
        <td>${esc(fmt(m.avgR))}R</td>
        <td>${esc(fmt(m.profitFactor))}</td>
        <td>${esc(fmt(m.maxDd))}%</td>
        <td>${esc(m.discipline)}/100</td>
        <td><span class="pill">${esc(m.status)}</span></td>
      </tr>`,
      )
      .join("");

    const notesRows = battleRankedRows
      .map(
        (m) => `
      <div class="note-card">
        <div class="note-title">${esc(m.market)} Weekly Read</div>
        <div>${esc(m.notes || "No notes published yet.")}</div>
      </div>`,
      )
      .join("");

    const gradeRows = (battleGradeStats.length ? battleGradeStats : [])
      .map(
        (g) =>
          `<tr><td><strong>${esc(g.label)}</strong></td><td>${esc(g.trades)}</td><td class="${g.profit >= 0 ? "positive" : "negative"}">${esc(currency(g.profit))}</td><td>${esc(fmt(g.winRate))}%</td><td>${esc(fmt(g.profitFactor))}</td><td>${esc(fmt(g.avgR))}R</td></tr>`,
      )
      .join("");

    const sessionRows = (battleSessionStats.length ? battleSessionStats : [])
      .map(
        (g) =>
          `<tr><td><strong>${esc(g.label)}</strong></td><td>${esc(g.trades)}</td><td class="${g.profit >= 0 ? "positive" : "negative"}">${esc(currency(g.profit))}</td><td>${esc(fmt(g.winRate))}%</td><td>${esc(fmt(g.profitFactor))}</td><td>${esc(fmt(g.avgR))}R</td></tr>`,
      )
      .join("");

    const survivalRows = battleSurvivalRaceRows
      .map(
        (m) =>
          `<tr><td><strong>#${esc(m.raceRank)} ${esc(m.market)}</strong></td><td>${esc(m.trades)}/${esc(m.targetTrades)}</td><td>${esc(fmt(m.progress))}%</td><td>${esc(m.survivalScore)}/100</td><td>${esc(m.evidenceLevel || "Early Evidence")}</td><td>${esc(m.raceStatus)}</td><td class="${m.profit >= 0 ? "positive" : "negative"}">${esc(currency(m.profit))}</td></tr>`,
      )
      .join("");

    const heatmapRows = battleSessionHeatmap.sessions
      .map(
        (session) => `
      <tr><td><strong>${esc(session)}</strong></td>${battleSessionHeatmap.days
        .map((day) => {
          const cell = battleSessionHeatmap.cells[`${day}-${session}`];
          return `<td class="${cell?.profit >= 0 ? "positive" : "negative"}">${cell?.trades ? `${esc(currency(cell.profit))}<br/><small>${esc(cell.trades)}T • WR ${esc(fmt((cell.wins / cell.trades) * 100))}%</small>` : "—"}</td>`;
        })
        .join("")}</tr>`,
      )
      .join("");

    const tradeRowsHtml = battleExplorerTrades
      .slice(0, 60)
      .map(
        (t) => `
      <tr>
        <td>${esc(t.timestamp ? new Date(t.timestamp).toLocaleString() : "-")}</td>
        <td>${esc(t.session)}</td>
        <td><strong>${esc(t.setupGrade)}</strong></td>
        <td>${esc(t.side)}</td>
        <td>${esc(t.symbol)}</td>
        <td>${esc(t.result)}</td>
        <td class="${t.pnl >= 0 ? "positive" : "negative"}">${esc(currency(t.pnl))}</td>
        <td>${esc(fmt(t.r))}R</td>
      </tr>`,
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>UST Markets Battle Board PDF Report</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #ffffff; }
    .cover { border: 2px solid #D4AF37; border-radius: 22px; padding: 22px; background: linear-gradient(135deg, #050814, #0B1220 62%, #111827); color: white; }
    .brand { color: #F6C945; font-size: 12px; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
    h1 { margin: 8px 0 8px; font-size: 30px; line-height: 1.05; }
    h2 { margin: 22px 0 10px; font-size: 18px; color: #0f172a; }
    .subtitle { max-width: 760px; color: #cbd5e1; line-height: 1.5; font-size: 13px; }
    .meta { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .meta-card { border: 1px solid rgba(212,175,55,.45); border-radius: 16px; padding: 10px; background: rgba(0,0,0,.24); }
    .meta-label { color: #94a3b8; font-size: 10px; text-transform: uppercase; font-weight: 800; }
    .meta-value { margin-top: 4px; color: #fff; font-size: 15px; font-weight: 900; }
    .summary { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 12px; background: #f8fafc; }
    .summary-label { color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 900; }
    .summary-value { margin-top: 6px; font-size: 18px; font-weight: 900; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #0B1220; color: #F6C945; padding: 8px; text-align: left; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; }
    td { border-bottom: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
    .positive { color: #047857; font-weight: 900; }
    .negative { color: #be123c; font-weight: 900; }
    .pill { display: inline-block; border: 1px solid #D4AF37; border-radius: 999px; padding: 3px 7px; font-weight: 900; font-size: 9px; background: #fffbeb; color: #78350f; }
    .notes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 8px; }
    .note-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px; background: #f8fafc; font-size: 11px; line-height: 1.45; }
    .note-title { color: #92400e; font-weight: 900; margin-bottom: 5px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .section { break-inside: avoid; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <section class="cover">
    <div class="brand">Ultimate Scalper Tool • UST Research Lab</div>
    <h1>Markets Battle Board Report</h1>
    <div class="subtitle">Professional PDF export for sharing the weekly UST market research board with investors, followers and trading students. The report focuses on survival, discipline, drawdown control and repeatable performance.</div>
    <div class="meta">
      <div class="meta-card"><div class="meta-label">Period</div><div class="meta-value">${esc(periodText)}</div></div>
      <div class="meta-card"><div class="meta-label">Last Published</div><div class="meta-value">${esc(battleUpdatedAt || "Not published yet")}</div></div>
      <div class="meta-card"><div class="meta-label">Exported</div><div class="meta-value">${esc(reportDate)}</div></div>
    </div>
  </section>

  <div class="summary">
    <div class="summary-card"><div class="summary-label">Total Profit</div><div class="summary-value ${totalProfit >= 0 ? "positive" : "negative"}">${esc(currency(totalProfit))}</div></div>
    <div class="summary-card"><div class="summary-label">Total Trades</div><div class="summary-value">${esc(totalTrades)}</div></div>
    <div class="summary-card"><div class="summary-label">Average Win Rate</div><div class="summary-value">${esc(fmt(avgWinRate))}%</div></div>
    <div class="summary-card"><div class="summary-label">Average Drawdown</div><div class="summary-value">${esc(fmt(avgDd))}%</div></div>
  </div>

  <section class="section">
    <h2>Detailed Market Stats</h2>
    <table><thead><tr><th>Market</th><th>Trades</th><th>Profit</th><th>Win %</th><th>Avg R</th><th>PF</th><th>DD %</th><th>Health</th><th>Status</th></tr></thead><tbody>${marketRows}</tbody></table>
  </section>

  <section class="section">
    <h2>Weekly Reads</h2>
    <div class="notes-grid">${notesRows}</div>
  </section>

  <section class="section">
    <h2>100 Trade Survival Race</h2>
    <table><thead><tr><th>Rank</th><th>Trades</th><th>Progress</th><th>Survival Score</th><th>Evidence Level</th><th>Race Status</th><th>Profit</th></tr></thead><tbody>${survivalRows || `<tr><td colspan="7">No survival race data loaded yet.</td></tr>`}</tbody></table>
  </section>

  <section class="section">
    <h2>Session Heatmap${selectedMarket ? ` • ${esc(selectedMarket.market)}` : ""}</h2>
    <table><thead><tr><th>Session</th>${battleSessionHeatmap.days.map((day) => `<th>${esc(day)}</th>`).join("")}</tr></thead><tbody>${heatmapRows || `<tr><td colspan="7">No heatmap data loaded yet.</td></tr>`}</tbody></table>
  </section>

  <section class="section two-col">
    <div>
      <h2>Setup Grade Analytics${selectedMarket ? ` • ${esc(selectedMarket.market)}` : ""}</h2>
      <table><thead><tr><th>Grade</th><th>Trades</th><th>Profit</th><th>Win %</th><th>PF</th><th>Avg R</th></tr></thead><tbody>${gradeRows || `<tr><td colspan="7">No setup grade data loaded yet.</td></tr>`}</tbody></table>
    </div>
    <div>
      <h2>Session Intelligence${selectedMarket ? ` • ${esc(selectedMarket.market)}` : ""}</h2>
      <table><thead><tr><th>Session</th><th>Trades</th><th>Profit</th><th>Win %</th><th>PF</th><th>Avg R</th></tr></thead><tbody>${sessionRows || `<tr><td colspan="7">No session data loaded yet.</td></tr>`}</tbody></table>
    </div>
  </section>

  <section class="section">
    <h2>Recent Closed Trades${selectedMarket ? ` • ${esc(selectedMarket.market)}` : ""}</h2>
    <table><thead><tr><th>Time</th><th>Session</th><th>Grade</th><th>Side</th><th>Symbol</th><th>Result</th><th>Profit</th><th>R</th></tr></thead><tbody>${tradeRowsHtml || `<tr><td colspan="8">No recent trades loaded yet.</td></tr>`}</tbody></table>
  </section>

  <div class="footer"><span>UST PDF Export</span><span>Generated from the live Battle Board</span></div>
  <script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      push({
        title: "PDF export blocked",
        desc: "Please allow pop-ups for this site, then try Export PDF again.",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, [
    battleRows,
    battleRankedRows,
    battleGradeStats,
    battleSessionStats,
    battleExplorerTrades,
    battleExplorerMarketId,
    battlePeriodStart,
    battlePeriodEnd,
    battleUpdatedAt,
    push,
  ]);

  /* Derived */
  const tradeRows = useMemo(
    () =>
      trades
        .map((t) => ({
          ...t,
          kind: (t.kind ?? "trade") as "trade" | "withdrawal" | "deposit",
        }))
        .filter((t) => t.kind === "trade"),
    [trades],
  );

  const withdrawalRows = useMemo(
    () =>
      trades
        .map((t) => ({
          ...t,
          kind: (t.kind ?? "trade") as "trade" | "withdrawal" | "deposit",
        }))
        .filter((t) => t.kind === "withdrawal"),
    [trades],
  );

  const depositRows = useMemo(
    () =>
      trades
        .map((t) => ({
          ...t,
          kind: (t.kind ?? "trade") as "trade" | "withdrawal" | "deposit",
        }))
        .filter((t) => t.kind === "deposit"),
    [trades],
  );

  const totalTradePnlAllTime = useMemo(
    () => tradeRows.reduce((acc, t) => acc + (t.pnl || 0), 0),
    [tradeRows],
  );

  const totalWithdrawnAllTime = useMemo(
    () => withdrawalRows.reduce((acc, w) => acc + (w.amount || 0), 0),
    [withdrawalRows],
  );

  const totalDepositedAllTime = useMemo(
    () => depositRows.reduce((acc, d) => acc + (d.amount || 0), 0),
    [depositRows],
  );

  // Equity = starting capital + deposits + trading PnL - withdrawals
  const equity = useMemo(
    () => startBalance + totalDepositedAllTime + totalTradePnlAllTime - totalWithdrawnAllTime,
    [startBalance, totalDepositedAllTime, totalTradePnlAllTime, totalWithdrawnAllTime],
  );

  // Monthly withdrawals / deposits (current month)
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

  const monthlyDeposited = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0, 0).getTime();
    const end = new Date(y, m + 1, 1, 0, 0, 0, 0).getTime();
    return depositRows
      .filter((d) => (d.ts || 0) >= start && (d.ts || 0) < end)
      .reduce((acc, d) => acc + (d.amount || 0), 0);
  }, [depositRows]);
  /* === Guardrails (derived; checklist-only, read-only) === */
  const realizedProfit = useMemo(
    () => Math.max(0, equity - startBalance),
    [equity, startBalance],
  );
  const realizedProfitPct = useMemo(
    () => (startBalance ? (realizedProfit / startBalance) * 100 : 0),
    [realizedProfit, startBalance],
  );
  const profitOnlyMode = useMemo(
    () => realizedProfitPct >= (thresholdPct || 30),
    [realizedProfitPct, thresholdPct],
  );

  // Giveback lock from Checklist "Giveback Stop %"
  const givebackLockAmt = useMemo(
    () => (realizedProfit > 0 ? (givebackPct / 100) * realizedProfit : 0),
    [givebackPct, realizedProfit],
  );

  // Session guard = stricter of profit/4 and giveback lock (ignore giveback if 0%)
  const maxSessionLossGuard = useMemo(() => {
    const profitQuarter = realizedProfit / 4;
    const givebackGuard =
      givebackPct > 0 ? givebackLockAmt : Number.POSITIVE_INFINITY;
    return Math.min(profitQuarter, givebackGuard);
  }, [realizedProfit, givebackPct, givebackLockAmt]);

  // Effective cap = min(daily maxLoss, session guard)
  const effectiveLossCap = useMemo(() => {
    const dailyCap =
      maxLoss && maxLoss > 0 ? maxLoss : Number.POSITIVE_INFINITY;
    return Math.min(dailyCap, maxSessionLossGuard);
  }, [maxLoss, maxSessionLossGuard]);

  // Smart integrated planning risk guidance
  const planningMonthlyProgress = useMemo(() => {
    const now = new Date();
    return tradeRows
      .filter((t) => t.ts && isSameMonth(new Date(t.ts), now))
      .reduce((a, t) => a + (t.pnl || 0), 0);
  }, [tradeRows]);
  const remainingMonthlyTarget = useMemo(
    () => Math.max(0, monthlyCostTarget - planningMonthlyProgress),
    [monthlyCostTarget, planningMonthlyProgress],
  );
  const requiredDailyTarget = useMemo(
    () => remainingMonthlyTarget / Math.max(1, remainingTradingDaysThisMonth),
    [remainingMonthlyTarget, remainingTradingDaysThisMonth],
  );

  // Target risk answers: "what % should I risk per trade to reach my planned daily target?"
  const targetRiskAmountPerTrade = useMemo(() => {
    const tradesPerDay = Math.max(1, Number(plannedTradesPerDay) || 1);
    const rewardR = Math.max(0.1, Number(plannedRewardR) || 1);
    return requiredDailyTarget > 0 ? requiredDailyTarget / (tradesPerDay * rewardR) : 0;
  }, [requiredDailyTarget, plannedTradesPerDay, plannedRewardR]);

  const targetRiskPct = useMemo(
    () => (equity > 0 ? (targetRiskAmountPerTrade / equity) * 100 : 0),
    [targetRiskAmountPerTrade, equity],
  );

  // Per-trade protection budget so 6 losses == giveback. This remains the safety ceiling.
  const sixLossBudget = useMemo(
    () => (givebackLockAmt > 0 ? givebackLockAmt / 6 : 0),
    [givebackLockAmt],
  );
  const givebackRiskPct = useMemo(
    () => (equity > 0 ? (sixLossBudget / equity) * 100 : 0),
    [sixLossBudget, equity],
  );

  // Final smart recommendation integrates Planning Page + giveback safety.
  // If profit-only/giveback is active, UST will not recommend more than the giveback-safe risk.
  const recommendedRiskPct = useMemo(() => {
    const target = Number.isFinite(targetRiskPct) ? Math.max(0, targetRiskPct) : 0;
    const safety = Number.isFinite(givebackRiskPct) ? Math.max(0, givebackRiskPct) : 0;
    if (target > 0 && safety > 0) return Math.min(target, safety);
    if (target > 0) return target;
    return safety;
  }, [targetRiskPct, givebackRiskPct]);

  const smartRiskAmount = useMemo(
    () => (equity * recommendedRiskPct) / 100,
    [equity, recommendedRiskPct],
  );

  const riskAmount = useMemo(() => (equity * riskPct) / 100, [equity, riskPct]);
  const allTimeGrowthPct = startBalance
    ? (totalTradePnlAllTime / startBalance) * 100
    : 0;

  const sessionTrades = useMemo(
    () =>
      tradeRows.filter((t) => !sessionId || (t.ts || 0) >= Number(sessionId)),
    [tradeRows, sessionId],
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
    [lockOnHit, maxLoss, locked, profitOnlyMode, riskPct, recommendedRiskPct],
  );

  // PnL for the current session trades
  const pnl = useMemo(
    () => sessionTrades.reduce((a, t) => a + (t.pnl || 0), 0),
    [sessionTrades],
  );

  const disciplineScore = useMemo(
    () =>
      computeDisciplineScore({
        startBalance,
        equity,
        pnl: totalTradePnlAllTime,
        tradesCount: tradeRows.length,
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
      totalTradePnlAllTime,
      tradeRows.length,
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
    ],
  );
  // === Trading history view: dashboard + coach use all journal trades, not sessions ===
  const hasSessionActivity = useMemo(() => {
    return tradeRows.length > 0 || Math.abs(totalTradePnlAllTime) > 0.0000001;
  }, [tradeRows.length, totalTradePnlAllTime]);
  const closed = tradeRows.length;
  const wins = tradeRows.filter((t) => (t.pnl || 0) > 0).length;
  const losses = tradeRows.filter((t) => (t.pnl || 0) < 0).length;
  const bes = tradeRows.filter((t) => (t.pnl || 0) === 0).length;
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
    [tradeRows, todayKey],
  );

  // Performance Summary should use ALL journal trades, not only today's/session trades.
  const performanceSummary = useMemo(() => {
    const dailyPnls = new Map<string, number>();
    let grossProfit = 0;
    let grossLoss = 0;

    for (const t of tradeRows) {
      const value = Number(t.pnl || 0);
      if (value > 0) grossProfit += value;
      if (value < 0) grossLoss += Math.abs(value);

      const key = t.ts ? ymdLocal(new Date(t.ts)) : "Unknown";
      dailyPnls.set(key, (dailyPnls.get(key) || 0) + value);
    }

    const days = Array.from(dailyPnls.values());
    const bestDay = days.length ? Math.max(...days) : 0;
    const worstDay = days.length ? Math.min(...days) : 0;
    const averageDailyPnl = days.length
      ? days.reduce((sum, value) => sum + value, 0) / days.length
      : 0;
    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? grossProfit
          : 0;

    return { bestDay, worstDay, averageDailyPnl, profitFactor };
  }, [tradeRows]);

  // Lock when max-loss hit
  useEffect(() => {
    if (!lockOnHit || maxLoss <= 0) return;
    if (todayTradePnl <= -Math.abs(maxLoss) && !locked) {
      setLocked(true);
      push({
        title: "Trading locked for today",
        desc: `Daily max loss (${currency(maxLoss)}) reached.`,
      });
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
    () =>
      tradeRows
        .filter((t) => t.ts && isSameISOWeek(new Date(t.ts), today))
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [tradeRows, today],
  );
  const monthlyProgress = useMemo(
    () =>
      tradeRows
        .filter((t) => t.ts && isSameMonth(new Date(t.ts), today))
        .reduce((a, t) => a + (t.pnl || 0), 0),
    [tradeRows, today],
  );

  const recentDashboardTrades = useMemo(
    () =>
      [...tradeRows]
        .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
        .slice(0, 5),
    [tradeRows],
  );

  // Badge progress now uses total journal trades, not sessions.
  // Withdrawals are excluded because tradeRows only contains real trades.
  const badgeTradeCount = useMemo(() => tradeRows.length, [tradeRows]);

  const [badge, setBadge] = useState<{
    name: string;
    imagePath: string;
  } | null>(null);
  useEffect(() => {
    const s = badgeTradeCount;
    if (s >= 200)
      setBadge({
        name: "Legendary • 200 Trades Proven",
        imagePath: "/badges/legendary.png",
      });
    else if (s >= 150)
      setBadge({
        name: "Elite • 150 Trades Mastered",
        imagePath: "/badges/elite.png",
      });
    else if (s >= 100)
      setBadge({
        name: "Diamond • 100 Trades Certified",
        imagePath: "/badges/diamond.png",
      });
    else if (s >= 75)
      setBadge({
        name: "Platinum • 75 Trades Disciplined",
        imagePath: "/badges/platinum.png",
      });
    else if (s >= 50)
      setBadge({
        name: "Gold • 50 Trades Consistent",
        imagePath: "/badges/gold.png",
      });
    else if (s >= 25)
      setBadge({
        name: "Silver • 25 Trades Survived",
        imagePath: "/badges/silver.png",
      });
    else setBadge(null);
  }, [badgeTradeCount]);

  const equitySeries = useMemo(() => {
    // Dashboard curve = trading progress curve. Cash movements are excluded so withdrawals
    // do not punish the visual performance path. True account equity is still shown in cards.
    const sorted = [...tradeRows].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const pts: { t: string; equity: number }[] = [];
    let running = startBalance;
    if (sorted.length)
      pts.push({
        t: new Date(sorted[0].ts || Date.now()).toLocaleTimeString(),
        equity: running,
      });
    sorted.forEach((tr) => {
      running += tr.pnl || 0;
      pts.push({
        t: new Date(tr.ts || Date.now()).toLocaleTimeString(),
        equity: Number(running.toFixed(2)),
      });
    });
    if (!pts.length) pts.push({ t: "Start", equity: startBalance });
    return pts;
  }, [tradeRows, startBalance]);

  /* Trades helpers */
  function addTrade(
    t: Omit<TradeRow, "id" | "ts"> & Partial<Pick<TradeRow, "source">>,
  ) {
    if (locked && lockOnHit) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const row: TradeRow = {
      id,
      ts: Date.now(),
      kind: (t.kind ?? "trade") as "trade" | "withdrawal" | "deposit",
      // default to manual if not provided
      source: t.source ?? "manual",
      ...t,
    };

    setTrades((prev) => [row, ...prev]);
  }

  function addTradesBulk(rows: TradeRow[]) {
    if (!rows.length) return;

    setTrades((prev) => {
      const existingKeys = new Set(prev.map(tradeUniqueKey));
      const accepted: TradeRow[] = [];
      let blocked = 0;

      for (const r of rows) {
        const row = {
          ...r,
          kind: (r.kind ?? "trade") as "trade" | "withdrawal" | "deposit",
          source: r.source ?? "auto",
        };
        const key = tradeUniqueKey(row);
        if (existingKeys.has(key)) {
          blocked++;
          continue;
        }
        existingKeys.add(key);
        accepted.push(row);
      }

      if (blocked > 0) {
        try {
          localStorage.setItem(
            "ust:lastDuplicateBlocked",
            JSON.stringify(blocked),
          );
        } catch {}
      }

      return accepted.length ? [...accepted, ...prev] : prev;
    });
  }

  function removeDuplicateTrades() {
    const result = dedupeTrades(trades);
    if (result.removed > 0) {
      setTrades(result.unique);
    }

    try {
      localStorage.setItem(
        "ust:lastDuplicateBlocked",
        JSON.stringify(result.removed),
      );
    } catch {}

    push({
      title: result.removed ? "Duplicates removed" : "No duplicates found",
      desc: result.removed
        ? `${result.removed} duplicate trade${result.removed === 1 ? "" : "s"} removed from the journal.`
        : "Your journal is already clean.",
    });
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
    <div className="mx-auto max-w-7xl space-y-3 px-3 pb-24 pt-3 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="rounded-3xl border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_35%),rgba(2,6,23,0.86)] p-3 shadow-xl shadow-black/25 backdrop-blur md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        {/* Desktop: full premium header restored */}
        <div className="hidden items-center justify-between gap-4 md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/ust-logo.png"
              alt="Ultimate Scalper Tool"
              className="h-10 w-auto shrink-0 select-none lg:h-12"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-black tracking-tight bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)] [text-shadow:0_0_18px_rgba(212,175,55,0.25)] lg:text-3xl">
                  Ultimate Scalper Tool
                </h1>
                <span className="text-xl font-semibold text-slate-100 lg:text-2xl">
                  Strategy Console
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                    locked && lockOnHit
                      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${locked && lockOnHit ? "bg-rose-500" : "bg-emerald-500"}`}
                  />
                  {locked && lockOnHit ? "Locked" : "Active"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <DashboardSyncButton addTradesBulkFn={addTradesBulk} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("battle")}
              className="rounded-xl border-slate-700/80 bg-slate-950/50 px-4 py-2 text-sm font-bold text-slate-100 hover:border-[#D4AF37]/70 hover:bg-slate-900"
            >
              <BarChart3 className="mr-2 h-4 w-4 text-[#F6C945]" />
              Leaderboards
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => { await supabase.auth.signOut(); }}
              className="rounded-xl border-[#D4AF37]/50 bg-slate-950/50 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-[#D4AF37] hover:text-black"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Mobile: compact command header so the Trading Command Centre appears immediately */}
        <div className="space-y-2 md:hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
            <img
              src="/ust-logo.png"
              alt="Ultimate Scalper Tool"
              className="h-7 w-auto shrink-0 select-none"
            />
            <h1 className="min-w-0 whitespace-nowrap text-[15px] font-extrabold leading-tight tracking-tight bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)] [text-shadow:0_0_14px_rgba(212,175,55,0.3)]">
              UST Strategy Console
            </h1>
            <div className="scale-80 origin-center">
              <ThemeToggle />
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                locked && lockOnHit
                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
              title={
                locked && lockOnHit
                  ? "Trading locked for today (max loss hit)"
                  : "Active"
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${locked && lockOnHit ? "bg-rose-500" : "bg-emerald-500"}`}
              />
              {locked && lockOnHit ? "Locked" : "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Primary navigation — compact mock-style desktop + mobile */}
        <div className="mb-4 hidden space-y-3 md:block">
          {/* Desktop: clean compact two-line nav, no stretched empty buttons */}
          <div className="space-y-3">
            <TabsList className="flex h-auto w-full flex-wrap items-center gap-2 bg-transparent p-0">
              <TabsTrigger
                value="dashboard"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-bold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <Home className="mr-2 h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Analytics
              </TabsTrigger>
              <TabsTrigger
                value="battle"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <Target className="mr-2 h-4 w-4" /> Battle Board
              </TabsTrigger>
              <TabsTrigger
                value="risk-deriv"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <Calculator className="mr-2 h-4 w-4" /> Risk Calculator
              </TabsTrigger>
              <TabsTrigger
                value="journal"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <BookOpen className="mr-2 h-4 w-4" /> Trade Journal
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <CalendarDays className="mr-2 h-4 w-4" /> Calendar
              </TabsTrigger>
              <TabsTrigger
                value="asetups"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <Target className="mr-2 h-4 w-4" /> Planning
              </TabsTrigger>
              <TabsTrigger
                value="checklist"
                className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm font-semibold data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              >
                <ClipboardCheck className="mr-2 h-4 w-4" /> Checklist
              </TabsTrigger>
            </TabsList>
          </div>
          {/* Mobile navigation moved into the compact Menu above so the dashboard starts higher. */}
        </div>

        {/* UST MARKETS BATTLE BOARD */}
        <TabsContent value="battle" className="space-y-4">
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.16),transparent_32%),linear-gradient(135deg,#050814_0%,#0B1220_55%,#111827_100%)] p-4 shadow-2xl shadow-black/25 md:p-5">
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#F6C945]">
                  Overall Performance{" "}
                  <span className="text-slate-400">
                    (Across {battleOverallSummary.marketCount} Markets)
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Combined Battle Board performance from the live markets
                  currently being compared.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Period: {battlePeriodStart || "Start"} →{" "}
                {battlePeriodEnd || "Today"}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-700/80 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Total Net PnL
                </div>
                <div
                  className={`mt-2 text-2xl font-black ${battleOverallSummary.totalProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {currency(battleOverallSummary.totalProfit)}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full w-3/4 rounded-full bg-emerald-400/80" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Total Trades
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {battleOverallSummary.totalTrades}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full w-2/3 rounded-full bg-sky-400/80" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Win Rate
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300">
                  {fmt(battleOverallSummary.weightedWinRate)}%
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-400/80"
                    style={{
                      width: `${Math.min(100, Math.max(0, battleOverallSummary.weightedWinRate))}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Profit Factor
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {fmt(battleOverallSummary.avgProfitFactor)}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full w-3/5 rounded-full bg-[#D4AF37]/90" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Best Market
                </div>
                <div className="mt-2 text-xl font-black text-[#F6C945]">
                  {battleOverallSummary.bestMarket?.market || "—"}
                </div>
                <div
                  className={`mt-1 text-sm font-black ${Number(battleOverallSummary.bestMarket?.profit || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {battleOverallSummary.bestMarket
                    ? currency(battleOverallSummary.bestMarket.profit)
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_440px]">
            <div className="overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.20),transparent_32%),linear-gradient(135deg,#050814_0%,#0B1220_55%,#111827_100%)] p-4 shadow-2xl shadow-black/30 md:p-6">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#F6C945]">
                UST Research Lab
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">
                Markets Battle Board
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Five live markets. One race to 100 trades. The goal is not hype
                — it is survival, discipline, drawdown control and repeatable
                performance.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {battleRows.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void loadBattleTradeExplorer(m.id)}
                    className={`group rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[#D4AF37]/70 ${battleExplorerMarketId === m.id ? "border-[#D4AF37] bg-[#D4AF37]/12" : "border-slate-700/80 bg-black/25"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#D4AF37]/25 bg-slate-950/80 text-xs font-black text-[#F6C945]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {m.market}
                        </div>
                        <div
                          className={`mt-1 text-sm font-black ${m.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                        >
                          {currency(m.profit)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-sm text-sky-100">
                Performance is based on closed trades only. Market buttons
                update automatically from the Battle Board markets you configure
                below.
              </div>
            </div>

            <div className="rounded-3xl border border-[#D4AF37]/30 bg-black/30 p-5 text-sm text-slate-300 shadow-2xl shadow-black/25">
              <div className="font-black uppercase tracking-wide text-[#F6C945]">
                Weekly Published Board
              </div>
              <div className="mt-3 text-sm leading-6">
                Only the admin account can publish updates. Everyone else can
                view the same board.
              </div>
              <div className="mt-5 text-sm text-slate-400">
                Period: {battlePeriodStart || "Start"} →{" "}
                {battlePeriodEnd || "Today"}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Last update: {battleUpdatedAt || "Not published yet"}
              </div>
              <div className="mt-6 grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadBattleBoard()}
                  disabled={battleLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh Board
                </Button>
                <Button
                  type="button"
                  className="w-full bg-[#D4AF37] font-black text-black hover:bg-[#c9a42f]"
                  onClick={exportBattleBoardPdf}
                >
                  <FileText className="mr-2 h-4 w-4" /> Export PDF Report
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-4 shadow-xl shadow-black/25 md:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.30em] text-[#F6C945]">
                  100 Trade Survival Race
                </p>
                <h3 className="mt-1 text-2xl font-black text-white">
                  Which market can survive the full race?
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Markets are ranked mainly by completed trades, then profit.
                  Drawdown, profit factor and win rate are used as supporting
                  quality checks.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs md:min-w-[360px]">
                <div className="rounded-2xl border border-slate-700 bg-black/25 p-3">
                  <div className="text-slate-500">Leader</div>
                  <div className="mt-1 font-black text-[#F6C945]">
                    {battleSurvivalSummary.leader?.market || "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-black/25 p-3">
                  <div className="text-slate-500">Avg Progress</div>
                  <div className="mt-1 font-black text-white">
                    {fmt(battleSurvivalSummary.avgProgress)}%
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-black/25 p-3">
                  <div className="text-slate-500">Risk Flags</div>
                  <div className="mt-1 font-black text-amber-300">
                    {battleSurvivalSummary.risk}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              {battleSurvivalRaceRows.map((m) => {
                const statusStyle =
                  m.raceStatus === "Front Runner" ||
                  m.raceStatus === "Certified"
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300"
                    : m.raceStatus === "Survival Risk"
                      ? "border-rose-400/35 bg-rose-500/10 text-rose-300"
                      : m.raceStatus === "Evidence Building"
                        ? "border-sky-400/35 bg-sky-500/10 text-sky-300"
                        : "border-amber-400/35 bg-amber-500/10 text-amber-300";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void loadBattleTradeExplorer(m.id)}
                    className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${battleExplorerMarketId === m.id ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-slate-800 bg-black/25"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4AF37]/30 bg-slate-950 text-sm font-black text-[#F6C945]">
                          #{m.raceRank}
                        </span>
                        <div>
                          <div className="font-black text-white">
                            {m.market}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {m.trades}/{m.targetTrades} trades • {m.remaining}{" "}
                            left
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                            {m.evidenceLevel}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm font-black text-white">
                        {m.survivalScore}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[#D4AF37]"
                        style={{
                          width: `${Math.min(100, Math.max(0, m.progress))}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusStyle}`}
                      >
                        {m.raceStatus}
                      </span>
                      <span
                        className={
                          m.profit >= 0
                            ? "text-xs font-black text-emerald-300"
                            : "text-xs font-black text-rose-300"
                        }
                      >
                        {currency(m.profit)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
            <div className="rounded-3xl border border-sky-400/25 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-4 shadow-xl shadow-black/25 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.30em] text-sky-300">
                    Public Transparency Portal
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Investor-facing proof page preview
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    A clean public layer showing what matters: progress, risk
                    disclosure, consistency and certification status.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-5 py-4 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Public Score
                  </div>
                  <div className="mt-1 text-3xl font-black text-[#F6C945]">
                    {battleTransparencyPortal.publicScore}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">
                    {battleTransparencyPortal.mode}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-black/25 p-3">
                  <div className="text-xs text-slate-500">Race Progress</div>
                  <div className="mt-1 text-xl font-black text-white">
                    {fmt(battleTransparencyPortal.progressPct)}%
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-black/25 p-3">
                  <div className="text-xs text-slate-500">Positive Markets</div>
                  <div className="mt-1 text-xl font-black text-emerald-300">
                    {battleTransparencyPortal.profitable}/
                    {battleTransparencyPortal.markets}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-black/25 p-3">
                  <div className="text-xs text-slate-500">Avg DD</div>
                  <div className="mt-1 text-xl font-black text-amber-300">
                    {fmt(battleTransparencyPortal.avgDd)}%
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {battleTransparencyPortal.checklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-black/20 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full border text-xs font-black ${item.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-amber-400/40 bg-amber-500/10 text-amber-300"}`}
                      >
                        {item.ok ? "✓" : "!"}
                      </span>
                      <span className="font-bold text-slate-200">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-4 shadow-xl shadow-black/25 md:p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.30em] text-[#F6C945]">
                    UST Certification System
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Markets must earn certification
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Certification is not based on hype. A market must survive
                    100 trades, stay profitable and remain inside the drawdown
                    rules.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-center text-xs">
                  <div className="text-slate-400">Certified</div>
                  <div className="mt-1 text-2xl font-black text-emerald-300">
                    {
                      battleCertificationRows.filter(
                        (r) => r.certificationLevel === "UST Certified",
                      ).length
                    }
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {battleCertificationRows.slice(0, 6).map((m) => {
                  const levelStyle =
                    m.certificationLevel === "UST Certified"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                      : m.certificationLevel === "Gold Candidate"
                        ? "border-[#D4AF37]/45 bg-[#D4AF37]/10 text-[#F6C945]"
                        : m.certificationLevel === "Silver Candidate"
                          ? "border-slate-300/30 bg-slate-300/10 text-slate-200"
                          : m.certificationLevel === "Bronze Candidate"
                            ? "border-amber-700/40 bg-amber-700/10 text-amber-300"
                            : "border-sky-400/35 bg-sky-500/10 text-sky-300";
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-slate-800 bg-black/25 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-white">
                            {m.market}
                          </div>
                          <div
                            className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${levelStyle}`}
                          >
                            {m.certificationLevel}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Score</div>
                          <div className="text-xl font-black text-white">
                            {m.certificationScore}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#D4AF37]"
                          style={{
                            width: `${Math.min(100, Math.max(0, m.certificationScore))}%`,
                          }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                        {m.requirements.map((req) => (
                          <div
                            key={req.label}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-1.5"
                          >
                            <span
                              className={
                                req.ok
                                  ? "font-bold text-emerald-300"
                                  : "font-bold text-slate-400"
                              }
                            >
                              {req.ok ? "✓" : "○"} {req.label}
                            </span>
                            <span className="text-slate-300">{req.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {battleError && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              {battleError}
            </div>
          )}

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-black/20">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">
                  Detailed Market Stats
                </h3>
                <p className="text-sm text-slate-400">
                  Use this section for weekly research reports and public
                  transparency.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportBattleBoardPdf}
                >
                  <FileText className="mr-2 h-4 w-4" /> Export PDF
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    onClick={() => void publishBattleBoard()}
                    disabled={battleSaving}
                  >
                    {battleSaving ? "Publishing..." : "Publish Battle Board"}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:hidden">
              {battleRankedRows.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-800 bg-black/25 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-black text-white">
                        {m.market}
                      </div>
                      <div className="text-xs text-slate-400">
                        {m.trades}/{m.targetTrades} trades • Health{" "}
                        {m.discipline}/100
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-bold ${BATTLE_STATUS_STYLES[m.status] || BATTLE_STATUS_STYLES.Stable}`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-900/70 p-2">
                      <div className="text-slate-400">Profit</div>
                      <div
                        className={`text-sm font-black ${m.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {currency(m.profit)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 p-2">
                      <div className="text-slate-400">Win %</div>
                      <div className="text-sm font-black text-white">
                        {fmt(m.winRate)}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 p-2">
                      <div className="text-slate-400">PF / Avg R</div>
                      <div className="text-sm font-black text-white">
                        {fmt(m.profitFactor)} / {fmt(m.avgR)}R
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 p-2">
                      <div className="text-slate-400">Drawdown</div>
                      <div className="text-sm font-black text-amber-300">
                        {fmt(m.maxDd)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Market</th>
                    <th className="px-3 py-3">Trades</th>
                    <th className="px-3 py-3">Profit</th>
                    <th className="px-3 py-3">Win %</th>
                    <th className="px-3 py-3">Avg R</th>
                    <th className="px-3 py-3">PF</th>
                    <th className="px-3 py-3">DD %</th>
                    <th className="px-3 py-3">Health</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {battleRankedRows.map((m) => (
                    <tr key={m.id} className="text-slate-200">
                      <td className="px-3 py-3 font-bold text-white">
                        {m.market}
                      </td>
                      <td className="px-3 py-3">
                        {m.trades}/{m.targetTrades}
                      </td>
                      <td
                        className={`px-3 py-3 font-bold ${m.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {currency(m.profit)}
                      </td>
                      <td className="px-3 py-3">{fmt(m.winRate)}%</td>
                      <td className="px-3 py-3">{fmt(m.avgR)}R</td>
                      <td className="px-3 py-3">{fmt(m.profitFactor)}</td>
                      <td className="px-3 py-3 text-amber-300">
                        {fmt(m.maxDd)}%
                      </td>
                      <td className="px-3 py-3">{m.discipline}/100</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-bold ${BATTLE_STATUS_STYLES[m.status] || BATTLE_STATUS_STYLES.Stable}`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-sky-400/25 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] p-5 shadow-xl shadow-black/25">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-sky-200">
                    UST Strategy Intelligence
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    AI interpretation based on current market statistics
                  </div>
                </div>
                <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-200">
                  LIVE ANALYSIS
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {battleAiInsightLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-700/70 bg-black/25 p-4 text-sm leading-6 text-slate-200"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wide text-sky-200">
                        {battleRows.length < 15
                          ? "INSUFFICIENT DATA"
                          : "AI COMMENTARY"}
                      </span>
                    </div>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#D4AF37]/30 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] p-5 shadow-xl shadow-black/25">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-[#F6C945]">
                AI Status Board
              </div>
              <div className="mt-1 text-sm text-slate-400">
                System-generated strategic status
              </div>

              <div className="mt-5 space-y-3">
                {battleRankedRows.slice(0, 5).map((m) => {
                  const insufficient = Number(m.trades || 0) < 15;
                  const status = insufficient
                    ? "INSUFFICIENT DATA"
                    : Number(m.profitFactor || 0) >= 1.8
                      ? "ACTIVE"
                      : Number(m.profitFactor || 0) >= 1.2
                        ? "WATCHLIST"
                        : "RESTRICTED";
                  const statusStyle = insufficient
                    ? "border-slate-500/30 bg-slate-500/10 text-slate-200"
                    : status === "ACTIVE"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : status === "WATCHLIST"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300";

                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-slate-800 bg-black/25 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-black text-white">
                            {m.market}
                          </div>
                          <div className="text-xs text-slate-400">
                            PF {fmt(m.profitFactor)} • WR {fmt(m.winRate)}%
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusStyle}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-3 shadow-xl shadow-black/20 md:p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">
                  Trade Explorer
                </h3>
                <p className="text-sm text-slate-400">
                  Open the trades behind each market, then analyse setup grades
                  and sessions.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {battleRows.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    onClick={() => void loadBattleTradeExplorer(m.id)}
                    className={`transition-all duration-300 font-bold border rounded-xl px-4 py-2
    ${
      battleExplorerMarketId === m.id
        ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.55)] scale-105"
        : "bg-[#081225] text-white border-slate-700 hover:border-yellow-400/70 hover:text-yellow-300"
    }`}
                  >
                    {m.market}
                  </Button>
                ))}
              </div>
            </div>

            {battleExplorerError && (
              <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                {battleExplorerError}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                <div className="mb-2 text-sm font-black uppercase tracking-wide text-[#F6C945]">
                  Setup Grade Analytics
                </div>
                <div className="grid gap-2 md:hidden">
                  {(battleGradeStats.length
                    ? battleGradeStats
                    : [
                        {
                          label: "No data",
                          trades: 0,
                          profit: 0,
                          winRate: 0,
                          profitFactor: 0,
                          avgR: 0,
                        },
                      ]
                  ).map((g) => (
                    <div
                      key={g.label}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-black text-white">{g.label}</div>
                        <div
                          className={
                            g.profit >= 0
                              ? "font-black text-emerald-300"
                              : "font-black text-rose-300"
                          }
                        >
                          {currency(g.profit)}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <div className="text-slate-500">Trades</div>
                          <div className="font-bold text-sky-100">
                            {g.trades}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Win</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.winRate)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">PF</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.profitFactor)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Avg R</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.avgR)}R
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Grade</th>
                        <th className="px-3 py-2 text-left">Trades</th>
                        <th className="px-3 py-2 text-left">Profit</th>
                        <th className="px-3 py-2 text-left">Win %</th>
                        <th className="px-3 py-2 text-left">PF</th>
                        <th className="px-3 py-2 text-left">Avg R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(battleGradeStats.length
                        ? battleGradeStats
                        : [
                            {
                              label: "No data",
                              trades: 0,
                              profit: 0,
                              winRate: 0,
                              profitFactor: 0,
                              avgR: 0,
                            },
                          ]
                      ).map((g) => (
                        <tr key={g.label} className="border-t border-slate-800">
                          <td className="px-3 py-2 font-black text-white">
                            {g.label}
                          </td>
                          <td className="px-3 py-2 text-sky-100">{g.trades}</td>
                          <td
                            className={
                              g.profit >= 0
                                ? "px-3 py-2 font-bold text-emerald-300"
                                : "px-3 py-2 font-bold text-rose-300"
                            }
                          >
                            {currency(g.profit)}
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.winRate)}%
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.profitFactor)}
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.avgR)}R
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                <div className="mb-2 text-sm font-black uppercase tracking-wide text-[#F6C945]">
                  Session Intelligence{" "}
                  <span className="text-slate-400">(SAST)</span>
                </div>
                <div className="grid gap-2 md:hidden">
                  {(battleSessionStats.length
                    ? battleSessionStats
                    : [
                        {
                          label: "No data",
                          trades: 0,
                          profit: 0,
                          winRate: 0,
                          profitFactor: 0,
                          avgR: 0,
                        },
                      ]
                  ).map((g) => (
                    <div
                      key={g.label}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-black text-white">{g.label}</div>
                        <div
                          className={
                            g.profit >= 0
                              ? "font-black text-emerald-300"
                              : "font-black text-rose-300"
                          }
                        >
                          {currency(g.profit)}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <div className="text-slate-500">Trades</div>
                          <div className="font-bold text-sky-100">
                            {g.trades}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Win</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.winRate)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">PF</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.profitFactor)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Avg R</div>
                          <div className="font-bold text-sky-100">
                            {fmt(g.avgR)}R
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Session</th>
                        <th className="px-3 py-2 text-left">Trades</th>
                        <th className="px-3 py-2 text-left">Profit</th>
                        <th className="px-3 py-2 text-left">Win %</th>
                        <th className="px-3 py-2 text-left">PF</th>
                        <th className="px-3 py-2 text-left">Avg R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(battleSessionStats.length
                        ? battleSessionStats
                        : [
                            {
                              label: "No data",
                              trades: 0,
                              profit: 0,
                              winRate: 0,
                              profitFactor: 0,
                              avgR: 0,
                            },
                          ]
                      ).map((g) => (
                        <tr key={g.label} className="border-t border-slate-800">
                          <td className="px-3 py-2 font-black text-white">
                            {g.label}
                          </td>
                          <td className="px-3 py-2 text-sky-100">{g.trades}</td>
                          <td
                            className={
                              g.profit >= 0
                                ? "px-3 py-2 font-bold text-emerald-300"
                                : "px-3 py-2 font-bold text-rose-300"
                            }
                          >
                            {currency(g.profit)}
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.winRate)}%
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.profitFactor)}
                          </td>
                          <td className="px-3 py-2 text-sky-100">
                            {fmt(g.avgR)}R
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] p-4">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-[#F6C945]">
                    Session Heatmap{" "}
                    <span className="text-slate-400">
                      • {battleSelectedMarket?.market || "Selected Market"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Day-by-session performance map. Green cells show where the
                    selected market is currently paying best.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-300">
                    Best:{" "}
                    {battleSessionHeatmap.best
                      ? `${battleSessionHeatmap.best.day} ${battleSessionHeatmap.best.session} ${currency(battleSessionHeatmap.best.profit)}`
                      : "Pending"}
                  </span>
                  <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 font-bold text-rose-300">
                    Weak:{" "}
                    {battleSessionHeatmap.worst
                      ? `${battleSessionHeatmap.worst.day} ${battleSessionHeatmap.worst.session} ${currency(battleSessionHeatmap.worst.profit)}`
                      : "Pending"}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[110px_repeat(5,minmax(110px,1fr))] gap-2 text-xs">
                    <div className="rounded-xl border border-slate-800 bg-black/25 p-2 font-black text-slate-400">
                      Session
                    </div>
                    {battleSessionHeatmap.days.map((day) => (
                      <div
                        key={day}
                        className="rounded-xl border border-slate-800 bg-black/25 p-2 text-center font-black text-slate-300"
                      >
                        {day}
                      </div>
                    ))}
                    {battleSessionHeatmap.sessions.map((session) => (
                      <React.Fragment key={session}>
                        <div className="rounded-xl border border-slate-800 bg-black/25 p-3 font-black text-white">
                          {session}
                        </div>
                        {battleSessionHeatmap.days.map((day) => {
                          const cell =
                            battleSessionHeatmap.cells[`${day}-${session}`];
                          const tone = !cell?.trades
                            ? "border-slate-800 bg-slate-950/80 text-slate-500"
                            : cell.profit > 0
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                              : cell.profit < 0
                                ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                                : "border-slate-700 bg-slate-800/70 text-slate-200";
                          return (
                            <div
                              key={`${day}-${session}`}
                              className={`rounded-xl border p-2 ${tone}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black">
                                  {cell?.trades ? currency(cell.profit) : "—"}
                                </span>
                                <span className="text-[10px] opacity-80">
                                  {cell?.trades || 0}T
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] opacity-80">
                                WR{" "}
                                {cell?.trades
                                  ? fmt((cell.wins / cell.trades) * 100)
                                  : "0.00"}
                                % • {fmt(cell?.avgR || 0)}R
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 ${battleCoachSummary.tone}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.28em] text-[#F6C945]">
                    AI Coach Summary
                  </div>
                  <h4 className="mt-1 text-xl font-black text-white">
                    {battleCoachSummary.title}
                  </h4>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-200">
                    {battleCoachSummary.summary}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-200 md:max-w-[360px]">
                  <span className="font-black text-[#F6C945]">
                    Coach Action:
                  </span>{" "}
                  {battleCoachSummary.action}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {battleCoachSummary.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-slate-100"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-black uppercase tracking-wide text-[#F6C945]">
                  Recent Closed Trades
                </div>
                {battleExplorerLoading && (
                  <div className="text-xs text-slate-400">
                    Loading trades...
                  </div>
                )}
              </div>
              <div className="max-h-[420px] overflow-auto">
                <div className="grid gap-2 md:hidden">
                  {battleExplorerTrades.length
                    ? battleExplorerTrades.slice(0, 60).map((t) => (
                        <div
                          key={t.id}
                          className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-black text-white">
                                {t.symbol} • {t.side}
                              </div>
                              <div className="text-slate-400">
                                {t.timestamp
                                  ? new Date(t.timestamp).toLocaleString()
                                  : "-"}
                              </div>
                            </div>
                            <div
                              className={
                                t.pnl >= 0
                                  ? "text-right font-black text-emerald-300"
                                  : "text-right font-black text-rose-300"
                              }
                            >
                              {currency(t.pnl)}
                              <div>{fmt(t.r)}R</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-sky-100">
                              {t.session}
                            </span>
                            <span className="rounded-full bg-[#D4AF37]/15 px-2 py-1 font-bold text-[#F6C945]">
                              {t.setupGrade}
                            </span>
                            <span
                              className={
                                t.result === "Win"
                                  ? "rounded-full bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300"
                                  : t.result === "Loss"
                                    ? "rounded-full bg-rose-500/10 px-2 py-1 font-bold text-rose-300"
                                    : "rounded-full bg-slate-800 px-2 py-1 font-bold text-slate-300"
                              }
                            >
                              {t.result}
                            </span>
                          </div>
                          {t.comment && (
                            <div className="mt-2 line-clamp-2 text-slate-400">
                              {t.comment}
                            </div>
                          )}
                        </div>
                      ))
                    : !battleExplorerLoading && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
                          No closed trades loaded yet. Select a market above.
                        </div>
                      )}
                </div>
                <table className="hidden w-full min-w-[860px] text-sm md:table">
                  <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Time</th>
                      <th className="px-3 py-2 text-left">Session</th>
                      <th className="px-3 py-2 text-left">Grade</th>
                      <th className="px-3 py-2 text-left">Side</th>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-left">Result</th>
                      <th className="px-3 py-2 text-left">Profit</th>
                      <th className="px-3 py-2 text-left">R</th>
                      <th className="px-3 py-2 text-left">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(battleExplorerTrades.length
                      ? battleExplorerTrades.slice(0, 150)
                      : []
                    ).map((t) => (
                      <tr key={t.id} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-slate-300">
                          {t.timestamp
                            ? new Date(t.timestamp).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-sky-100">{t.session}</td>
                        <td className="px-3 py-2 font-black text-[#F6C945]">
                          {t.setupGrade}
                        </td>
                        <td className="px-3 py-2 text-sky-100">{t.side}</td>
                        <td className="px-3 py-2 text-sky-100">{t.symbol}</td>
                        <td
                          className={
                            t.result === "Win"
                              ? "px-3 py-2 font-bold text-emerald-300"
                              : t.result === "Loss"
                                ? "px-3 py-2 font-bold text-rose-300"
                                : "px-3 py-2 font-bold text-slate-300"
                          }
                        >
                          {t.result}
                        </td>
                        <td
                          className={
                            t.pnl >= 0
                              ? "px-3 py-2 font-bold text-emerald-300"
                              : "px-3 py-2 font-bold text-rose-300"
                          }
                        >
                          {currency(t.pnl)}
                        </td>
                        <td
                          className={
                            t.r >= 0
                              ? "px-3 py-2 font-bold text-emerald-300"
                              : "px-3 py-2 font-bold text-rose-300"
                          }
                        >
                          {fmt(t.r)}R
                        </td>
                        <td
                          className="max-w-[260px] truncate px-3 py-2 text-slate-400"
                          title={t.comment}
                        >
                          {t.comment || "-"}
                        </td>
                      </tr>
                    ))}
                    {!battleExplorerTrades.length && !battleExplorerLoading && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-6 text-center text-slate-400"
                        >
                          No closed trades loaded yet. Select a market above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-3xl border border-[#D4AF37]/30 bg-slate-950 p-4 shadow-xl shadow-black/20">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Admin Auto Publisher
                  </h3>
                  <p className="text-sm text-slate-400">
                    Enter market display name, private MT5 account name/number,
                    starting capital and the date range. Click Calculate from
                    Sheet, then Publish.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void syncAllBattleMarkets()}
                    disabled={!!battleSyncing}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />{" "}
                    {battleSyncing
                      ? "Calculating..."
                      : "Calculate All from Sheet"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void publishBattleBoard()}
                    disabled={battleSaving || !!battleSyncing}
                  >
                    {battleSaving ? "Publishing..." : "Publish Battle Board"}
                  </Button>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100">
                Auto-derived stats: trades completed, profit for selected
                period, win rate, drawdown, profit factor, average R estimate,
                best runner estimate, market health score and market status. R
                estimates use 1% of starting capital as the risk unit. Private
                account names/numbers are used only for fetching data and are
                not shown on the public board.
              </div>

              <div className="mb-4 grid gap-3 rounded-2xl border border-[#D4AF37]/20 bg-black/20 p-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">
                    Battle Start Date
                  </Label>
                  <Input
                    type="date"
                    value={battlePeriodStart}
                    onChange={(e) => setBattlePeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">
                    Battle End Date
                  </Label>
                  <Input
                    type="date"
                    value={battlePeriodEnd}
                    onChange={(e) => setBattlePeriodEnd(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 text-xs text-slate-400">
                  Only trades closed inside this date range are used. Leave end
                  date blank to calculate from start date until today.
                </div>
              </div>

              <div className="grid gap-4">
                {battleDraftRows.map((m, i) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                  >
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="font-black text-[#F6C945]">
                        {m.market || "Market"}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void syncBattleMarket(i)}
                        disabled={!!battleSyncing}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />{" "}
                        {battleSyncing === m.id
                          ? "Calculating..."
                          : "Calculate from Sheet"}
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300">
                          Market Name
                        </Label>
                        <Input
                          value={m.market}
                          placeholder="Gold"
                          onChange={(e) =>
                            setBattleDraftRows((prev) =>
                              prev.map((r, idx) =>
                                idx === i
                                  ? { ...r, market: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300">
                          Private Account Name / Number
                        </Label>
                        <Input
                          value={m.account}
                          placeholder="Kuda_Gold or 123456"
                          onChange={(e) =>
                            setBattleDraftRows((prev) =>
                              prev.map((r, idx) =>
                                idx === i
                                  ? { ...r, account: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300">
                          Starting Capital
                        </Label>
                        <Input
                          type="number"
                          value={m.startingCapital}
                          placeholder="500"
                          onChange={(e) =>
                            setBattleDraftRows((prev) =>
                              prev.map((r, idx) =>
                                idx === i
                                  ? {
                                      ...r,
                                      startingCapital: Number(e.target.value),
                                    }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300">
                          Target Trades
                        </Label>
                        <Input
                          type="number"
                          value={m.targetTrades}
                          placeholder="100"
                          onChange={(e) =>
                            setBattleDraftRows((prev) =>
                              prev.map((r, idx) =>
                                idx === i
                                  ? {
                                      ...r,
                                      targetTrades: Number(e.target.value),
                                    }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">Trades</div>
                        <div className="font-black text-white">
                          {m.trades}/{m.targetTrades}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">Profit</div>
                        <div
                          className={
                            m.profit >= 0
                              ? "font-black text-emerald-300"
                              : "font-black text-rose-300"
                          }
                        >
                          {currency(m.profit)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">Win Rate</div>
                        <div className="font-black text-white">
                          {fmt(m.winRate)}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">Max DD</div>
                        <div className="font-black text-amber-300">
                          {fmt(m.maxDd)}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">PF</div>
                        <div className="font-black text-white">
                          {fmt(m.profitFactor)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-black/25 p-2">
                        <div className="text-slate-400">Status</div>
                        <div className="font-black text-[#F6C945]">
                          {m.status}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <Label className="text-xs text-slate-300">
                        Weekly Admin Notes
                      </Label>
                      <Input
                        value={m.notes}
                        onChange={(e) =>
                          setBattleDraftRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i ? { ...r, notes: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="Example: Gold is leading with cleaner NY session runners."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-3">
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.13),transparent_30%),linear-gradient(135deg,#050814_0%,#0B1220_55%,#101827_100%)] p-4 shadow-2xl shadow-black/25 md:p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-xs font-black uppercase tracking-[0.24em] text-[#F6C945] sm:tracking-[0.35em]">
                    Trading Command Centre
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMobileMenuOpen((v) => !v)}
                    className="h-8 shrink-0 rounded-xl border-slate-700/80 bg-slate-950/45 px-3 text-xs font-black text-slate-100 hover:border-[#D4AF37]/70 hover:bg-slate-900 md:hidden"
                  >
                    <MoreHorizontal className="mr-1.5 h-4 w-4 text-[#F6C945]" />
                    Menu
                  </Button>
                </div>
                <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight text-white md:text-3xl">
                  Dashboard Overview
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                <DashboardSyncButton addTradesBulkFn={addTradesBulk} />
                <div
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black shadow-lg ${locked && lockOnHit ? "border-rose-500/50 bg-rose-500/10 text-rose-300 shadow-rose-950/30" : "border-emerald-400/50 bg-emerald-500/10 text-emerald-300 shadow-emerald-950/30"}`}
                >
                  <Activity className="h-4 w-4" />
                  {locked && lockOnHit ? "Trading Locked" : "Trading Active"}
                </div>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-2 shadow-xl shadow-black/40 md:hidden">
                {[
                  { value: "dashboard", label: "Dashboard", icon: Home },
                  { value: "analytics", label: "Analytics", icon: BarChart3 },
                  { value: "battle", label: "Battle Board", icon: Target },
                  { value: "risk-deriv", label: "Risk Calculator", icon: Calculator },
                  { value: "journal", label: "Trade Journal", icon: BookOpen },
                  { value: "calendar", label: "Calendar", icon: CalendarDays },
                  { value: "asetups", label: "Planning", icon: Target },
                  { value: "checklist", label: "Checklist", icon: ClipboardCheck },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.value);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-black transition ${
                        active
                          ? "border-[#D4AF37] bg-[#D4AF37] text-black"
                          : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-[#D4AF37]/60"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-black" : "text-[#F6C945]"}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#D4AF37]/30 bg-black/25 p-3 sm:grid-cols-2 md:p-4 lg:grid-cols-5">
              <div className="col-span-2 rounded-2xl border border-emerald-400/30 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_45%),rgba(16,185,129,0.06)] p-4 shadow-lg shadow-emerald-950/20 lg:col-span-1 lg:border-r lg:border-slate-700/70 lg:bg-transparent lg:p-0 lg:pr-4 lg:shadow-none">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F6C945]">
                  Live Status
                </p>
                <div
                  className={`mt-2 flex items-center gap-2 text-[24px] font-black ${locked && lockOnHit ? "text-rose-300" : "text-emerald-300"}`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${locked && lockOnHit ? "bg-rose-400" : "bg-emerald-400"}`}
                  />
                  {locked && lockOnHit ? "Locked" : "Active"}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Last update: {new Date().toLocaleString()}
                </p>
              </div>
              <TopStatusMetric
                icon="wallet"
                label="Account Equity"
                value={currency(equity)}
              />
              <TopStatusMetric
                icon="trend"
                label="Today’s PnL"
                value={`${todayTradePnl >= 0 ? "+" : ""}${currency(Number(todayTradePnl.toFixed(2)))}`}
                tone={todayTradePnl >= 0 ? "positive" : "negative"}
              />
              <TopStatusMetric
                icon="growth"
                label="Weekly PnL"
                value={`${weeklyProgress >= 0 ? "+" : ""}${currency(Number(weeklyProgress.toFixed(2)))}`}
                tone={weeklyProgress >= 0 ? "positive" : "negative"}
              />
              <TopStatusMetric
                icon="activity"
                label="Monthly PnL"
                value={`${monthlyProgress >= 0 ? "+" : ""}${currency(Number(monthlyProgress.toFixed(2)))}`}
                tone={monthlyProgress >= 0 ? "positive" : "negative"}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
                  <DashCard
                    title="Account Growth"
                    value={`${allTimeGrowthPct >= 0 ? "+" : ""}${fmt(allTimeGrowthPct)}%`}
                    hint={`Trading PnL: ${currency(totalTradePnlAllTime)}`}
                    tone={allTimeGrowthPct >= 0 ? "positive" : "negative"}
                    featured
                    icon="growth"
                    spark="up"
                  />
                  <DashCard
                    title="Realised PnL"
                    value={currency(totalTradePnlAllTime)}
                    hint={`All journal trades: ${closed}`}
                    tone={
                      totalTradePnlAllTime > 0
                        ? "positive"
                        : totalTradePnlAllTime < 0
                          ? "negative"
                          : "blue"
                    }
                    featured
                    icon="trend"
                    spark="flat"
                  />
                  <DashCard
                    title="Overall Win Rate"
                    value={`${fmt(winRate)}%`}
                    hint={`${wins}W / ${losses}L / ${bes}BE`}
                    tone={
                      winRate >= 50
                        ? "purple"
                        : closed > 0
                          ? "warning"
                          : "purple"
                    }
                    featured
                    icon="pie"
                  />
                  <DashCard
                    title="Discipline Score"
                    value={`${disciplineScore}/100`}
                    hint={
                      currentRuleBadges.length
                        ? `${currentRuleBadges.length} rules active`
                        : "Checklist pending"
                    }
                    tone={
                      disciplineScore >= 80
                        ? "positive"
                        : disciplineScore >= 60
                          ? "gold"
                          : "negative"
                    }
                    featured
                    icon="shield"
                    progress={disciplineScore}
                  />
                </div>

                <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-lg font-black uppercase tracking-[0.22em] text-[#F6C945]">
                        Progress Curve{" "}
                        <span className="text-slate-500">(All Time)</span>
                      </h4>
                      <div className="flex rounded-xl border border-slate-700 bg-black/20 p-1 text-xs font-black text-slate-300">
                        <span className="rounded-lg px-3 py-1">7D</span>
                        <span className="rounded-lg bg-[#D4AF37] px-3 py-1 text-black">
                          30D
                        </span>
                        <span className="rounded-lg px-3 py-1">90D</span>
                        <span className="rounded-lg px-3 py-1">ALL</span>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={equitySeries}
                          margin={{ top: 8, right: 12, bottom: 20, left: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#1f2937"
                          />
                          <XAxis stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
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
                          <Line
                            type="monotone"
                            dataKey="equity"
                            stroke="#D4AF37"
                            dot={false}
                            strokeWidth={3}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black uppercase tracking-[0.24em] text-[#F6C945]">
                        Recent Activity
                      </h4>
                      <button
                        type="button"
                        onClick={() => setActiveTab("journal")}
                        className="text-xs font-bold text-sky-300 hover:text-sky-200"
                      >
                        View Journal →
                      </button>
                    </div>
                    <div className="space-y-3">
                      {recentDashboardTrades.length ? (
                        recentDashboardTrades.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-black/20 p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`grid h-8 w-8 place-items-center rounded-full border ${Number(t.pnl || 0) >= 0 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-rose-400/40 bg-rose-500/10 text-rose-300"}`}
                                >
                                  <TrendingUp className="h-4 w-4" />
                                </span>
                                <span className="truncate font-black text-white">
                                  {t.symbol || "Market"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t.ts
                                  ? new Date(t.ts).toLocaleString()
                                  : "Manual trade"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-sm font-black ${Number(t.pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                              >
                                {Number(t.pnl || 0) >= 0 ? "+" : ""}
                                {currency(Number(t.pnl || 0))}
                              </div>
                              <div className="text-xs text-slate-500">
                                {Number(t.pnl || 0) >= 0
                                  ? "Win"
                                  : Number(t.pnl || 0) < 0
                                    ? "Loss"
                                    : "BE"}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-slate-800 bg-black/20 p-4 text-sm text-slate-400">
                          No journal trades yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="rounded-2xl border border-[#D4AF37]/25 bg-black/25 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F6C945]">
                    Trading Command Centre
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F6C945]">
                      ⚡
                    </span>
                    <p className="text-sm leading-6 text-slate-300">
                      All systems operational. Stay disciplined. Trust the
                      process.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <SmartCoachPanel
                locked={locked}
                lockOnHit={lockOnHit}
                closed={closed}
                wins={wins}
                losses={losses}
                bes={bes}
                winRate={winRate}
                disciplineScore={disciplineScore}
                pnl={totalTradePnlAllTime}
                maxLoss={maxLoss}
                riskPct={riskPct}
                recommendedRiskPct={recommendedRiskPct}
                ruleBadges={currentRuleBadges}
                sessionTarget={sessionTarget}
                setupsToday={setupsToday}
              />
            </div>
          </div>

          <SectionLabel title="Capital & Growth" icon="bars" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DashCard
              title="Starting Capital"
              value={currency(startBalance)}
              icon="wallet"
            />
            <DashCard
              title="All-time Trade PnL"
              value={`${totalTradePnlAllTime >= 0 ? "+" : ""}${currency(Number(totalTradePnlAllTime.toFixed(2)))}`}
              tone={
                totalTradePnlAllTime > 0
                  ? "positive"
                  : totalTradePnlAllTime < 0
                    ? "negative"
                    : "neutral"
              }
              icon="growth"
            />
            <DashCard
              title="Total Deposited"
              value={`+${currency(Number(totalDepositedAllTime.toFixed(2)))}`}
              hint="All time"
              tone={totalDepositedAllTime > 0 ? "positive" : "neutral"}
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
              title="Monthly Deposits"
              value={`+${currency(Number(monthlyDeposited.toFixed(2)))}`}
              hint="Current month"
              tone={monthlyDeposited > 0 ? "positive" : "neutral"}
              icon="calendar"
            />
            <DashCard
              title="Monthly Withdrawals"
              value={`-${currency(Number(monthlyWithdrawn.toFixed(2)))}`}
              hint="Current month"
              tone={monthlyWithdrawn > 0 ? "negative" : "neutral"}
              icon="calendar"
            />
            <DashCard
              title="All-time Growth"
              value={`${fmt(allTimeGrowthPct)}%`}
              hint="Based on starting capital"
              tone={
                allTimeGrowthPct > 0
                  ? "positive"
                  : allTimeGrowthPct < 0
                    ? "negative"
                    : "neutral"
              }
              icon="growth"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                    Performance Summary
                  </h4>
                </div>
                <div className="space-y-2">
                  <MetricRow
                    label="Best Day"
                    value={currency(
                      Number(performanceSummary.bestDay.toFixed(2)),
                    )}
                    tone="positive"
                    icon="trophy"
                  />
                  <MetricRow
                    label="Worst Day"
                    value={currency(
                      Number(performanceSummary.worstDay.toFixed(2)),
                    )}
                    tone="negative"
                    icon="down"
                  />
                  <MetricRow
                    label="Average Daily PnL"
                    value={currency(
                      Number(performanceSummary.averageDailyPnl.toFixed(2)),
                    )}
                    tone={
                      performanceSummary.averageDailyPnl >= 0
                        ? "blue"
                        : "negative"
                    }
                    icon="bars"
                  />
                  <MetricRow
                    label="Profit Factor"
                    value={fmt(performanceSummary.profitFactor)}
                    tone="purple"
                    icon="scale"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/5 text-white">
                    <Target className="h-4 w-4" />
                  </div>
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                    Daily Target Progress
                  </h4>
                </div>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Daily Target</span>
                  <span>{currency(dashboardDailyTarget)}</span>
                </div>
                <div className="text-3xl font-black text-[#F6C945]">
                  {dashboardDailyTarget > 0
                    ? fmt(
                        Math.max(0, Math.min(100, (pnl / dashboardDailyTarget) * 100)),
                      )
                    : "0"}
                  %
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F6C945] to-amber-400"
                    style={{
                      width: `${dashboardDailyTarget > 0 ? Math.max(0, Math.min(100, (pnl / dashboardDailyTarget) * 100)) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>{currency(Math.max(0, pnl))} achieved</span>
                  <span>
                    {currency(Math.max(0, dashboardDailyTarget - Math.max(0, pnl)))}{" "}
                    remaining
                  </span>
                </div>
                <div className="mt-4 rounded-lg border border-[#F6C945]/30 bg-[#F6C945]/10 px-3 py-2 text-sm text-slate-200">
                  <Star className="mr-2 inline h-4 w-4 text-[#F6C945]" /> Stay
                  focused. Consistency compounds.
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-1">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                        Last Session Summary
                      </h4>
                      <p className="text-xs text-slate-400">
                        {lastSessionSummary
                          ? `${new Date(lastSessionSummary.endedAt).toLocaleString()} • ${lastSessionSummary.topMarket}`
                          : "No previous session recorded"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                    {lastSessionSummary ? "Completed" : "No Trades"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <MiniStat
                    label="Trades"
                    value={`${lastSessionSummary?.trades ?? 0}`}
                    tone="blue"
                  />
                  <MiniStat
                    label="Win Rate"
                    value={`${fmt(lastSessionSummary?.winRate ?? 0)}%`}
                    tone="positive"
                  />
                  <MiniStat
                    label="Best Trade"
                    value={currency(
                      Math.max(...sessionTrades.map((t) => t.pnl || 0), 0),
                    )}
                    tone="positive"
                  />
                  <MiniStat
                    label="Worst Trade"
                    value={currency(
                      Math.min(...sessionTrades.map((t) => t.pnl || 0), 0),
                    )}
                    tone="negative"
                  />
                </div>
                <div className="mt-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
                  <Info className="mr-2 inline h-4 w-4" />
                  {closed
                    ? "Review entries with precision. Repeat what worked and remove what failed."
                    : "No trades recorded this session. Execute with precision. Review with purpose."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-gradient-to-r from-[#0b1220] to-[#111827] px-4 py-3 text-center text-sm text-slate-300 shadow-lg">
            <span className="text-[#F6C945]">⚡</span> Discipline is doing what
            needs to be done, even when you don&apos;t feel like doing it.
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
              <CardContent className="p-5 space-y-3">
                <h4 className="text-lg font-semibold text-white">
                  Session Discipline
                </h4>
                <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">
                      Discipline Score
                    </span>
                    <span className="text-sm font-bold text-[#F6C945]">
                      {disciplineScore}/100
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-2 bg-[#D4AF37]"
                      style={{ width: `${disciplineScore}%` }}
                    />
                  </div>
                  {currentRuleBadges.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400">
                        Rules Enforced
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentRuleBadges.slice(0, 6).map((b: string) => (
                          <span
                            key={b}
                            className="px-2 py-1 rounded-full text-xs border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-slate-200"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <Label>Daily Max Loss (USD)</Label>
                    <Input
                      type="number"
                      value={maxLoss}
                      onChange={(e) => setMaxLoss(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Stop trading at -Max Loss</Label>
                    <Select
                      value={String(lockOnHit)}
                      onValueChange={(v: string) => setLockOnHit(v === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70] bg-white border shadow-md">
                        <SelectItem value="true">Enabled</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>Today PnL</Label>
                    <div
                      className={`h-10 grid place-items-center rounded-md border ${todayTradePnl < 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : todayTradePnl > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-200"}`}
                    >
                      <strong>
                        {todayTradePnl >= 0 ? "+" : ""}
                        {currency(Number(todayTradePnl.toFixed(2)))}
                      </strong>
                    </div>
                  </div>
                </div>
                <div
                  className={`rounded-md border p-3 text-sm ${locked && lockOnHit ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <strong>Status:</strong>{" "}
                      {locked && lockOnHit
                        ? "Locked for today (max loss hit)"
                        : "Active"}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetDailyLock}>
                        Reset Lock
                      </Button>
                      {locked && lockOnHit && (
                        <Button
                          onClick={() => {
                            setLockOnHit(false);
                            push({
                              title: "Override",
                              desc: "Lock disabled for today.",
                            });
                          }}
                        >
                          Override
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  When enabled, Quick Logger and New Trade are disabled once
                  today&apos;s PnL ≤ -Daily Max Loss. Auto-unlocks at local
                  midnight.
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
              <CardContent className="p-5 space-y-4">
                <h4 className="text-lg font-semibold text-white">Goals</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Weekly Target (USD)</Label>
                    <Input
                      type="number"
                      value={weeklyTarget}
                      onChange={(e) =>
                        setWeeklyTarget(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <Label>Monthly Target (USD)</Label>
                    <Input
                      type="number"
                      value={monthlyTarget}
                      onChange={(e) =>
                        setMonthlyTarget(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                <GoalProgress
                  label="Weekly Progress"
                  progress={Number(weeklyProgress.toFixed(2))}
                  target={weeklyTarget || 0}
                />
                <GoalProgress
                  label="Monthly Progress"
                  progress={Number(monthlyProgress.toFixed(2))}
                  target={monthlyTarget || 0}
                />
              </CardContent>
            </Card>
          </div>

          <BadgeShowcase badge={badge} tradeCount={badgeTradeCount} />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <AnalyticsPanel trades={tradeRows} />
        </TabsContent>

        {/* RISK & SIZING — DERIV */}
        <TabsContent value="risk-deriv" className="space-y-4">
          <RiskCalculatorSelector active={activeTab} setActive={setActiveTab} />
          <CapitalAndRiskSummary
            equity={equity}
            riskAmount={riskAmount}
            riskPct={riskPct}
          />

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-lg font-semibold">
                Per-Market Lot Size (Deriv)
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Enter risk pips for each Deriv market. Risk amount uses current
                equity × risk%.
              </p>
              <div className="space-y-3">
                {MARKET_OPTIONS.filter((m) => m !== "Withdrawals" && m !== "Deposits").map(
                  (mkt) => (
                    <MarketSizerRowDeriv
                      key={mkt}
                      market={mkt}
                      riskAmount={riskAmount}
                    />
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RISK & SIZING — FX (5 pairs) */}
        <TabsContent value="risk-fx" className="space-y-4">
          <RiskCalculatorSelector active={activeTab} setActive={setActiveTab} />
          <CapitalAndRiskSummary
            equity={equity}
            riskAmount={riskAmount}
            riskPct={riskPct}
          />

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
          <RiskCalculatorSelector active={activeTab} setActive={setActiveTab} />
          <CapitalAndRiskSummary
            equity={equity}
            riskAmount={riskAmount}
            riskPct={riskPct}
          />

          <RiskSizerUniversalPanel
            title="XAU / Indices / Crypto"
            storagePrefix="ust-majors"
            rows={[
              { id: "xau", defaultSymbol: "XAUUSD", defaultPipValue: 1 }, // placeholder; adjust to broker spec
              { id: "nas", defaultSymbol: "US Tech 100", defaultPipValue: 1 }, // placeholder
              { id: "us30", defaultSymbol: "US30", defaultPipValue: 1 }, // placeholder
              { id: "btc", defaultSymbol: "BTCUSD", defaultPipValue: 1 }, // placeholder
            ]}
            riskAmount={riskAmount}
          />
        </TabsContent>

        {/* JOURNAL */}
        <TabsContent value="journal" className="space-y-4">
          {locked && lockOnHit && (
            <Card>
              <CardContent className="p-3 text-sm text-rose-700 bg-rose-50 border-rose-200">
                Trading is locked for today (max loss hit). Adjust settings on
                Dashboard to override.
              </CardContent>
            </Card>
          )}
          {/* Auto-Import from Google Sheets */}
          <div className="border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-2">
              Auto-Import Closed Trades (Google Sheets)
            </h3>
            <AutoImportPanel
              addTradesBulkFn={addTradesBulk}
              onRemoveDuplicates={removeDuplicateTrades}
            />
          </div>

          {/* Record Withdrawal (does not count as trading loss) */}
          <Card className="border-[#D4AF37]/40 mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Withdrawal</h3>
                <span className="text-xs text-slate-500">
                  Affects equity only (not a trading loss)
                </span>
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <Label>Amount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 250"
                    value={withdrawAmt}
                    onChange={(e) =>
                      setWithdrawAmt(Number(e.target.value) || 0)
                    }
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
                      push({
                        title: "Withdrawal recorded",
                        desc: "Saved (does not count as a trading loss).",
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Record Deposit (adds capital, does not count as trading profit) */}
          <Card className="border-emerald-400/40 mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Deposit</h3>
                <span className="text-xs text-slate-500">
                  Adds to equity only (not trading profit)
                </span>
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <Label>Amount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={depositAmt}
                    onChange={(e) =>
                      setDepositAmt(Number(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="md:col-span-6">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. Added capital / topped up account"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
                    disabled={depositAmt <= 0}
                    onClick={() => {
                      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                      setTrades((prev) => [
                        {
                          id,
                          ts: Date.now(),
                          kind: "deposit",
                          amount: Number(depositAmt.toFixed(2)),
                          pnl: 0,
                          symbol: "Deposits",
                          notes: depositNote || "Deposit recorded",
                          source: "manual",
                        },
                        ...prev,
                      ]);
                      setDepositAmt(0);
                      setDepositNote("");
                      push({
                        title: "Deposit recorded",
                        desc: "Saved (does not count as trading profit).",
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <MultiQuickLogger
            initialRows={1}
            maxRows={1}
            locked={locked && lockOnHit}
            onLogged={(rows) => {
              if (locked && lockOnHit) return;
              rows.forEach((row) =>
                addTrade({
                  symbol: row.market,
                  notes: row.strategy,
                  pnl: row.pnl,
                }),
              );
            }}
          />

          <JournalGrouped
            trades={trades}
            onDelete={deleteTrade}
            sessionId={sessionId}
            startBalance={startBalance}
          />
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar">
          <OldCalendar trades={tradeRows} withdrawals={withdrawalRows} deposits={depositRows} />
        </TabsContent>

        {/* PLANNING */}
        <TabsContent value="asetups">
          <PlanningPage
            costs={planningCosts}
            setCosts={setPlanningCosts}
            monthlyTarget={monthlyCostTarget}
            dailyTarget={plannedDailyTarget}
            weeklyTarget={weeklyTarget}
            tradingDays={tradingDaysThisMonth}
            monthlyProgress={monthlyProgress}
          />
        </TabsContent>

        {/* CHECKLIST — Review & Targets (standalone tab; no guardrails wired) */}
        <TabsContent value="checklist">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h4 className="text-lg font-semibold">
                🧭 Checklist — Review & Targets
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use this tab to confirm your plan and set your Start Capital +
                Risk % before trading. Copy the summary and paste to
                Telegram/Slack if you like.
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
                recommendedRiskPct={recommendedRiskPct}
                recommendedRiskAmount={smartRiskAmount}
                targetRiskPct={targetRiskPct}
                targetRiskAmount={targetRiskAmountPerTrade}
                setRecommendedRiskPct={setRiskPct}
              />

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label>1️⃣ Why I Trade</Label>
                    <textarea
                      className="w-full border rounded-md p-2 h-24"
                      value={whyTrade}
                      onChange={(e) => setWhyTrade(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>2️⃣ Mental Readiness</Label>
                    <textarea
                      className="w-full border rounded-md p-2 h-20"
                      value={mentalReady}
                      onChange={(e) => setMentalReady(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>3️⃣ Trading Target</Label>
                    <textarea
                      className="w-full border rounded-md p-2 h-20"
                      value={sessionTarget}
                      onChange={(e) => setSessionTarget(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>6️⃣ Setups I'll Trade</Label>
                    <textarea
                      className="w-full border rounded-md p-2 h-20"
                      value={setupsToday}
                      onChange={(e) => setSetupsToday(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Profit-Only Trigger (info, % of start)</Label>
                      <Input
                        type="number"
                        value={thresholdPct}
                        onChange={(e) =>
                          setThresholdPct(Number(e.target.value) || 0)
                        }
                      />
                      <div className="text-[11px] text-slate-500 mt-1">
                        Default 30%
                      </div>
                    </div>
                    <div>
                      <Label>Giveback Lock (info, % of profit)</Label>
                      <Input
                        type="number"
                        value={givebackPct}
                        onChange={(e) =>
                          setGivebackPct(Number(e.target.value) || 0)
                        }
                      />
                      <div className="text-[11px] text-slate-500 mt-1">
                        E.g. 50%
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3">
                    <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-yellow-200">
                      🧠 Smart Planning Risk
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Planned Trades Per Day</Label>
                        <Input
                          type="number"
                          min="1"
                          value={plannedTradesPerDay}
                          onChange={(e) => setPlannedTradesPerDay(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <div>
                        <Label>Expected Average R</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={plannedRewardR}
                          onChange={(e) => setPlannedRewardR(Math.max(0.1, Number(e.target.value) || 1))}
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="text-slate-600 dark:text-slate-300">Monthly target remaining</div>
                      <div className="font-medium">{currency(remainingMonthlyTarget)}</div>
                      <div className="text-slate-600 dark:text-slate-300">Required daily target</div>
                      <div className="font-medium">{currency(requiredDailyTarget)}</div>
                      <div className="text-slate-600 dark:text-slate-300">Target risk needed</div>
                      <div className="font-black text-blue-600 dark:text-blue-300">{targetRiskPct.toFixed(2)}% / {currency(targetRiskAmountPerTrade)}</div>
                      <div className="text-slate-600 dark:text-slate-300">UST smart risk</div>
                      <div className="font-black text-emerald-600 dark:text-emerald-300">{recommendedRiskPct.toFixed(2)}% / {currency(smartRiskAmount)}</div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Formula: remaining monthly target ÷ remaining Mon–Fri days ÷ planned trades ÷ expected R. UST then applies the giveback safety ceiling when active.
                    </div>
                  </div>

                  <div className="rounded-md border p-3 bg-slate-50">
                    <div className="text-sm font-medium mb-1">
                      Live Snapshot (read-only)
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="text-slate-600 dark:text-slate-300">
                        Start Capital
                      </div>
                      <div className="font-medium">
                        {currency(startBalance)}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Equity
                      </div>
                      <div className="font-medium">{currency(equity)}</div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Profit
                      </div>
                      <div className="font-medium">
                        {currency(Math.max(0, equity - startBalance))}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Threshold
                      </div>
                      <div className="font-medium">
                        {thresholdPct}% (
                        {currency((thresholdPct / 100) * startBalance)})
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const txt = [
                          "🧭 Trading Checklist",
                          `Why: ${whyTrade || "-"}`,
                          `Ready: ${mentalReady || "-"}`,
                          `Target: ${sessionTarget || "-"}`,
                          `Setups: ${setupsToday || "-"}`,
                          "",
                          `Start: ${currency(startBalance)} • Equity: ${currency(equity)}`,
                          `Profit: ${currency(Math.max(0, equity - startBalance))}`,
                          `Profit-Only threshold: ${thresholdPct}% (${currency((thresholdPct / 100) * startBalance)})`,
                          `Planning target remaining: ${currency(remainingMonthlyTarget)} • Daily needed: ${currency(requiredDailyTarget)}`,
                          `UST smart risk: ${recommendedRiskPct.toFixed(2)}% (${currency(smartRiskAmount)})`,
                          givebackPct
                            ? `Giveback lock (info): ${givebackPct}%`
                            : null,
                          `Time: ${new Date().toLocaleString()}`,
                        ]
                          .filter(Boolean)
                          .join("\n");
                        navigator.clipboard.writeText(txt).then(() => {
                          push({
                            title: "Copied",
                            desc: "Checklist summary copied.",
                          });
                        });
                      }}
                    >
                      Copy Summary
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        const id = newSessionId();
                        push({
                          title: "Checklist reset",
                          desc: `Session ID: ${id}`,
                        });
                      }}
                    >
                      Reset Checklist
                    </Button>
                  </div>

                  <div className="rounded-md border p-3 bg-slate-50">
                    <div className="text-sm font-medium mb-1">
                      Live Snapshot (read-only)
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="text-slate-600 dark:text-slate-300">
                        Start Capital
                      </div>
                      <div className="font-medium">
                        {currency(startBalance)}
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">
                        Equity
                      </div>
                      <div className="font-medium">{currency(equity)}</div>

                      <div className="text-slate-600 dark:text-slate-300">
                        Profit
                      </div>
                      <div className="font-medium">
                        {currency(realizedProfit)} (
                        {formatPct(realizedProfit, startBalance)})
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">
                        Mode
                      </div>
                      <div className="font-medium">
                        {profitOnlyMode ? "Profit-Only" : "Standard"}
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">
                        Max Session Loss (min of profit/4 & giveback)
                      </div>
                      <div className="font-medium">
                        {currency(maxSessionLossGuard)}
                      </div>

                      <div className="text-slate-600 dark:text-slate-300">
                        Effective Loss Cap
                      </div>
                      <div className="font-medium">
                        {Number.isFinite(effectiveLossCap)
                          ? currency(effectiveLossCap)
                          : "—"}
                      </div>
                    </div>

                    {/* Giveback Plan — Recommendations */}
                    <div className="mt-3 rounded-md border bg-white p-3">
                      <div className="text-sm font-semibold mb-2">
                        🎯 Giveback Plan — Recommendations
                      </div>
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div className="text-slate-600 dark:text-slate-300">
                          Giveback Lock Amount
                        </div>
                        <div className="font-medium">
                          {currency(givebackLockAmt)}
                        </div>

                        <div className="text-slate-600 dark:text-slate-300">
                          Per-Trade Budget (×6 losses)
                        </div>
                        <div className="font-medium">
                          {currency(sixLossBudget)}
                        </div>

                        <div className="text-slate-600 dark:text-slate-300">
                          Giveback Safety Risk %
                        </div>
                        <div className="font-medium">
                          {givebackRiskPct.toFixed(2)}%
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        These are guidance values only for decision-making. This
                        tab does not change risk elsewhere.
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Note: This tab is informational only and won't change risk
                    or locks elsewhere.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsList className="fixed inset-x-3 bottom-3 z-50 grid h-[72px] grid-cols-5 gap-1 rounded-2xl border border-slate-300 bg-white/95 p-2 shadow-2xl shadow-black/20 backdrop-blur md:hidden dark:border-slate-700/80 dark:bg-slate-950/95 dark:shadow-black/50">
          <TabsTrigger
            value="dashboard"
            className="group flex h-full flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-bold leading-none text-slate-600 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:text-slate-400 dark:data-[state=active]:text-black"
          >
            <Home className="mb-1 h-5 w-5 text-[#B68E12] group-data-[state=active]:text-black dark:text-[#F6C945] dark:group-data-[state=active]:text-black" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger
            value="journal"
            className="group flex h-full flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-bold leading-none text-slate-600 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:text-slate-400 dark:data-[state=active]:text-black"
          >
            <BookOpen className="mb-1 h-5 w-5 text-[#B68E12] group-data-[state=active]:text-black dark:text-[#F6C945] dark:group-data-[state=active]:text-black" />
            <span>Journal</span>
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="group flex h-full flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-bold leading-none text-slate-600 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:text-slate-400 dark:data-[state=active]:text-black"
          >
            <CalendarDays className="mb-1 h-5 w-5 text-[#B68E12] group-data-[state=active]:text-black dark:text-[#F6C945] dark:group-data-[state=active]:text-black" />
            <span>Calendar</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="group flex h-full flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-bold leading-none text-slate-600 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:text-slate-400 dark:data-[state=active]:text-black"
          >
            <BarChart3 className="mb-1 h-5 w-5 text-[#B68E12] group-data-[state=active]:text-black dark:text-[#F6C945] dark:group-data-[state=active]:text-black" />
            <span>Stats</span>
          </TabsTrigger>
          <TabsTrigger
            value="checklist"
            className="group flex h-full flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-bold leading-none text-slate-600 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black dark:text-slate-400 dark:data-[state=active]:text-black"
          >
            <ClipboardCheck className="mb-1 h-5 w-5 text-[#B68E12] group-data-[state=active]:text-black dark:text-[#F6C945] dark:group-data-[state=active]:text-black" />
            <span>Checklist</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

/* =========================================================================
   Reusable UI blocks
============================================================================ */
type DashTone =
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "gold"
  | "blue"
  | "purple";

function TopStatusMetric({
  icon,
  label,
  value,
  tone = "positive",
}: {
  icon: "wallet" | "trend" | "growth" | "activity";
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const iconClass = "h-5 w-5 md:h-6 md:w-6";
  const Icon =
    icon === "wallet" ? (
      <Wallet className={iconClass} />
    ) : icon === "trend" ? (
      <TrendingUp className={iconClass} />
    ) : icon === "growth" ? (
      <TrendingUp className={iconClass} />
    ) : (
      <Activity className={iconClass} />
    );
  const valueClass =
    tone === "negative"
      ? "text-rose-300"
      : tone === "neutral"
        ? "text-slate-100"
        : "text-emerald-300";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-3 shadow-lg shadow-black/20 lg:flex lg:items-center lg:gap-3 lg:border-r lg:border-y-0 lg:border-l-0 lg:bg-transparent lg:p-0 lg:pr-4 lg:shadow-none last:border-r-0">
      <div className="mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300/90 sm:h-11 sm:w-11 lg:mb-0 lg:h-auto lg:w-auto lg:border-0 lg:bg-transparent">
        {Icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase leading-tight tracking-wide text-slate-400 sm:text-[11px] md:text-xs">
          {label}
        </p>
        <p
          className={`mt-1 max-w-full break-words text-[20px] font-black leading-none tracking-[-0.04em] sm:text-2xl lg:mt-1 lg:text-xl ${valueClass}`}
        >
          {value}
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 h-5 w-14 opacity-60 lg:hidden">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-emerald-400/25 to-emerald-300/10" />
      </div>
    </div>
  );
}

type DashIcon =
  | "wallet"
  | "trend"
  | "growth"
  | "down"
  | "calendar"
  | "shield"
  | "pie"
  | "bars"
  | "trophy"
  | "scale";

function SectionLabel({ title, icon }: { title: string; icon?: DashIcon }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      {icon && (
        <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#F6C945]/30 bg-[#F6C945]/10 text-[#F6C945]">
          <DashIconView icon={icon} className="h-4 w-4" />
        </div>
      )}
      <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-100">
        {title}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/70 to-transparent" />
    </div>
  );
}

function DashIconView({
  icon,
  className = "h-5 w-5",
}: {
  icon: DashIcon;
  className?: string;
}) {
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

function SparkLine({
  kind = "flat",
  tone = "positive",
}: {
  kind?: "up" | "flat";
  tone?: DashTone;
}) {
  const stroke =
    tone === "positive"
      ? "#22c55e"
      : tone === "negative"
        ? "#f43f5e"
        : tone === "blue"
          ? "#3b82f6"
          : "#F6C945";
  const points =
    kind === "up"
      ? "0,44 18,42 34,36 50,24 68,30 86,30 104,20 122,27 140,24 158,18 176,29 194,28 212,10 230,14 248,19 266,11 284,2"
      : "0,28 22,28 44,25 66,30 88,27 110,29 132,27 154,28 176,28 198,26 220,30 242,24 264,31 284,23";
  return (
    <svg
      viewBox="0 0 284 48"
      className="mt-3 h-8 w-full opacity-90 sm:mt-4 sm:h-12"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="0"
        y1="44"
        x2="284"
        y2="44"
        stroke={stroke}
        strokeOpacity="0.18"
      />
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
    <Card
      className={`group overflow-hidden border shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${toneClasses(tone)}`}
    >
      <CardContent
        className={
          featured
            ? "relative min-h-[125px] p-3 sm:min-h-[150px] sm:p-5"
            : "relative min-h-[105px] p-3 sm:p-4"
        }
      >
        {icon && (
          <div
            className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border bg-white/5 sm:right-4 sm:top-4 sm:h-11 sm:w-11 ${toneText(tone)} border-current/30`}
          >
            <DashIconView icon={icon} className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="pr-10 text-xs font-bold text-slate-200 sm:pr-12 sm:text-sm">
          {title}
        </div>
        <div
          className={`${featured ? "text-[22px] sm:text-3xl" : "text-[20px] sm:text-2xl"} mt-2 max-w-full break-words font-black leading-none tracking-[-0.04em] ${toneText(tone)}`}
        >
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs leading-snug text-slate-400 sm:text-sm">
            {hint}
          </div>
        )}
        {spark && <SparkLine kind={spark} tone={tone} />}
        {typeof progress === "number" && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800 sm:mt-5 sm:h-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F6C945] to-amber-400"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  tone = "neutral",
  icon = "bars",
}: {
  label: string;
  value: string;
  tone?: DashTone;
  icon?: DashIcon;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-8 w-8 place-items-center rounded-lg bg-white/5 ${toneText(tone)}`}
        >
          <DashIconView icon={icon} className="h-4 w-4" />
        </div>
        <span className="font-semibold text-slate-200">{label}</span>
      </div>
      <span className={`font-extrabold ${toneText(tone)}`}>{value}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: DashTone;
}) {
  return (
    <div>
      <div className={`mb-1 text-xl font-black ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function MiniProgress({
  title,
  current,
  target,
}: {
  title: string;
  current: number;
  target: number;
}) {
  const pct =
    target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const tone =
    current >= target && target > 0
      ? "text-emerald-400"
      : current < 0
        ? "text-rose-400"
        : "text-[#F6C945]";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-100">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-slate-400">
            Target: {target > 0 ? currency(target) : "Not set"}
          </div>
        </div>
        <div className={`text-right text-lg font-bold ${tone}`}>
          {current >= 0 ? "+" : ""}
          {currency(Number(current.toFixed(2)))}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-[#D4AF37] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs text-slate-400">
        {target > 0 ? `${fmt(pct)}% reached` : "Add a target in Goals"}
      </div>
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
  recommendedRiskPct = 0,
  recommendedRiskAmount = 0,
  targetRiskPct = 0,
  targetRiskAmount = 0,
  setRecommendedRiskPct,
}: {
  startBalance: number;
  setStartBalance: (v: number) => void;
  riskPct: number;
  setRiskPct: (v: number) => void;
  equity: number;
  riskAmount: number;
  tradesCount: number;
  recommendedRiskPct?: number;
  recommendedRiskAmount?: number;
  targetRiskPct?: number;
  targetRiskAmount?: number;
  setRecommendedRiskPct?: (v: number) => void;
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
                  if (
                    confirm(
                      "Reset ALL trades and sessions and unlock starting capital?",
                    )
                  ) {
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
          <Input
            type="number"
            step="0.1"
            value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value) || 0)}
          />
        </div>
        <InfoStat label="Current Equity" value={currency(equity)} />
        <InfoStat label="Risk Amount (auto)" value={currency(riskAmount)} />
        <div className="md:col-span-4 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-black text-slate-900 dark:text-yellow-200">
                UST Smart Risk Recommendation
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Planning target requires {targetRiskPct.toFixed(2)}% ({currency(targetRiskAmount)}) per trade.
                Recommended now: {recommendedRiskPct.toFixed(2)}% ({currency(recommendedRiskAmount)}).
              </div>
            </div>
            {setRecommendedRiskPct && recommendedRiskPct > 0 && (
              <Button
                type="button"
                size="sm"
                className="bg-[#D4AF37] text-black hover:bg-[#F6C945]"
                onClick={() => setRecommendedRiskPct(Number(recommendedRiskPct.toFixed(2)))}
              >
                Apply Smart Risk
              </Button>
            )}
          </div>
        </div>
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
  tradeCount,
}: {
  badge: { name: string; imagePath: string } | null;
  tradeCount: number;
}) {
  const tiers = [
    {
      key: "Silver",
      name: "Silver • 25 Trades Survived",
      at: 25,
      img: "/badges/silver.png",
    },
    {
      key: "Gold",
      name: "Gold • 50 Trades Consistent",
      at: 50,
      img: "/badges/gold.png",
    },
    {
      key: "Platinum",
      name: "Platinum • 75 Trades Disciplined",
      at: 75,
      img: "/badges/platinum.png",
    },
    {
      key: "Diamond",
      name: "Diamond • 100 Trades Certified",
      at: 100,
      img: "/badges/diamond.png",
    },
    {
      key: "Elite",
      name: "Elite • 150 Trades Mastered",
      at: 150,
      img: "/badges/elite.png",
    },
    {
      key: "Legendary",
      name: "Legendary • 200 Trades Proven",
      at: 200,
      img: "/badges/legendary.png",
    },
  ];
  const current =
    badge ??
    (tradeCount >= 25 ? { name: tiers[0].name, imagePath: tiers[0].img } : null);
  const nextTier = tiers.find((t) => tradeCount < t.at);
  const pct = nextTier
    ? Math.min(100, Math.round((tradeCount / nextTier.at) * 100))
    : 100;
  const left = nextTier ? Math.max(0, nextTier.at - tradeCount) : 0;

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
            <div className="text-xl font-semibold">
              {current?.name || "Starter • Keep building trades"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Badges are now issued from total journal trade count.
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Journal trades counted: <strong>{tradeCount}</strong>
            </div>
            {nextTier ? (
              <>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Next badge: <strong>{nextTier.key}</strong> at {nextTier.at}{" "}
                  trades.
                </div>
                <div className="w-full h-2 rounded-full bg-slate-50 dark:bg-slate-800 mt-2 overflow-hidden">
                  <div
                    className="h-2 bg-indigo-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {left} more trade(s) to {nextTier.key}.
                </div>
              </>
            ) : (
              <div className="text-sm text-emerald-600 mt-3">
                You've reached the top tier. 🏆
              </div>
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
function MarketSizerRowDeriv({
  market,
  riskAmount,
}: {
  market: MarketName;
  riskAmount: number;
}) {
  const storageKey = `ust-riskpips-${market}`;
  const [riskPips, setRiskPips] = useState<number>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
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
        <div className="text-[11px] text-slate-500 mt-1">
          Risk: {currency(riskAmount)}
        </div>
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
          Lot size = Risk Amount ÷ (Risk Pips × Pip Value per 1 lot). Enter your
          broker's pip value per lot.
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
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(symKey) : null;
    return raw ?? defaultSymbol;
  });
  const [riskPips, setRiskPips] = useState<number>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(pipsKey) : null;
    return raw ? Number(raw) : 0;
  });
  const [pipVal, setPipVal] = useState<number>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(pipValKey) : null;
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
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
      </div>
      <div className="md:col-span-3">
        <Label>Risk Pips</Label>
        <Input
          type="number"
          value={riskPips}
          onChange={(e) => setRiskPips(Number(e.target.value) || 0)}
        />
      </div>
      <div className="md:col-span-3">
        <Label>Pip Value / Lot (USD)</Label>
        <Input
          type="number"
          step="0.01"
          value={pipVal}
          onChange={(e) => setPipVal(Number(e.target.value) || 0)}
        />
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

  const fx = fxIds
    .map((id) => grab(`ust-fx-${id}-symbol`))
    .filter(Boolean) as string[];
  const majors = majorIds
    .map((id) => grab(`ust-majors-${id}-symbol`))
    .filter(Boolean) as string[];

  // Default built-in markets
  const deriv = [
    "Step Index",
    "Volatility 75 (1s) Index",
    "Volatility 75 Index",
    "Volatility 50 Index", // ✅ ADD THIS
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
  return [...deriv, ...defaults, ...fx, ...majors].filter((s) =>
    seen.has(s) ? false : (seen.add(s), true),
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
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0 z-[80] bg-white border shadow-lg"
      >
        <Command>
          <CommandInput placeholder="Search markets or symbols…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>

            <CommandGroup heading="Saved & Deriv">
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${opt === value ? "opacity-100" : "opacity-0"}`}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>

            {value && !options.includes(value.toUpperCase()) && (
              <CommandGroup heading="Typed">
                <CommandItem
                  value={value.toUpperCase()}
                  onSelect={() => {
                    onChange(value.toUpperCase());
                    setOpen(false);
                  }}
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
  onLogged: (
    rows: { market: string; strategy: StrategyName; pnl: number }[],
  ) => void;
}) {
  type Pending = {
    id: string;
    market: string;
    strategy: StrategyName;
    pnl: number;
  };
  const emptyRow = (): Pending => ({
    id: `${Math.random().toString(36).slice(2, 8)}`,
    market: "Volatility 75 (1s) Index",
    strategy: "Ultimate M1 Trend setup",
    pnl: 0,
  });

  const [rows, setRows] = useState<Pending[]>(
    Array.from({ length: initialRows }, emptyRow),
  );

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
          <h4 className="text-lg font-semibold">
            Quick Logger (up to {maxRows})
          </h4>
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
        {locked && (
          <div className="text-xs text-rose-700">
            Locked due to daily max loss. Adjust on Dashboard.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={`grid md:grid-cols-12 gap-3 items-end rounded-lg border p-3 ${
                locked ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <div className="md:col-span-1 text-xs text-slate-500">
                #{idx + 1}
              </div>

              <div className="md:col-span-3">
                <Label>Market</Label>
                <MarketPicker
                  value={r.market}
                  onChange={(val) => updateRow(r.id, { market: val })}
                />
              </div>

              <div className="md:col-span-5">
                <Label>Strategy</Label>
                <Select
                  value={r.strategy}
                  onValueChange={(v: StrategyName) =>
                    updateRow(r.id, { strategy: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] bg-white border shadow-md">
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
                  onChange={(e) =>
                    updateRow(r.id, { pnl: Number(e.target.value) || 0 })
                  }
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
  const [journalFilter, setJournalFilter] = React.useState<
    "all" | "wins" | "losses" | "withdrawals" | "deposits"
  >("all");
  const [selectedTrade, setSelectedTrade] = React.useState<TradeRow | null>(
    null,
  );

  const histRaw =
    typeof window !== "undefined"
      ? localStorage.getItem("ust-session-history")
      : "[]";
  const hist: string[] = histRaw ? JSON.parse(histRaw) : [];
  const sessionsSorted = [...hist].map(Number).sort((a, b) => a - b);
  const all = [...trades].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const tradeOnly = all.filter((t) => !["withdrawal", "deposit"].includes(t.kind ?? "trade"));
  const withdrawalsOnly = all.filter(
    (t) => (t.kind ?? "trade") === "withdrawal",
  );
  const depositsOnly = all.filter((t) => (t.kind ?? "trade") === "deposit");
  const wins = tradeOnly.filter((t) => (t.pnl || 0) > 0).length;
  const losses = tradeOnly.filter((t) => (t.pnl || 0) < 0).length;
  const be = tradeOnly.filter((t) => (t.pnl || 0) === 0).length;
  const totalPnl = tradeOnly.reduce((a, t) => a + (t.pnl || 0), 0);
  const totalWithdrawn = withdrawalsOnly.reduce(
    (a, t) => a + (t.amount || 0),
    0,
  );
  const totalDeposited = depositsOnly.reduce((a, t) => a + (t.amount || 0), 0);
  const winRate = tradeOnly.length ? (wins / tradeOnly.length) * 100 : 0;
  const avgPnl = tradeOnly.length ? totalPnl / tradeOnly.length : 0;
  const bestTrade = tradeOnly.length
    ? Math.max(...tradeOnly.map((t) => t.pnl || 0))
    : 0;
  const worstTrade = tradeOnly.length
    ? Math.min(...tradeOnly.map((t) => t.pnl || 0))
    : 0;

  const filteredAll = all.filter((t) => {
    const q = journalSearch.trim().toLowerCase();
    const matchesText =
      !q ||
      `${t.symbol} ${t.notes || ""} ${t.source || ""}`
        .toLowerCase()
        .includes(q);
    const kind = t.kind ?? "trade";
    const matchesFilter =
      journalFilter === "all" ||
      (journalFilter === "wins" && !["withdrawal", "deposit"].includes(kind) && (t.pnl || 0) > 0) ||
      (journalFilter === "losses" &&
        !["withdrawal", "deposit"].includes(kind) &&
        (t.pnl || 0) < 0) ||
      (journalFilter === "withdrawals" && kind === "withdrawal") ||
      (journalFilter === "deposits" && kind === "deposit");
    return matchesText && matchesFilter;
  });

  type Bucket = { title: string; rows: TradeRow[]; startTs?: number };
  const buckets: Bucket[] = [];
  function titleFor(ts: number, idx: number) {
    const d = new Date(ts);
    return `Trade Batch ${idx + 1} (${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })})`;
  }
  if (sessionsSorted.length) {
    for (let i = 0; i < sessionsSorted.length; i++) {
      const start = sessionsSorted[i];
      const end =
        i < sessionsSorted.length - 1 ? sessionsSorted[i + 1] : Infinity;
      const rows = filteredAll.filter(
        (t) => (t.ts || 0) >= start && (t.ts || 0) < end,
      );
      if (rows.length)
        buckets.push({ title: titleFor(start, i), rows, startTs: start });
    }
  } else if (filteredAll.length)
    buckets.push({ title: "All Trades", rows: filteredAll });

  const totalAll = (rows: TradeRow[]) =>
    rows.reduce(
      (a, t) => a + (["withdrawal", "deposit"].includes(t.kind ?? "trade") ? 0 : t.pnl || 0),
      0,
    );
  const priorPnlBefore = (ts: number) =>
    all
      .filter((t) => (t.ts || 0) < ts && !["withdrawal", "deposit"].includes(t.kind ?? "trade"))
      .reduce((a, t) => a + (t.pnl || 0), 0);
  const qualityLabel =
    winRate >= 60 && totalPnl >= 0
      ? "A-Grade Execution"
      : winRate >= 45
        ? "Needs Review"
        : tradeOnly.length
          ? "Protect Capital"
          : "No Trades Yet";
  const qualityTone =
    winRate >= 60 && totalPnl >= 0
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : winRate >= 45
        ? "border-[#F6C945]/40 bg-[#F6C945]/10 text-[#F6C945]"
        : tradeOnly.length
          ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
          : "border-slate-600 bg-slate-800/60 text-slate-300";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20 xl:col-span-2">
          <CardContent className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                    Trade Log
                  </h4>
                  <p className="text-xs text-slate-400">
                    Clean history of imported and manual trades.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => exportCsv(trades)}
                className="border-[#F6C945]/50 bg-[#F6C945]/10 text-[#F6C945] hover:bg-[#F6C945] hover:text-black"
              >
                Export CSV
              </Button>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                placeholder="Search market, notes, source..."
                className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
              />
              <div className="flex flex-wrap gap-2">
                {(["all", "wins", "losses", "withdrawals", "deposits"] as const).map(
                  (f) => (
                    <Button
                      key={f}
                      type="button"
                      variant="outline"
                      onClick={() => setJournalFilter(f)}
                      className={`${journalFilter === f ? "border-[#F6C945] bg-[#F6C945] text-black" : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800"} capitalize`}
                    >
                      {f}
                    </Button>
                  ),
                )}
              </div>
            </div>
            {buckets.length ? (
              <div className="space-y-4">
                {buckets
                  .slice()
                  .reverse()
                  .map((b, i) => {
                    const total = totalAll(b.rows);
                    const baseEquity = b.startTs
                      ? startBalance + priorPnlBefore(b.startTs)
                      : startBalance;
                    const pct = formatPct(total, baseEquity);
                    const rowsTradeOnly = b.rows.filter(
                      (r) => !["withdrawal", "deposit"].includes(r.kind ?? "trade"),
                    );
                    const sw = rowsTradeOnly.filter(
                      (r) => (r.pnl || 0) > 0,
                    ).length;
                    const sessionWinRate = rowsTradeOnly.length
                      ? (sw / rowsTradeOnly.length) * 100
                      : 0;
                    return (
                      <div
                        key={i}
                        className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-4 py-3">
                          <div>
                            <div className="font-bold text-white">
                              {b.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {rowsTradeOnly.length} trades •{" "}
                              {fmt(sessionWinRate)}% WR
                            </div>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <div
                              className={`text-xl font-black ${total >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {total >= 0 ? "+" : ""}
                              {currency(Number(total.toFixed(2)))}
                            </div>
                            {pct && (
                              <span className="text-xs text-slate-400">
                                ({pct})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden grid-cols-12 border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 md:grid">
                          <div className="col-span-2">Time</div>
                          <div className="col-span-2">Market</div>
                          <div className="col-span-4">Strategy / Notes</div>
                          <div className="col-span-2">Source</div>
                          <div className="col-span-1 text-right">PnL</div>
                          <div className="col-span-1 text-right">Action</div>
                        </div>
                        {b.rows
                          .slice()
                          .reverse()
                          .map((t) => {
                            const kind = t.kind ?? "trade";
                            const isWithdrawal = kind === "withdrawal";
                            const isDeposit = kind === "deposit";
                            const amount = isWithdrawal || isDeposit
                              ? t.amount || 0
                              : t.pnl || 0;
                            const amountTone = isWithdrawal
                              ? "text-[#F6C945]"
                              : isDeposit || amount >= 0
                                ? "text-emerald-400"
                                : "text-rose-400";
                            return (
                              <div
                                key={t.id}
                                onClick={() => setSelectedTrade(t)}
                                className="mx-3 mb-3 grid cursor-pointer grid-cols-1 gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800/55 md:mx-0 md:mb-0 md:grid-cols-12 md:items-center md:rounded-none md:border-0 md:border-b md:border-slate-800/70 md:bg-transparent md:px-4"
                              >
                                <div className="text-slate-300 md:col-span-2">
                                  {t.ts
                                    ? new Date(t.ts).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </div>
                                <div className="flex items-center gap-2 font-bold text-white md:col-span-2">
                                  <span>{t.symbol}</span>
                                  {isWithdrawal && (
                                    <span className="rounded-full bg-[#F6C945] px-2 py-[2px] text-[10px] font-black text-black">
                                      Withdrawal
                                    </span>
                                  )}
                                  {isDeposit && (
                                    <span className="rounded-full bg-emerald-500 px-2 py-[2px] text-[10px] font-black text-white">
                                      Deposit
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-300 md:col-span-4">
                                  {t.notes || "—"}
                                </div>
                                <div className="md:col-span-2">
                                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs capitalize text-slate-300">
                                    {t.source || "manual"}
                                  </span>
                                </div>
                                <div
                                  className={`font-black md:col-span-1 md:text-right ${amountTone}`}
                                >
                                  {isWithdrawal ? "-" : isDeposit || amount >= 0 ? "+" : ""}
                                  {currency(Number(amount.toFixed(2)))}
                                </div>
                                <div className="md:col-span-1 md:text-right">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete(t.id);
                                    }}
                                    size="sm"
                                    className="border border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
                No matching trades yet. Use Quick Logger above or adjust your
                filter.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/35 bg-emerald-500/10 text-emerald-300">
                  <Target className="h-4 w-4" />
                </div>
                <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                  Execution Snapshot
                </h4>
              </div>
              <div className="space-y-2">
                <MetricRow
                  label="Best Trade"
                  value={currency(Number(bestTrade.toFixed(2)))}
                  tone="positive"
                  icon="growth"
                />
                <MetricRow
                  label="Worst Trade"
                  value={currency(Number(worstTrade.toFixed(2)))}
                  tone="negative"
                  icon="down"
                />
                <MetricRow
                  label="Break Even"
                  value={`${be}`}
                  tone="blue"
                  icon="scale"
                />
                <MetricRow
                  label="Total Trades"
                  value={`${tradeOnly.length}`}
                  tone="purple"
                  icon="bars"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100 shadow-xl shadow-black/20">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#F6C945]/35 bg-[#F6C945]/10 text-[#F6C945]">
                  <Info className="h-4 w-4" />
                </div>
                <h4 className="text-base font-extrabold uppercase tracking-wide text-white">
                  Selected Trade
                </h4>
              </div>
              {selectedTrade ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      Market
                    </p>
                    <p className="text-lg font-black text-white">
                      {selectedTrade.symbol}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">
                        Result
                      </p>
                      <p
                        className={`text-xl font-black ${(selectedTrade.kind ?? "trade") === "withdrawal" ? "text-[#F6C945]" : (selectedTrade.kind ?? "trade") === "deposit" ? "text-emerald-400" : (selectedTrade.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {(selectedTrade.kind ?? "trade") === "withdrawal"
                          ? `-${currency(selectedTrade.amount || 0)}`
                          : (selectedTrade.kind ?? "trade") === "deposit"
                            ? `+${currency(selectedTrade.amount || 0)}`
                            : `${(selectedTrade.pnl || 0) >= 0 ? "+" : ""}${currency(selectedTrade.pnl || 0)}`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">
                        Source
                      </p>
                      <p className="text-lg font-black capitalize text-white">
                        {selectedTrade.source || "manual"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      Notes
                    </p>
                    <p className="mt-1 text-slate-300">
                      {selectedTrade.notes || "No notes captured."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                  Click any trade row to inspect the full journal detail here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function JournalStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "warning" | "gold" | "blue" | "neutral";
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-400 border-emerald-400/25 bg-emerald-500/10"
      : tone === "negative"
        ? "text-rose-400 border-rose-400/25 bg-rose-500/10"
        : tone === "warning" || tone === "gold"
          ? "text-[#F6C945] border-[#F6C945]/25 bg-[#F6C945]/10"
          : tone === "blue"
            ? "text-blue-400 border-blue-400/25 bg-blue-500/10"
            : "text-white border-slate-700 bg-slate-900/70";
  return (
    <div
      className={`rounded-xl border p-3 shadow-lg shadow-black/10 sm:p-4 ${toneCls}`}
    >
      <p className="text-xs font-bold text-slate-300 sm:text-sm">{label}</p>
      <div className="mt-2 break-words text-2xl font-black sm:text-3xl">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400 sm:text-sm">{hint}</p>}
    </div>
  );
}

/* =========================================================================
   Analytics
============================================================================ */
function AnalyticsPanel({ trades }: { trades: TradeRow[] }) {
  const analytics = useMemo(() => {
    const tradeOnly = trades
      .filter((t) => !["withdrawal", "deposit"].includes(t.kind ?? "trade"))
      .slice()
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));

    const closed = tradeOnly.length;
    const wins = tradeOnly.filter((t) => (t.pnl || 0) > 0);
    const losses = tradeOnly.filter((t) => (t.pnl || 0) < 0);
    const be = tradeOnly.filter((t) => (t.pnl || 0) === 0);
    const pnl = tradeOnly.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossWin = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLossAbs = Math.abs(
      losses.reduce((sum, t) => sum + (t.pnl || 0), 0),
    );
    const winRate = closed ? (wins.length / closed) * 100 : 0;
    const avgWin = wins.length ? grossWin / wins.length : 0;
    const avgLoss = losses.length ? grossLossAbs / losses.length : 0;
    const profitFactor =
      grossLossAbs > 0 ? grossWin / grossLossAbs : grossWin > 0 ? grossWin : 0;
    const expectancy = closed ? pnl / closed : 0;
    const bestTrade = tradeOnly.length
      ? Math.max(...tradeOnly.map((t) => t.pnl || 0))
      : 0;
    const worstTrade = tradeOnly.length
      ? Math.min(...tradeOnly.map((t) => t.pnl || 0))
      : 0;

    const byMarketMap: Record<
      string,
      {
        name: string;
        pnl: number;
        trades: number;
        wins: number;
        losses: number;
      }
    > = {};
    const byStrategyMap: Record<
      string,
      {
        name: string;
        pnl: number;
        trades: number;
        wins: number;
        losses: number;
      }
    > = {};

    tradeOnly.forEach((t) => {
      const market = t.symbol || "Unknown";
      const strategy = t.notes?.toLowerCase().includes("range")
        ? "Ultimate M1 Range setup"
        : "Ultimate M1 Trend setup";
      if (!byMarketMap[market])
        byMarketMap[market] = {
          name: market,
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
      if (!byStrategyMap[strategy])
        byStrategyMap[strategy] = {
          name: strategy,
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
      [byMarketMap[market], byStrategyMap[strategy]].forEach((bucket) => {
        bucket.pnl += t.pnl || 0;
        bucket.trades += 1;
        if ((t.pnl || 0) > 0) bucket.wins += 1;
        if ((t.pnl || 0) < 0) bucket.losses += 1;
      });
    });

    const byMarket = Object.values(byMarketMap)
      .map((x) => ({
        ...x,
        pnl: Number(x.pnl.toFixed(2)),
        winRate: x.trades ? (x.wins / x.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
    const byStrategy = Object.values(byStrategyMap)
      .map((x) => ({
        ...x,
        pnl: Number(x.pnl.toFixed(2)),
        winRate: x.trades ? (x.wins / x.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    let running = 0;
    const equityCurve = tradeOnly.map((t, i) => {
      running += t.pnl || 0;
      return {
        trade: i + 1,
        pnl: Number(running.toFixed(2)),
        result: Number((t.pnl || 0).toFixed(2)),
        market: t.symbol || "Unknown",
      };
    });

    const outcomeData = [
      { name: "Wins", count: wins.length },
      { name: "Losses", count: losses.length },
      { name: "BE", count: be.length },
    ];

    return {
      tradeOnly,
      closed,
      wins: wins.length,
      losses: losses.length,
      be: be.length,
      pnl,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      bestTrade,
      worstTrade,
      byMarket,
      byStrategy,
      equityCurve,
      outcomeData,
      bestMarket: byMarket[0],
      bestStrategy: byStrategy[0],
    };
  }, [trades]);

  const coachTone =
    analytics.pnl >= 0
      ? "text-emerald-300 border-emerald-400/25 bg-emerald-500/10"
      : "text-rose-300 border-rose-400/25 bg-rose-500/10";
  const coachMessage =
    analytics.closed === 0
      ? "No closed trades yet. Once trades are logged, this page will identify your best market, best setup and behaviour pattern."
      : analytics.profitFactor >= 1.5
        ? "Performance is healthy. Keep focusing on the highest-confidence A-setups and avoid increasing lot size too early."
        : analytics.winRate >= 50 && analytics.pnl < 0
          ? "Win rate is acceptable, but losses are too large. Tighten stop discipline and reduce average loss."
          : analytics.winRate < 45
            ? "Accuracy is weak. Reduce trades and only execute setups that match the checklist."
            : "Performance is stable but needs sharper filtering. Prioritise the best market and setup below.";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-800/80 bg-gradient-to-br from-[#0b1220] via-[#0d1627] to-[#121827] text-slate-100 shadow-xl shadow-black/20">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#F6C945]">
                Performance Command Centre
              </p>
              <h3 className="mt-1 text-2xl font-black text-white md:text-3xl">
                Analytics Overview
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Know what is working, what is costing you, and where to focus
                next.
              </p>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${coachTone}`}
            >
              🧠 Coach: {analytics.pnl >= 0 ? "Controlled" : "Review Required"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStat
              title="Net PnL"
              value={`${analytics.pnl >= 0 ? "+" : ""}${currency(Number(analytics.pnl.toFixed(2)))}`}
              hint={`${analytics.closed} closed trades`}
              tone={analytics.pnl >= 0 ? "positive" : "negative"}
            />
            <AnalyticsStat
              title="Win Rate"
              value={`${fmt(analytics.winRate)}%`}
              hint={`${analytics.wins}W / ${analytics.losses}L / ${analytics.be}BE`}
              tone={
                analytics.winRate >= 55
                  ? "positive"
                  : analytics.winRate >= 45
                    ? "gold"
                    : "negative"
              }
            />
            <AnalyticsStat
              title="Profit Factor"
              value={
                analytics.profitFactor ? fmt(analytics.profitFactor) : "0.00"
              }
              hint="Gross wins ÷ gross losses"
              tone={
                analytics.profitFactor >= 1.5
                  ? "positive"
                  : analytics.profitFactor >= 1
                    ? "gold"
                    : "negative"
              }
            />
            <AnalyticsStat
              title="Expectancy"
              value={`${analytics.expectancy >= 0 ? "+" : ""}${currency(Number(analytics.expectancy.toFixed(2)))}`}
              hint="Average value per trade"
              tone={analytics.expectancy >= 0 ? "positive" : "negative"}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-800/80 bg-[#0b1220] text-slate-100 xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-black text-white">Progress Curve</h4>
                <p className="text-xs text-slate-400">
                  Cumulative PnL progression across closed trades.
                </p>
              </div>
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                Live Journal Data
              </span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analytics.equityCurve}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.55}
                  />
                  <XAxis
                    dataKey="trade"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    formatter={(value: number) => [
                      currency(Number(value)),
                      "Cumulative PnL",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100">
          <CardContent className="p-5">
            <h4 className="text-lg font-black text-white">Coach Diagnosis</h4>
            <p className="mt-1 text-xs text-slate-400">
              Actionable readout from the journal.
            </p>
            <div className="mt-4 rounded-2xl border border-[#F6C945]/20 bg-[#F6C945]/10 p-4 text-sm text-slate-200">
              {coachMessage}
            </div>
            <div className="mt-4 space-y-3">
              <InsightRow
                label="Best Market"
                value={
                  analytics.bestMarket
                    ? `${analytics.bestMarket.name} • ${currency(analytics.bestMarket.pnl)}`
                    : "Waiting for data"
                }
              />
              <InsightRow
                label="Best Setup"
                value={
                  analytics.bestStrategy
                    ? `${analytics.bestStrategy.name} • ${fmt(analytics.bestStrategy.winRate)}% WR`
                    : "Waiting for data"
                }
              />
              <InsightRow
                label="Best Trade"
                value={`${analytics.bestTrade >= 0 ? "+" : ""}${currency(Number(analytics.bestTrade.toFixed(2)))}`}
              />
              <InsightRow
                label="Worst Trade"
                value={`${analytics.worstTrade >= 0 ? "+" : ""}${currency(Number(analytics.worstTrade.toFixed(2)))}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800/80 bg-[#0b1220] text-slate-100">
          <CardContent className="p-5">
            <h4 className="text-lg font-black text-white">PnL by Market</h4>
            <p className="text-xs text-slate-400">
              Shows which markets deserve more focus.
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.byMarket}
                  margin={{ top: 8, right: 12, bottom: 40, left: 0 }}
                  barCategoryGap={18}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.55}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={58}
                    angle={-18}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    tick={{ fontSize: 12, fill: "#cbd5e1" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    tick={{ fontSize: 12, fill: "#cbd5e1" }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    formatter={(value: number) => [
                      currency(Number(value)),
                      "PnL",
                    ]}
                  />
                  <Bar
                    dataKey="pnl"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={58}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-[#0b1220] text-slate-100">
          <CardContent className="p-5">
            <h4 className="text-lg font-black text-white">
              Outcome Distribution
            </h4>
            <p className="text-xs text-slate-400">
              Quick view of wins, losses and break-even trades.
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.outcomeData}
                  margin={{ top: 8, right: 12, bottom: 16, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.55}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#F6C945"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={64}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PerformanceTable
          title="Strategy Performance"
          rows={analytics.byStrategy}
          empty="No setup data yet."
        />
        <PerformanceTable
          title="Market Performance"
          rows={analytics.byMarket}
          empty="No market data yet."
        />
      </div>
    </div>
  );
}

function AnalyticsStat({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "positive" | "negative" | "gold";
}) {
  const cls =
    tone === "positive"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : tone === "negative"
        ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
        : "border-[#F6C945]/25 bg-[#F6C945]/10 text-[#F6C945]";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="text-right text-sm font-black text-white">{value}</span>
    </div>
  );
}

function PerformanceTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{
    name: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
  }>;
  empty: string;
}) {
  return (
    <Card className="border-slate-800/80 bg-[#0b1220] text-slate-100">
      <CardContent className="p-5">
        <h4 className="text-lg font-black text-white">{title}</h4>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
          <div className="grid grid-cols-12 bg-slate-900/70 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400">
            <div className="col-span-5">Name</div>
            <div className="col-span-2 text-right">PnL</div>
            <div className="col-span-2 text-right">Trades</div>
            <div className="col-span-3 text-right">Win Rate</div>
          </div>
          {rows.length ? (
            rows.map((r) => (
              <div
                key={r.name}
                className="grid grid-cols-12 border-t border-slate-800 px-4 py-3 text-sm"
              >
                <div className="col-span-5 font-bold text-white">{r.name}</div>
                <div
                  className={`col-span-2 text-right font-black ${r.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {r.pnl >= 0 ? "+" : ""}
                  {currency(r.pnl)}
                </div>
                <div className="col-span-2 text-right text-slate-300">
                  {r.trades}
                </div>
                <div className="col-span-3 text-right font-bold text-blue-300">
                  {fmt(r.winRate)}%
                </div>
              </div>
            ))
          ) : (
            <div className="p-5 text-center text-sm text-slate-400">
              {empty}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   Smart Coach + SaaS polish helpers
============================================================================ */
function SmartCoachPanel({
  locked,
  lockOnHit,
  closed,
  wins,
  losses,
  bes,
  winRate,
  disciplineScore,
  pnl,
  maxLoss,
  riskPct,
  recommendedRiskPct,
  ruleBadges,
  sessionTarget,
  setupsToday,
}: {
  locked: boolean;
  lockOnHit: boolean;
  closed: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number;
  disciplineScore: number;
  pnl: number;
  maxLoss: number;
  riskPct: number;
  recommendedRiskPct: number;
  ruleBadges: string[];
  sessionTarget: string;
  setupsToday: string;
}) {
  const isLocked = locked && lockOnHit;
  const riskControlled =
    !recommendedRiskPct || riskPct <= recommendedRiskPct * 1.1;
  const netPositive = pnl > 0;
  const lossRate = closed ? (losses / closed) * 100 : 0;

  const primary = isLocked
    ? "🚫 Guardrail active — protect the account and review recent trading conditions."
    : closed >= 10 && winRate < 50
      ? "⚠️ Win rate needs improvement — identify which market or setup is dragging performance."
      : closed >= 10 && winRate >= 60
        ? "✅ Trading performance is healthy — keep risk stable and avoid changing too much."
        : "🧠 Keep collecting clean trade data — the coach becomes stronger as journal history grows.";

  const suggestions = [
    closed
      ? `📊 ${closed} trades tracked in the journal`
      : "🟡 Refresh trades to start building performance data",
    winRate >= 55
      ? "✅ Overall win rate is acceptable"
      : "🟡 Improve entries by filtering weaker setups/markets",
    netPositive
      ? "✅ Net realised PnL is positive"
      : "🟡 Net PnL is not positive yet — reduce risk while testing",
    lossRate >= 50
      ? "🔴 Loss rate is high — review losing market conditions"
      : "✅ Loss rate is under control",
    riskControlled
      ? "✅ Risk is within the recommended zone"
      : "🔴 Risk is above the recommended level",
  ];

  return (
    <Card className="overflow-hidden border-yellow-500/25 bg-[radial-gradient(circle_at_top_right,rgba(246,201,69,0.16),transparent_30%),linear-gradient(135deg,#07111f,#0b1220)] shadow-2xl shadow-black/25">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-white">
            🧠 Smart Coach
          </CardTitle>
          <CardDescription className="text-slate-400">
            Performance guidance based on all journal trades
          </CardDescription>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${isLocked ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"}`}
        >
          {isLocked ? "LOCKED" : "ACTIVE"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm font-semibold text-yellow-200">
          {primary}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-slate-300">
            Trades Tracked
            <br />
            <span className="text-lg font-black text-yellow-300">{closed}</span>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-slate-300">
            Overall Win Rate
            <br />
            <span className="text-lg font-black text-emerald-300">
              {fmt(winRate)}%
            </span>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-slate-300">
            W/L/BE
            <br />
            <span className="text-lg font-black text-sky-300">
              {wins}/{losses}/{bes}
            </span>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-slate-300">
            Net PnL
            <br />
            <span
              className={`text-lg font-black ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
            >
              {currency(pnl)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Coach Signals
          </div>
          {suggestions.map((x) => (
            <div
              key={x}
              className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-2 text-xs text-slate-200"
            >
              {x}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-sky-200">
          <span className="font-black">Next action:</span>{" "}
          {closed < 10
            ? "Keep importing trades until there is enough sample size."
            : winRate < 50
              ? "Open Analytics and cut the weakest market/setup."
              : "Scale only after win rate and PnL remain stable."}
        </div>

        <div className="flex flex-wrap gap-2">
          {ruleBadges.slice(0, 4).map((b) => (
            <span
              key={b}
              className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-[11px] font-bold text-yellow-200"
            >
              {b}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   A-Setups Gallery
============================================================================ */
function PlanningPage({
  costs,
  setCosts,
  monthlyTarget,
  dailyTarget,
  weeklyTarget,
  tradingDays,
  monthlyProgress,
}: {
  costs: PlanningCost[];
  setCosts: (rows: PlanningCost[]) => void;
  monthlyTarget: number;
  dailyTarget: number;
  weeklyTarget: number;
  tradingDays: number;
  monthlyProgress: number;
}) {
  const remaining = Math.max(0, monthlyTarget - monthlyProgress);
  const progressPct = monthlyTarget > 0 ? Math.min(100, (monthlyProgress / monthlyTarget) * 100) : 0;

  function updateCost(id: string, patch: Partial<PlanningCost>) {
    setCosts(costs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCost() {
    setCosts([
      ...costs,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "New Cost", amount: 0 },
    ]);
  }

  function removeCost(id: string) {
    setCosts(costs.filter((c) => c.id !== id));
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-[#D4AF37]/25 bg-[radial-gradient(circle_at_top_left,rgba(246,201,69,0.14),transparent_30%),#07111f] text-slate-100">
        <CardHeader>
          <CardTitle className="text-white">🧭 UST Planning Page</CardTitle>
          <CardDescription className="text-slate-400">
            Build the month from real life costs first. UST then turns that number into realistic monthly, weekly and daily targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <DashCard title="Monthly Cost Target" value={currency(monthlyTarget)} hint="Auto-fills monthly target" tone="blue" icon="scale" />
            <DashCard title="Weekly Target" value={currency(weeklyTarget)} hint="Auto-filled from planning" tone="positive" icon="calendar" />
            <DashCard title="Daily Target" value={currency(dailyTarget)} hint={`${tradingDays} Mon–Fri days this month`} tone="positive" icon="growth" />
            <DashCard title="Remaining" value={currency(remaining)} hint={`${fmt(progressPct)}% covered this month`} tone={remaining <= 0 && monthlyTarget > 0 ? "positive" : "neutral"} icon="wallet" />
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-white">Monthly Costs</h3>
                <p className="text-xs text-slate-400">Add every expected cost as a row. The total becomes the trading target for the month.</p>
              </div>
              <Button type="button" onClick={addCost} className="bg-[#D4AF37] text-black hover:bg-[#F6C945]">
                Add Cost
              </Button>
            </div>

            <div className="space-y-2">
              {costs.map((cost) => (
                <div key={cost.id} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 md:grid-cols-[1fr_180px_auto]">
                  <Input
                    value={cost.name}
                    onChange={(e) => updateCost(cost.id, { name: e.target.value })}
                    placeholder="Cost name"
                    className="bg-slate-950/70 text-slate-100"
                  />
                  <Input
                    type="number"
                    value={cost.amount}
                    onChange={(e) => updateCost(cost.id, { amount: Number(e.target.value) || 0 })}
                    placeholder="Amount"
                    className="bg-slate-950/70 text-slate-100"
                  />
                  <Button type="button" variant="outline" onClick={() => removeCost(cost.id)} className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                    Remove
                  </Button>
                </div>
              ))}
              {!costs.length && (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                  No costs added yet. Add your first monthly cost to create a plan.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <h3 className="font-black text-emerald-300">Planning Logic</h3>
            <p className="mt-1 text-sm text-slate-300">
              Monthly target = total planned costs. Daily target = monthly target divided by Monday–Friday trading days in the current month. Weekly target = daily target × 5.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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

  function conditionsFromNotes(text?: string) {
    return String(text || "")
      .split(/\n|,|;/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function setupScore(text?: string) {
    const conditions = conditionsFromNotes(text);
    if (!conditions.length) return 55;
    return Math.min(95, 55 + conditions.length * 8);
  }

  function setupStatus(score: number) {
    if (score >= 80)
      return {
        label: "🟢 READY",
        cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
      };
    if (score >= 65)
      return {
        label: "🟡 FORMING",
        cls: "border-yellow-400/40 bg-yellow-500/10 text-yellow-300",
      };
    return {
      label: "🔵 STUDY",
      cls: "border-sky-400/40 bg-sky-500/10 text-sky-300",
    };
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-yellow-500/20 bg-[radial-gradient(circle_at_top_left,rgba(246,201,69,0.12),transparent_28%),#07111f]">
        <CardHeader>
          <CardTitle className="text-white">
            🎯 A-Setup Execution Library
          </CardTitle>
          <CardDescription className="text-slate-400">
            Turn screenshots into repeatable execution cards with conditions,
            strength score and action status.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <Label>Setup Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ultimate Trend Buy A-Setup"
            />
          </div>
          <div className="md:col-span-5">
            <Label>Execution Checklist</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Price above EMA315, SSL above EMA315, Pullback complete"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Chart Image</Label>
            <input
              className="mt-2 text-sm"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="md:col-span-2 self-end">
            <Button
              className="w-full bg-yellow-500 text-black hover:bg-yellow-400"
              disabled={!file}
              onClick={addItem}
            >
              Add Setup
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Execution Rule</div>
            <div className="text-lg font-black text-emerald-300">80%+ only</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Library Size</div>
            <div className="text-lg font-black text-yellow-300">
              {items.length} setups
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Purpose</div>
            <div className="text-lg font-black text-sky-300">
              Trade less, better
            </div>
          </CardContent>
        </Card>
      </div>

      {!items.length && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-300">
            Upload screenshots for your A-Setups once. UST will display them as
            execution cards so traders know exactly what is allowed.
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((it) => {
          const conditions = conditionsFromNotes(it.notes);
          const score = setupScore(it.notes);
          const status = setupStatus(score);
          return (
            <Card
              key={it.id}
              className="overflow-hidden border-slate-800 bg-[#0B1220] shadow-xl shadow-black/20"
            >
              <CardContent className="p-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black text-white">
                        {it.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        A-Setup execution card
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Setup Strength
                      </span>
                      <span className="font-black text-yellow-300">
                        {score}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                </div>

                <img
                  src={it.dataUrl}
                  alt={it.title}
                  className="w-full border-y border-slate-800 object-contain"
                />

                <div className="p-4 space-y-3">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Checklist
                  </div>
                  {conditions.length ? (
                    <ul className="space-y-1 text-xs text-slate-200">
                      {conditions.map((c) => (
                        <li key={c}>✅ {c}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Add conditions so this becomes a true execution rule.
                    </p>
                  )}

                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                    Execute only when live market matches this card and your
                    Smart Coach remains active.
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={() =>
                        setItems(items.filter((x) => x.id !== it.id))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
    const csv = [headers, ...rows]
      .map((r) => r.map(csvEscape).join(","))
      .join("\n");
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
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 dark:border-slate-700/80 dark:bg-slate-950/70">
      <div className="flex items-end justify-between">
        <div className="text-sm font-bold text-slate-100">{label}</div>
        <div className="text-xs font-semibold text-slate-300">
          {target ? `${pct.toFixed(0)}%` : "—"}
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-800 mt-2 overflow-hidden">
        <div
          className={`h-2 transition-all ${reached ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 text-xs text-slate-300 flex items-center justify-between gap-3">
        <span>
          Progress:{" "}
          <strong className="text-slate-100">
            {currency(Number(progress.toFixed(2)))}
          </strong>
        </span>
        <span>
          Target:{" "}
          <strong className="text-slate-100">
            {currency(Number((target || 0).toFixed(2)))}
          </strong>
        </span>
      </div>

      {reached && (
        <div className="mt-1 text-[11px] font-semibold text-emerald-300">
          🎯 Goal reached for this period — nice work!
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Pro Calendar (heatmap + monthly/weekly summaries + click day drill-down)
============================================================================ */
function OldCalendar({
  trades,
  withdrawals,
  deposits,
}: {
  trades: { ts?: number; pnl?: number; symbol?: string; notes?: string }[];
  withdrawals: { ts?: number; amount?: number }[];
  deposits: { ts?: number; amount?: number }[];
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function startOfCalendar(d: Date) {
    const x = startOfMonth(d);
    const dow = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dow);
    return x;
  }
  function keyOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function keyFromTs(ts: number) {
    const d = new Date(ts);
    return keyOf(d);
  }

  const startBalanceRaw =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("ust-start-balance") || 0)
      : 0;
  const startBalance = startBalanceRaw > 0 ? startBalanceRaw : 1000;
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
  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  // Mobile share view: hide the final overflow row from the following month
  // so screenshots look tighter and more premium.
  const mobileDays = useMemo(() => {
    const lastDayOfViewMonth = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() + 1,
      0,
    );
    return days.filter((d) => {
      const isNextMonthOverflow =
        d.getMonth() !== viewDate.getMonth() &&
        d.getTime() > lastDayOfViewMonth.getTime();
      return !isNextMonthOverflow;
    });
  }, [days, viewDate]);

  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const todayKey = keyOf(new Date());
  const viewMonth = viewDate.getMonth();

  const calendarStats = useMemo(() => {
    const byDay = new Map<
      string,
      {
        pnl: number;
        trades: number;
        wins: number;
        losses: number;
        withdrawals: number;
        deposits: number;
        symbols: Set<string>;
        items: { ts?: number; pnl?: number; symbol?: string; notes?: string }[];
      }
    >();
    const ensure = (key: string) => {
      if (!byDay.has(key))
        byDay.set(key, {
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
          withdrawals: 0,
          deposits: 0,
          symbols: new Set(),
          items: [],
        });
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

    deposits.forEach((d) => {
      if (!d.ts) return;
      ensure(keyFromTs(d.ts)).deposits += Number(d.amount || 0);
    });

    const monthKeys = Array.from(byDay.keys()).filter((key) => {
      const d = new Date(`${key}T00:00:00`);
      return (
        d.getMonth() === viewDate.getMonth() &&
        d.getFullYear() === viewDate.getFullYear()
      );
    });

    const monthlyPnl = monthKeys.reduce(
      (sum, key) => sum + (byDay.get(key)?.pnl || 0),
      0,
    );
    const monthlyTrades = monthKeys.reduce(
      (sum, key) => sum + (byDay.get(key)?.trades || 0),
      0,
    );
    const monthlyWins = monthKeys.reduce(
      (sum, key) => sum + (byDay.get(key)?.wins || 0),
      0,
    );
    const monthlyWithdrawals = monthKeys.reduce(
      (sum, key) => sum + (byDay.get(key)?.withdrawals || 0),
      0,
    );
    const activeDays = monthKeys.filter(
      (key) => (byDay.get(key)?.trades || 0) > 0,
    ).length;
    const bestDay = monthKeys.reduce(
      (best, key) => Math.max(best, byDay.get(key)?.pnl || 0),
      0,
    );
    const worstDay = monthKeys.reduce(
      (worst, key) => Math.min(worst, byDay.get(key)?.pnl || 0),
      0,
    );

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
  }, [trades, withdrawals, deposits, viewDate]);

  const selectedDay = selectedKey ? calendarStats.byDay.get(selectedKey) : null;

  function pnlTone(pnl: number) {
    if (pnl > 0) return "text-emerald-300";
    if (pnl < 0) return "text-rose-300";
    return "text-slate-100";
  }

  function heatClass(pnl: number, hasActivity: boolean) {
    if (!hasActivity) return "bg-[#101827] hover:bg-[#142033]";
    if (pnl > 0)
      return pnl >= startBalance * 0.25
        ? "bg-emerald-500/20 border-emerald-400/45 shadow-[0_0_22px_rgba(16,185,129,0.18)]"
        : "bg-emerald-500/10 border-emerald-400/30";
    if (pnl < 0)
      return Math.abs(pnl) >= startBalance * 0.1
        ? "bg-rose-500/20 border-rose-400/45 shadow-[0_0_22px_rgba(244,63,94,0.16)]"
        : "bg-rose-500/10 border-rose-400/30";
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
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#F6C945]">
                Trading Calendar
              </p>
              <h2 className="text-2xl font-extrabold text-slate-100">
                {monthLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                const d = new Date(viewDate);
                d.setMonth(d.getMonth() - 1);
                setViewDate(startOfMonth(d));
              }}
            >
              ← Prev
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800"
              onClick={() => setViewDate(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                const d = new Date(viewDate);
                d.setMonth(d.getMonth() + 1);
                setViewDate(startOfMonth(d));
              }}
            >
              Next →
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 sm:hidden">
          Swipe the calendar left or right to view each day clearly.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <CalendarMetric
            label="Month PnL"
            value={`${calendarStats.monthlyPnl >= 0 ? "+" : ""}${currency(Number(calendarStats.monthlyPnl.toFixed(2)))}`}
            tone={
              calendarStats.monthlyPnl > 0
                ? "good"
                : calendarStats.monthlyPnl < 0
                  ? "bad"
                  : "neutral"
            }
          />
          <CalendarMetric
            label="Win Rate"
            value={`${calendarStats.monthlyWinRate.toFixed(0)}%`}
            tone="blue"
          />
          <CalendarMetric
            label="Trades"
            value={String(calendarStats.monthlyTrades)}
            tone="neutral"
          />
          <CalendarMetric
            label="Active Days"
            value={String(calendarStats.activeDays)}
            tone="neutral"
          />
          <CalendarMetric
            label="Best Day"
            value={`${calendarStats.bestDay >= 0 ? "+" : ""}${currency(Number(calendarStats.bestDay.toFixed(2)))}`}
            tone="good"
          />
          <CalendarMetric
            label="Withdrawn"
            value={`-${currency(Number(calendarStats.monthlyWithdrawals.toFixed(2)))}`}
            tone="bad"
          />
        </div>
      </div>

      {/* Mobile share-friendly calendar view */}
      <div className="md:hidden rounded-3xl border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_top_left,rgba(246,201,69,0.18),transparent_34%),linear-gradient(145deg,#07111f,#0b1220_55%,#111827)] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#F6C945]">
              UST Calendar
            </p>
            <h3 className="text-2xl font-black text-white">{monthLabel}</h3>
          </div>
          <div
            className={`rounded-2xl border px-3 py-2 text-right ${calendarStats.monthlyPnl >= 0 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-rose-400/40 bg-rose-500/10 text-rose-300"}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              Month PnL
            </div>
            <div className="text-lg font-black">
              {calendarStats.monthlyPnl >= 0 ? "+" : ""}
              {currency(Number(calendarStats.monthlyPnl.toFixed(2)))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Trades
            </div>
            <div className="mt-1 text-xl font-black text-white">
              {calendarStats.monthlyTrades}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Win Rate
            </div>
            <div className="mt-1 text-xl font-black text-emerald-300">
              {calendarStats.monthlyWinRate.toFixed(0)}%
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Active Days
            </div>
            <div className="mt-1 text-xl font-black text-[#F6C945]">
              {calendarStats.activeDays}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-black uppercase text-slate-400">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
            <div key={`${d}-${idx}`}>{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {mobileDays.map((d, i) => {
            const k = keyOf(d);
            const inMonth = d.getMonth() === viewMonth;
            const isToday = k === todayKey;
            const day = calendarStats.byDay.get(k);
            const dayPnl = day?.pnl || 0;
            const hasActivity =
              !!day && (day.trades > 0 || day.withdrawals > 0 || day.deposits > 0);
            const compactPnl = `${dayPnl >= 0 ? "+" : "-"}$${Math.abs(dayPnl).toFixed(0)}`;
            const cellTone = !hasActivity
              ? "border-slate-800 bg-slate-950/35 text-slate-500"
              : dayPnl >= 0
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.12)]"
                : "border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-[0_0_14px_rgba(251,113,133,0.12)]";
            return (
              <button
                type="button"
                key={i}
                onClick={() => setSelectedKey(k)}
                className={`relative min-h-[64px] rounded-xl border p-1.5 text-left transition ${cellTone} ${inMonth ? "opacity-100" : "opacity-25"} ${isToday ? "ring-1 ring-[#F6C945]" : ""} ${selectedKey === k ? "ring-2 ring-[#F6C945]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">{d.getDate()}</span>
                  {hasActivity ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${dayPnl >= 0 ? "bg-emerald-300" : "bg-rose-300"}`}
                    />
                  ) : null}
                </div>
                {hasActivity ? (
                  <div className="mt-2">
                    <div
                      className={`whitespace-nowrap text-[11px] font-black leading-none tracking-tight ${dayPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {compactPnl}
                    </div>
                    <div className="mt-1 text-[9px] font-bold leading-none text-slate-300">
                      {day?.trades || 0} trades
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/35 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              Best / Worst
            </span>
            <span className="text-xs font-bold text-[#F6C945]">
              Powered by UST
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase text-emerald-200/80">
                Best Day
              </div>
              <div className="text-base font-black text-emerald-300">
                +{currency(Number(calendarStats.bestDay.toFixed(2)))}
              </div>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <div className="text-[10px] uppercase text-rose-200/80">
                Worst Day
              </div>
              <div className="text-base font-black text-rose-300">
                {currency(Number(calendarStats.worstDay.toFixed(2)))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden gap-5 md:grid xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-700/70 bg-[#07111f] p-3 sm:p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] overflow-x-auto overscroll-x-contain">
          <div className="min-w-[760px] sm:min-w-0">
            <div className="grid grid-cols-7 text-xs font-bold uppercase tracking-wider text-slate-300">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="p-2 text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-2">
              {days.map((d, i) => {
                const k = keyOf(d);
                const inMonth = d.getMonth() === viewMonth;
                const isToday = k === todayKey;
                const day = calendarStats.byDay.get(k);
                const dayPnl = day?.pnl || 0;
                const hasActivity =
                  !!day && (day.trades > 0 || day.withdrawals > 0 || day.deposits > 0);
                const winRate = day?.trades ? (day.wins / day.trades) * 100 : 0;
                const pct =
                  startBalance > 0 ? (dayPnl / startBalance) * 100 : 0;

                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedKey(k)}
                    className={[
                      "min-h-[112px] sm:min-h-[118px] rounded-xl border border-slate-800 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#F6C945]/55",
                      heatClass(dayPnl, hasActivity),
                      inMonth ? "opacity-100" : "opacity-35",
                      isToday
                        ? "ring-2 ring-[#F6C945]/80 shadow-[0_0_26px_rgba(246,201,69,0.20)]"
                        : "",
                      selectedKey === k
                        ? "border-[#F6C945]/80 ring-1 ring-[#F6C945]/45"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-slate-100">
                        {d.getDate()}
                      </span>
                      {hasActivity && (
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            dayPnl > 0
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                              : dayPnl < 0
                                ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.7)]"
                                : "bg-slate-400",
                          ].join(" ")}
                        />
                      )}
                    </div>

                    {hasActivity ? (
                      <div className="mt-4 space-y-1.5">
                        <div
                          className={`text-base sm:text-lg font-extrabold ${pnlTone(dayPnl)}`}
                        >
                          {dayPnl >= 0 ? "+" : ""}
                          {currency(Number(dayPnl.toFixed(2)))}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>{day?.trades || 0} trades</span>
                          <span>{winRate.toFixed(0)}% WR</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={
                              dayPnl >= 0
                                ? "h-full bg-emerald-400"
                                : "h-full bg-rose-400"
                            }
                            style={{
                              width: `${Math.min(100, Math.max(8, Math.abs(pct)))}%`,
                            }}
                          />
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          {dayPnl >= 0 ? "+" : ""}
                          {pct.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <div className="mt-8 text-xs text-slate-500">
                        No trades
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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
                  <p className="text-sm text-slate-400">
                    {new Date(`${selectedKey}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </p>
                  <p
                    className={`mt-1 text-3xl font-black ${pnlTone(selectedDay.pnl)}`}
                  >
                    {selectedDay.pnl >= 0 ? "+" : ""}
                    {currency(Number(selectedDay.pnl.toFixed(2)))}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <span className="text-slate-400">Trades</span>
                    <strong className="block text-slate-100">
                      {selectedDay.trades}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <span className="text-slate-400">Win Rate</span>
                    <strong className="block text-slate-100">
                      {selectedDay.trades
                        ? (
                            (selectedDay.wins / selectedDay.trades) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <span className="text-slate-400">Best Trade</span>
                    <strong className="block text-emerald-300">
                      {currency(
                        Number(
                          Math.max(
                            0,
                            ...selectedDay.items.map((t) => Number(t.pnl || 0)),
                          ).toFixed(2),
                        ),
                      )}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <span className="text-slate-400">Worst Trade</span>
                    <strong className="block text-rose-300">
                      {currency(
                        Number(
                          Math.min(
                            0,
                            ...selectedDay.items.map((t) => Number(t.pnl || 0)),
                          ).toFixed(2),
                        ),
                      )}
                    </strong>
                  </div>
                </div>

                {selectedDay.deposits > 0 && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    Deposit: +
                    {currency(Number(selectedDay.deposits.toFixed(2)))}
                  </div>
                )}

                {selectedDay.withdrawals > 0 && (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    Withdrawal: -
                    {currency(Number(selectedDay.withdrawals.toFixed(2)))}
                  </div>
                )}

                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {selectedDay.items.slice(0, 12).map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {t.symbol || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.ts
                            ? new Date(t.ts).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>
                      <div
                        className={`font-extrabold ${pnlTone(Number(t.pnl || 0))}`}
                      >
                        {Number(t.pnl || 0) >= 0 ? "+" : ""}
                        {currency(Number(Number(t.pnl || 0).toFixed(2)))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400">
                Click any calendar day to review its trades, win rate, best
                trade and worst trade.
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
                const pnl = keys.reduce(
                  (sum, key) => sum + (calendarStats.byDay.get(key)?.pnl || 0),
                  0,
                );
                const tradesCount = keys.reduce(
                  (sum, key) =>
                    sum + (calendarStats.byDay.get(key)?.trades || 0),
                  0,
                );
                const wins = keys.reduce(
                  (sum, key) => sum + (calendarStats.byDay.get(key)?.wins || 0),
                  0,
                );
                const wr = tradesCount ? (wins / tradesCount) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-300">
                        Week {idx + 1}
                      </span>
                      <span className={`font-extrabold ${pnlTone(pnl)}`}>
                        {pnl >= 0 ? "+" : ""}
                        {currency(Number(pnl.toFixed(2)))}
                      </span>
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

function CalendarMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "blue" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300 border-emerald-400/25 bg-emerald-500/10"
      : tone === "bad"
        ? "text-rose-300 border-rose-400/25 bg-rose-500/10"
        : tone === "blue"
          ? "text-blue-300 border-blue-400/25 bg-blue-500/10"
          : "text-slate-100 border-slate-700 bg-slate-950/35";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function DashboardSyncButton({
  addTradesBulkFn,
}: {
  addTradesBulkFn: (rows: TradeRow[]) => void;
}) {
  const { runImport, lastSync } = useSheetsImporter(addTradesBulkFn);
  const [syncing, setSyncing] = React.useState(false);
  const toast = useToast();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={syncing}
      onClick={async () => {
        setSyncing(true);
        try {
          const result = await runImport();
          toast?.push({
            title: result?.ok ? "Trades refreshed" : "Sync needs attention",
            desc: result?.ok
              ? `Imported ${result.imported} new • Blocked ${result.blocked} duplicate${result.blocked === 1 ? "" : "s"}`
              : "Please check the Sync Control Panel in the Journal.",
          });
        } finally {
          setSyncing(false);
        }
      }}
      className="rounded-lg border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-2 text-xs font-bold text-[#F6C945] hover:bg-[#D4AF37]/20"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Refreshing" : "Refresh Trades"}
    </Button>
  );
}

function RiskCalculatorSelector({
  active,
  setActive,
}: {
  active: string;
  setActive: (v: string) => void;
}) {
  const options = [
    {
      value: "risk-deriv",
      label: "Deriv Calculator",
      desc: "Synthetic indices",
    },
    { value: "risk-fx", label: "FX Calculator", desc: "Currency pairs" },
    {
      value: "risk-majors",
      label: "XAU / NAS Calculator",
      desc: "Gold, indices & BTC",
    },
  ];

  return (
    <Card className="border-[#D4AF37]/30 bg-gradient-to-br from-[#0b1220] to-[#111827] text-slate-100">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F6C945]">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Risk Calculator
            </h3>
            <p className="text-xs text-slate-400">
              Choose the calculator that matches the market you are trading.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setActive(o.value)}
              className={`rounded-xl border p-3 text-left transition ${
                active === o.value
                  ? "border-[#D4AF37] bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20"
                  : "border-slate-700 bg-slate-950/50 text-slate-100 hover:border-[#D4AF37]/60"
              }`}
            >
              <div className="text-sm font-black">{o.label}</div>
              <div
                className={`text-xs ${active === o.value ? "text-black/70" : "text-slate-400"}`}
              >
                {o.desc}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   Auto-Import panel (FIXED to receive the bulk adder via props)
============================================================================ */
function AutoImportPanel({
  addTradesBulkFn,
  onRemoveDuplicates,
}: {
  addTradesBulkFn: (rows: TradeRow[]) => void;
  onRemoveDuplicates?: () => void;
}) {
  const {
    enabled,
    setEnabled,
    account,
    setAccount,
    since,
    setSince,
    lastSync,
    runImport,
    lastImported,
    lastBlocked,
    lastError,
  } = useSheetsImporter(addTradesBulkFn);

  // Manual backfill/import range. This allows old trades to be pulled even after auto-sync has moved forward.
  const [manualFrom, setManualFrom] = React.useState<string>(since || "");
  const [manualTo, setManualTo] = React.useState<string>("");
  const [manualImporting, setManualImporting] = React.useState(false);
  const [manualResult, setManualResult] = React.useState<{
    imported: number;
    blocked: number;
  } | null>(null);

  async function runManualImport() {
    if (!SHEETS_URL || !SHEETS_TOKEN || !account) return;

    setManualImporting(true);
    setManualResult(null);

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
      const existingKeys = new Set(existing.map(tradeUniqueKey));

      const freshRows: TradeRow[] = [];
      let blocked = 0;

      for (const row of rows) {
        const key = tradeUniqueKey(row);
        if (existingKeys.has(key)) {
          blocked++;
          continue;
        }
        existingKeys.add(key);
        freshRows.push(row);
      }

      const deduped = dedupeTrades(freshRows);
      blocked += deduped.removed;

      if (deduped.unique.length) {
        addTradesBulkFn(deduped.unique);
      }

      localStorage.setItem("ust:lastSync", JSON.stringify(Date.now()));
      localStorage.setItem(
        "ust:lastImportedCount",
        JSON.stringify(deduped.unique.length),
      );
      localStorage.setItem("ust:lastDuplicateBlocked", JSON.stringify(blocked));

      setManualResult({ imported: deduped.unique.length, blocked });
    } catch (e) {
      console.warn("Manual import failed:", e);
    } finally {
      setManualImporting(false);
    }
  }

  const syncHealthy = enabled && !lastError;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-slate-100">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-[#F6C945]">
              Sync Control Panel
            </div>
            <div className="text-xs text-slate-400">
              Monitor imports, block duplicates, and clean the journal if
              needed.
            </div>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${
              syncHealthy
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-400/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {syncHealthy ? "Healthy" : "Needs Attention"}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Last Sync
            </div>
            <div className="mt-1 text-sm font-black text-white">
              {lastSync ? new Date(lastSync).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Imported
            </div>
            <div className="mt-1 text-xl font-black text-emerald-300">
              {lastImported}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Duplicates Blocked
            </div>
            <div className="mt-1 text-xl font-black text-[#F6C945]">
              {lastBlocked}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Auto Sync
            </div>
            <div className="mt-1 text-sm font-black text-white">
              {enabled ? "ON" : "OFF"}
            </div>
          </div>
        </div>

        {lastError ? (
          <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {lastError}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={runImport}
            className="bg-[#D4AF37] text-black hover:bg-yellow-400"
          >
            Force Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRemoveDuplicates}
            className="border-slate-600 text-slate-100 hover:bg-slate-800"
          >
            Remove Duplicate Trades
          </Button>
        </div>
      </div>

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
          <button
            onClick={runImport}
            className="w-full border rounded px-3 py-1"
          >
            Import Now
          </button>
        </div>

        <div className="md:col-span-2 text-xs text-slate-500">
          Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
        </div>
      </div>

      <div className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3">
        <div className="text-sm font-semibold mb-2">
          Manual Import / Backfill by Date
        </div>
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

        {manualResult ? (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-2 text-xs text-slate-200">
            Imported {manualResult.imported} new trade
            {manualResult.imported === 1 ? "" : "s"} • Blocked{" "}
            {manualResult.blocked} duplicate
            {manualResult.blocked === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageClientWrapper;
