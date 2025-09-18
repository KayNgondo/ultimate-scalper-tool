// app/RootClient.tsx
"use client";

// Put any client-side providers/components here (ThemeProvider, Toaster, etc.)
// Import your globals.css here (CSS can be in layout too; either is fine)

type Props = { children: React.ReactNode };
export default function RootClient({ children }: Props) {
  return <>{children}</>;
}
