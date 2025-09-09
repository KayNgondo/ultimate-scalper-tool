"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // When user lands here from email, Supabase sets a "recovery" session.
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      // If there's no session, user opened the page directly.
      setReady(true);
      if (!data.session) {
        // Optional: show a hint to click the email link again.
      }
    }
    checkSession();
  }, [supabase]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        alert(error.message);
        return;
      }
      alert("Password updated. You can now sign in.");
      window.location.href = "/sign-in";
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Set a new password</h1>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button
            className="w-full rounded-md bg-indigo-600 text-white py-2 font-semibold disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Saving..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
