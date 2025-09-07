"use client";

import { useEffect } from "react";
import { subscribeToUserTrades } from "@/lib/realtime";
import { useSupabaseUser } from "@/lib/useSupabaseUser";

/** Re-subscribe whenever the user id or refetch changes */
export function useLiveTrades(refetch: () => void) {
  const { user } = useSupabaseUser();

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToUserTrades(user.id, () => refetch());
    return unsub;
  }, [user?.id, refetch]);
}
