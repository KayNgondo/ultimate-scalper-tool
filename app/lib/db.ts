// lib/db.ts
import { supabase } from "./supabase";

// Insert a trade (must pass the current user's id due to RLS)
export async function addTrade({
  userId,
  symbol,
  notes,
  pnl,
}: {
  userId: string;
  symbol: string;
  notes: string;
  pnl: number;
}) {
  const { data, error } = await supabase
    .from("trades")
    .insert([{ user_id: userId, symbol, notes, pnl }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTrades() {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("ts", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getGoals() {
  const { data, error } = await supabase.from("goals").select("*").single();
  // If no row yet, that's fine — return defaults.
  if (error && error.code !== "PGRST116") throw error;
  return data ?? { weekly_target: 0, monthly_target: 0 };
}

export async function upsertGoals({
  userId,
  weekly_target,
  monthly_target,
}: {
  userId: string;
  weekly_target: number;
  monthly_target: number;
}) {
  const { data, error } = await supabase
    .from("goals")
    .upsert(
      [{ user_id: userId, weekly_target, monthly_target }],
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
