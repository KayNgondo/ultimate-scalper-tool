"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseUser } from "@/lib/useSupabaseUser";

// Pages that should remain public (add more if needed)
const PUBLIC_ROUTES = ["/sign-in"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p));

  useEffect(() => {
    if (loading) return; // still checking auth
    if (!user && !isPublic) {
      router.replace("/sign-in");
    }
  }, [loading, user, isPublic, router]);

  // While checking auth or redirecting, render nothing for protected pages
  if (!isPublic && (loading || !user)) return null;

  return <>{children}</>;
}
