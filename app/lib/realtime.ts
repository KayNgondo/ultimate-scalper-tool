// /lib/realtime.ts
// Lightweight helpers for Supabase Realtime in the browser.
// Works with the public browser client from `@/lib/supabase`.

import { supabase } from "@/lib/supabase";

/** Call this to stop listening (e.g., in a React effect cleanup). */
export type Unsubscribe = () => void;

/** Generic INSERT subscription helper */
export function subscribeToInserts<T extends Record<string, unknown>>(
  table: string,
  onInsert: (row: T) => void,
  opts?: { schema?: string; filter?: string }
): Unsubscribe {
  const schema = opts?.schema ?? "public";
  // Channel name kept stable-ish per table to avoid duplicates
  const channel = supabase
    .channel(`rt:${schema}.${table}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema,
        table,
        ...(opts?.filter ? { filter: opts.filter } : {}),
      },
      (payload) => {
        // payload.new is the inserted row
        onInsert(payload.new as T);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Convenience: subscribe to *your* trades only */
export type TradeRow = {
  id: string;
  user_id: string;
  ts: string; // timestamptz as ISO
  symbol: string;
  pnl: number | null;
  notes: string | null;
};

export function subscribeToUserTrades(
  userId: string,
  onInsert: (row: TradeRow) => void
): Unsubscribe {
  if (!userId) return () => {};
  return subscribeToInserts<TradeRow>("trades", onInsert, {
    filter: `user_id=eq.${userId}`,
  });
}

/** Optional: subscribe to your raw MT5 deals (if you want a live "deals" view) */
export type Mt5DealRow = {
  deal_id: string;
  user_id: string;
  order_id: string | null;
  position_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  time: string; // timestamptz as ISO
  pnl: number | null;
  note: string | null;
};

export function subscribeToUserMt5Deals(
  userId: string,
  onInsert: (row: Mt5DealRow) => void
): Unsubscribe {
  if (!userId) return () => {};
  return subscribeToInserts<Mt5DealRow>("mt5_deals", onInsert, {
    filter: `user_id=eq.${userId}`,
  });
}
