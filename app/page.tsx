// app/page.tsx
import dynamic from "next/dynamic";

// prevent server rendering for this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

// import client-only component
const PageClient = dynamic(() => import("./PageClient"), { ssr: false });

export default function Page() {
  return <PageClient />;
}
