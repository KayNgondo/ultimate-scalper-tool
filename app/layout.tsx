// app/layout.tsx
import "./globals.css";
import React from "react";
import { createServerSupabase } from "@/lib/supabase/server";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
