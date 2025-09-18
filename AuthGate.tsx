"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseUser } from "@/lib/useSupabaseUser";

// Add any public routes here
const PUBLIC_ROUTES = ["/sign-in"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser();
  const pathname = usePathname() || "/";
  const router = useRouter();

  const isPublic = useMemo(
    () => PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p)),
    [pathname]
  );

  useEffect(() => {
    if (isPublic) return;      // allowed
    if (loading) return;       // still checking
    if (!user) {
      // Fallback to a hard redirect to handle any router edge cases
      if (typeof window !== "undefined") {
        window.location.replace("/sign-in");
      } else {
        router.replace("/sign-in");
      }
    }
  }, [isPublic, loading, user, router]);

  // Hide protected content while we check/redirect
  if (!isPublic && (loading || !user)) return null;

  return <>{children}</>;
}
