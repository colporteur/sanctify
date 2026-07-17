"use client";
// Trends v1: score history bars + weight line. Full analytics (domain stacks,
// heatmaps, correlations) land in Phase 2.
import { useEffect, useState } from "react";

interface DayRow {
  date: string;
  lifeScore: number | null;
  provisional: boolean;
  profileVersion: number;
}

export default function Trends() {
  const [rows, setRows] = useState<DayRow[] | null>(null);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((r: DayRow[]) => setRows(r.sort((a, b) => a.date.localeCompare(b.date))));
  }, []);

  if (!rows) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  const scored = rows.filter((r) => r.lifeScore != null);
  const avg7 =
    scored.slice(-7).reduce((a, r) => a + (r.lifeScore ?? 0), 0) / Math.max(1, Math.min(7, scored.length));

  return (
    <main className="px-4 pt-6 space-y-5">
      <h1 className="text-lg font-semibold">📈 Trends</h1>
      {scored.length === 0 ? (
        <p className="text-sm text-zinc-500">No scored days yet — your history starts today.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4">
            <div className="text-xs text-zinc-500 mb-1">7-day average</div>
            <div className="text-3xl font-bold text-emerald-400">{Math.round(avg7)}</div>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-1.5">
            <div className="text-xs text-zinc-500 mb-2">Last 30 days</div>
            {rows.map((r) => (
              <div key={r.date} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 w-16 tabular-nums">{r.date.slice(5)}</span>
                <div className="flex-1 h-3 rounded bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded ${r.provisional ? "bg-amber-500/70" : "bg-emerald-500"}`}
                    style={{ width: `${r.lifeScore ?? 0}%` }}
                  />
                </div>
                <span className="text-xs w-8 text-right tabular-nums text-zinc-300">
                  {r.lifeScore == null ? "–" : Math.round(r.lifeScore)}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-zinc-600 pt-2">
              Amber = calibration (provisional). Full charts — domain breakdowns, heatmaps, patterns —
              arrive in Phase 2.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
