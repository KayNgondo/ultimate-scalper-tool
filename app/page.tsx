// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function HomePage() {
  const supabase = getBrowserSupabase();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!mounted) return;
        if (!data.session) {
          // Not signed in -> go to sign-in
          window.location.replace("/sign-in");
        } else {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  return ready ? <div>Dashboard content here</div> : null;
}
