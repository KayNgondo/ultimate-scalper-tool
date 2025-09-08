// app/layout.tsx (SERVER)
import dynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Import the client wrapper with SSR disabled:
const RootClient = dynamic(() => import("./RootClient"), { ssr: false });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootClient>{children}</RootClient>
      </body>
    </html>
  );
}
