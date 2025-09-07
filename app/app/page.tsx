"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useSupabaseUser } from "@/lib/useSupabase";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [loadingOut, setLoadingOut] = useState(false);

  async function handleSignOut() {
    setLoadingOut(true);
    await supabase.auth.signOut();
    setLoadingOut(false);
    router.push("/sign-in");
  }

  return (
    <AuthGate>
      <div style={{ maxWidth: 1200, margin: "40px auto", padding: "0 16px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>
            Ultimate Scalper Tool – Strategy Console
          </h1>
          <button
            onClick={handleSignOut}
            disabled={loadingOut}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
            }}
          >
            {loadingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        {/* Example dashboard layout — replace with your existing cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <Card title="Win rate">0.00% (0W / 0L / 0BE)</Card>
          <Card title="PNL (this session)">$0.00</Card>
          <Card title="Sessions">5 (Silver – 5 Sessions Survived)</Card>
          <Card title="Equity">$2,377.52</Card>
          <Card title="Starting Capital">$1,494.59</Card>
          <Card title="All-time PnL">+882.93</Card>
          <Card title="All-time Growth">59.08%</Card>
        </div>

        {/* Example goals section */}
        <section
          style={{
            marginTop: 32,
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
            Goals
          </h2>
          <p>Weekly Target: $1000</p>
          <p>Monthly Target: $4500</p>
          <div style={{ marginTop: 12 }}>
            <progress value={882.93} max={1000} style={{ width: "100%" }} />
            <small>Weekly Progress: $882.93 / $1000</small>
          </div>
          <div style={{ marginTop: 12 }}>
            <progress value={882.93} max={4500} style={{ width: "100%" }} />
            <small>Monthly Progress: $882.93 / $4500</small>
          </div>
        </section>
      </div>
    </AuthGate>
  );
}

// Simple card component for stats
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
      }}
    >
      <h3 style={{ fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 20 }}>{children}</p>
    </div>
  );
}
