// Simple auth hook built on Supabase
"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useSupabaseUser() {
  const [user, setUser] = useState<ReturnType<typeof supabase.auth.getUser> extends Promise<infer _T> ? any : any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
