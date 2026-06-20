'use client';

import { useEffect, useState } from 'react';
import useSupabase from './supabase';

export function useSupabaseUser() {
  const supabase = useSupabase();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionData?.session?.user) {
        setUser(sessionData.session.user);
      } else {
        const { data: userData } = await supabase.auth.getUser();
        setUser(userData?.user ?? null);
      }

      setLoading(false);
    }

    loadUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, [supabase]);

  return { user, loading };
}

export default useSupabaseUser;
