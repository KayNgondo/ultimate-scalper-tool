"use client";

import { useSupabaseUser } from "@/lib/useSupabaseUser";
import AuthGate from "@/components/AuthGate";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
   Tiny Toast system
----------------------------------- */
type ToastItem = { id: string; title: string; desc?: string };
const ToastContext = React.createContext<{
  push: (t: Omit<ToastItem, "id">) => void;
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  function push(t: Omit<ToastItem, "id">) {
    const id = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
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
            className="rounded-lg border bg-white shadow px-3 py-2 w-72"
          >
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc && (
              <div className="text-xs text-slate-600 mt-0.5">{t.desc}</div>
            )}
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
   Ultimate Scalper Tool Page
=========================================================== */

type TradeRow = {
  id: string;
  symbol: string;
  pnl: number;
  notes?: string;
  ts?: number;
};

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

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
      body: JSON.stringify({ userId: supabaseUserId, pnl, startedAt: startedAtISO, endedAt: endedAtISO }),
    });
  } catch (e) {
    console.error("Failed to insert session:", e);
  }
}

export default function Page() {
  return (
    <ToastProvider>
      <AuthGate>
        <PageInner />
      </AuthGate>
    </ToastProvider>
  );
}

function PageInner() {
  const { user } = useSupabaseUser();
  const { push } = useToast();

  const [startBalance, setStartBalance] = useLocalStorage("ust-start-balance", 1000);
  const [trades, setTrades] = useLocalStorage<TradeRow[]>("ust-trades", []);
  const [sessionId, setSessionId] = useLocalStorage<string | null>("ust-session-id", null);

  const pnl = useMemo(
    () => trades.reduce((a, t) => a + (t.pnl || 0), 0),
    [trades]
  );

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ultimate Scalper Tool</h1>
        <Button
          onClick={async () => {
            try {
              if (!user?.id) return;
              const startedAtISO = new Date(Number(sessionId || Date.now())).toISOString();
              const endedAtISO = new Date().toISOString();
              await recordSessionToLeaderboard(user.id, pnl, startedAtISO, endedAtISO);
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
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <a
            href="/leaderboard"
            className="px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            Leaderboard
          </a>
        </TabsList>

        <TabsContent value="dashboard">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold">Dashboard</h3>
              <p>Your current equity: {currency(startBalance + pnl)}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
