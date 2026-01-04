"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // <-- adjust if your path differs

const ADMIN_UUID = "39127777-9fd8-4183-96bf-03f943b56a24";
const BUCKET = "ust-watchlist";

type WatchlistRow = {
  id: string;
  created_at: string;
  watchlist_date: string;
  title: string | null;
  primary_focus: string;
  monitor_list: string | null;
  image_urls: string[];
  created_by: string | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function WatchlistPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<{ id: string } | null>(null);
  const isAdmin = useMemo(() => me?.id === ADMIN_UUID, [me?.id]);

  const [latest, setLatest] = useState<WatchlistRow | null>(null);

  // Form
  const [watchlistDate, setWatchlistDate] = useState<string>(todayISO());
  const [title, setTitle] = useState<string>("Daily Watchlist");
  const [primaryFocus, setPrimaryFocus] = useState<string>("");
  const [monitorList, setMonitorList] = useState<string>("");
  const [files, setFiles] = useState<FileList | null>(null);

  async function loadMe() {
    const { data } = await supabase.auth.getUser();
    setMe(data.user ? { id: data.user.id } : null);
  }

  async function loadLatest() {
    setError(null);
    const { data, error } = await supabase
      .from("ust_watchlist")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setError(error.message);
      setLatest(null);
      return;
    }
    setLatest((data?.[0] as WatchlistRow) ?? null);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMe();
      await loadLatest();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadScreenshots(date: string, f: FileList): Promise<string[]> {
    const urls: string[] = [];

    for (let i = 0; i < f.length; i++) {
      const file = f[i];
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `watchlists/${date}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("Could not build public URL for upload.");

      urls.push(pub.publicUrl);
    }

    return urls;
  }

  async function saveWatchlist() {
    setError(null);

    if (!isAdmin) {
      setError("Only the UST admin can post the watchlist.");
      return;
    }
    if (!primaryFocus.trim()) {
      setError("Primary Focus is required.");
      return;
    }

    setSaving(true);
    try {
      // Upload screenshots (optional)
      const newUrls = files ? await uploadScreenshots(watchlistDate, files) : [];
      const mergedUrls = [...(latest?.image_urls ?? []), ...newUrls];

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Upsert by watchlist_date (requires the unique index we added)
      const { error: dbErr } = await supabase
        .from("ust_watchlist")
        .upsert(
          {
            watchlist_date: watchlistDate,
            title,
            primary_focus: primaryFocus,
            monitor_list: monitorList || null,
            image_urls: mergedUrls,
            created_by: userId,
          },
          { onConflict: "watchlist_date" }
        );

      if (dbErr) throw new Error(dbErr.message);

      setFiles(null);
      await loadLatest();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save watchlist.");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(url: string) {
    if (!isAdmin || !latest) return;

    setSaving(true);
    setError(null);
    try {
      const next = latest.image_urls.filter((u) => u !== url);

      const { error: dbErr } = await supabase
        .from("ust_watchlist")
        .update({ image_urls: next })
        .eq("id", latest.id);

      if (dbErr) throw new Error(dbErr.message);

      await loadLatest();
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove image.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm opacity-80">Loading watchlist…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Daily Watchlist</h2>
          <p className="text-sm opacity-80">
            Updated by the UST admin — everyone sees the same latest plan.
          </p>
        </div>
        <button
          onClick={loadLatest}
          className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}

      {/* PUBLIC VIEW (everyone) */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="text-sm opacity-80">
          Latest update:{" "}
          <span className="opacity-100">
            {latest?.watchlist_date ?? "—"}
          </span>
        </div>

        <div className="text-lg font-semibold">{latest?.title ?? "No watchlist posted yet."}</div>

        {latest?.primary_focus && (
          <div>
            <div className="text-sm font-semibold opacity-90">Primary Focus</div>
            <div className="whitespace-pre-wrap text-sm opacity-90">{latest.primary_focus}</div>
          </div>
        )}

        {latest?.monitor_list && (
          <div>
            <div className="text-sm font-semibold opacity-90">Monitor List</div>
            <div className="whitespace-pre-wrap text-sm opacity-90">{latest.monitor_list}</div>
          </div>
        )}

        {!!latest?.image_urls?.length && (
          <div>
            <div className="text-sm font-semibold opacity-90 mb-2">Screenshots</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latest.image_urls.map((u) => (
                <div key={u} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <img src={u} alt="Watchlist screenshot" className="w-full rounded-md" />
                  {isAdmin && (
                    <button
                      onClick={() => removeImage(u)}
                      className="mt-2 text-xs px-3 py-1 rounded-md border border-white/10 hover:border-white/20"
                      disabled={saving}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADMIN EDITOR (only you) */}
      {isAdmin && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="text-sm font-semibold opacity-90">Admin Editor</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-80 mb-1">Watchlist Date</div>
              <input
                type="date"
                value={watchlistDate}
                onChange={(e) => setWatchlistDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10"
              />
            </div>

            <div>
              <div className="text-xs opacity-80 mb-1">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10"
                placeholder="Daily Watchlist"
              />
            </div>
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">Primary Focus (required)</div>
            <textarea
              value={primaryFocus}
              onChange={(e) => setPrimaryFocus(e.target.value)}
              className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-black/30 border border-white/10"
              placeholder="• V50 — M1 sells, quick BE…"
            />
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">Monitor List (optional)</div>
            <textarea
              value={monitorList}
              onChange={(e) => setMonitorList(e.target.value)}
              className="w-full min-h-[90px] px-3 py-2 rounded-lg bg-black/30 border border-white/10"
              placeholder="• V75 — wait for clean break…"
            />
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">Upload screenshots (optional)</div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full text-sm"
            />
            <div className="text-xs opacity-70 mt-1">
              Tip: You can upload multiple charts (watchlist + monitor list).
            </div>
          </div>

          <button
            onClick={saveWatchlist}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
          >
            {saving ? "Saving…" : "Post / Update Watchlist"}
          </button>
        </div>
      )}
    </div>
  );
}
