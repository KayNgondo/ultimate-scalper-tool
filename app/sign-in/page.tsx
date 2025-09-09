"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser"; // your browser helper

export default function SignInPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // used on sign up
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
        return;
      }
      // success -> Next.js middleware/route will redirect to /
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // ✅ ONLY pass the name in metadata; DO NOT insert into profiles here.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // this is read by the DB trigger: raw_user_meta_data->>'name'
          data: { name: name?.trim() || "Trader" },
          emailRedirectTo: `${window.location.origin}/reset`, // optional (also used for password recovery)
        },
      });

      if (error) {
        alert(error.message);
        return;
      }

      // If email confirmations are ON, Supabase sends a confirmation email.
      // If OFF, user is signed in immediately.
      if (!data.session) {
        alert("Check your inbox to confirm your email, then sign in.");
      } else {
        window.location.href = "/";
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      alert("Enter your email first, then click Forgot password.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) {
        alert(error.message);
        return;
      }
      alert("Password reset email sent. Please check your inbox.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">{mode === "sign-in" ? "Sign in" : "Create Account"}</h1>
        <p className="text-slate-600 mb-6">
          Use your email and password to access Ultimate Scalper Tool.
        </p>

        <form onSubmit={mode === "sign-in" ? handleSignIn : handleSignUp} className="space-y-4">
          {mode === "sign-up" && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === "sign-in" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-indigo-600 hover:underline"
                disabled={busy}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 text-white py-2 font-semibold disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Loading..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          {mode === "sign-in" ? (
            <>
              Don&apos;t have an account?{" "}
              <button className="text-indigo-600 hover:underline" onClick={() => setMode("sign-up")}>
                Create account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="text-indigo-600 hover:underline" onClick={() => setMode("sign-in")}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-xs text-rose-600">
          Anonymous sign-ins are disabled
        </div>

        <div className="mt-2 text-xs text-slate-500">
          After signing in you’ll be redirected to the dashboard <code>/</code>.
        </div>
      </div>
    </div>
  );
}
