// app/page.tsx
"use client";

import dynamicImport from "next/dynamic";

// Load the real page client-side only (no server render)
const PageClient = dynamicImport(() => import("./PageClient"), { ssr: false });

export default function Page() {
  return <PageClient />;
}
