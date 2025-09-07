"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseUser } from "@/lib/useSupabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  if (loading || !user) return null; // or a spinner
  return <>{children}</>;
}
