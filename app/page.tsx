// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import PageClient from "./PageClient"; // your existing dashboard UI component

export default function HomePage() {
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data?.session) {
        // Not signed in -> go to sign-in
        window.location.replace("/sign-in");
      } else {
        setReady(true);
      }
    });
    return () => { mounted = false; };
  }, [supabase]);

  if (!ready) return null; // or a small spinner
  return <PageClient />;
}
