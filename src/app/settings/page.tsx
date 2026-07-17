"use client";
import { useEffect, useState } from "react";

export default function Settings() {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((c) => setMode(c.user?.mode ?? "calibration"));
  }, []);

  async function setModeRemote(m: "calibration" | "production") {
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mode", mode: m }),
    });
    setMode(m);
  }

  if (!mode) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  return (
    <main className="px-4 pt-6 space-y-5">
      <h1 className="text-lg font-semibold">⚙️ Settings</h1>

      <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
        <div className="text-sm font-medium">Mode</div>
        <p className="text-xs text-zinc-500">
          Calibration: scores are provisional and you can re-tune weights freely (weeks 1–2).
          Production: profiles version forward-only and streaks/XP count.
        </p>
        <div className="flex gap-2">
          {(["calibration", "production"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModeRemote(m)}
              className={`flex-1 rounded-xl py-2.5 text-sm border ${
                mode === m ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-700 text-zinc-400"
              }`}
            >
              {m === "calibration" ? "🧪 Calibration" : "🚀 Production"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-2">
        <div className="text-sm font-medium">Coming soon</div>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>🔔 Push reminders (evening review 10 PM with snooze, morning meds, weekly Ozempic)</li>
          <li>🩸 Dexcom connection (time-in-range auto-scoring)</li>
          <li>📷 Meal-photo AI scoring</li>
          <li>🤖 Weekly AI coach review</li>
          <li>📤 Data export (CSV/JSON)</li>
        </ul>
      </section>
    </main>
  );
}
