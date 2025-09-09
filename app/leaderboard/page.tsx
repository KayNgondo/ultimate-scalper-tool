// app/leaderboard/page.tsx
import Link from "next/link";

export default function LeaderboardPage() {
  return (
    <main className="container mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Leaderboard</h1>
      <p className="text-muted-foreground">
        The leaderboard page is wired up and reachable. We’ll plug in Supabase data next.
      </p>
    </main>
  );
}
