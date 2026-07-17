"use client";
// Evening review: sweep everything unlogged, confirm the day.
import { useEffect, useState } from "react";
import { fetchDay, type DayData } from "@/lib/client";
import type { DayScore } from "@/lib/types";
import ItemRow from "@/components/ItemRow";
import ScoreRing from "@/components/ScoreRing";

export default function Review() {
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    fetchDay().then(setData);
  }, []);

  if (!data) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  const onDay = (d: DayScore) => setData({ ...data, day: d });
  const unlogged = data.items.filter(
    (i) => i.shape !== "checklist" && !data.logs.some((l) => l.itemId === i.id)
  );
  const undoneCleaning = data.cleaningTasks.filter(
    (t) => !data.cleaningLogs.some((l) => l.taskId === t.id && (l.done || l.na))
  );

  return (
    <main className="px-4 pt-6 space-y-5">
      <header className="text-center space-y-1">
        <h1 className="text-lg font-semibold">🌙 Evening Review</h1>
        <p className="text-xs text-zinc-500">
          {unlogged.length + undoneCleaning.length === 0
            ? "Everything's logged. Well done."
            : `${unlogged.length + undoneCleaning.length} thing${
                unlogged.length + undoneCleaning.length === 1 ? "" : "s"
              } to confirm before the day closes at 3 AM.`}
        </p>
        <div className="pt-2">
          <ScoreRing score={data.day.lifeScore} size={110} stroke={8} label="so far" />
        </div>
      </header>

      {unlogged.length > 0 && (
        <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-2 divide-y divide-zinc-800/60">
          {unlogged.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              log={undefined}
              date={data.date}
              onDay={onDay}
            />
          ))}
        </section>
      )}

      {undoneCleaning.length > 0 && (
        <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-3">
          <div className="text-sm mb-1">🧹 Still due today</div>
          <div className="text-xs text-zinc-400 space-y-1">
            {undoneCleaning.map((t) => (
              <div key={t.id}>
                {t.area}: {t.task} <span className="text-zinc-600">(check off on Today)</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-zinc-600 pb-4">
        Unlogged limit items (soda, hours) score as zero consumption — only confirm what actually happened.
      </p>
    </main>
  );
}
