// app/sign-in/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

<button
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  }}
  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
>
  Sign out
</button>

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace(redirectTo);
  }

  async function signUp() {
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Immediately try to sign in (or you can ask to verify email, depending on your Supabase settings)
    await signIn();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-slate-600">
          Use your email and password to access Ultimate Scalper Tool.
        </p>

        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          className="mb-3 w-full rounded-md border px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          className="mb-4 w-full rounded-md border px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {err && <div className="mb-3 text-sm text-rose-600">{err}</div>}

        <div className="flex gap-2">
          <button
            onClick={signIn}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button
            onClick={signUp}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Create account
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          After signing in you’ll be redirected to <code>{redirectTo}</code>.
        </p>
      </div>
    </div>
  );
}
