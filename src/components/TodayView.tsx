"use client";
import { useEffect, useState } from "react";
import { fetchDay, postLog, type DayData } from "@/lib/client";
import type { DayScore, LimitConfig } from "@/lib/types";
import ScoreRing from "./ScoreRing";
import ItemRow from "./ItemRow";
import Timers from "./Timers";

export default function TodayView() {
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    fetchDay().then(setData);
  }, []);

  if (!data) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  const { date, domains, items, logs, cleaningTasks, cleaningLogs } = data;
  const day = data.day;
  const onDay = (d: DayScore) => setData({ ...data, day: d });

  // hour-limit items are rendered as timers; everything else as rows
  const isTimerItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    return it?.shape === "limit" && (it.config as LimitConfig).unit === "h";
  };

  return (
    <main className="px-4 pt-6 space-y-5">
      <header className="flex flex-col items-center gap-1">
        <ScoreRing score={day.lifeScore} label="Life Score" />
        <div className="text-xs text-zinc-500">
          {date}
          {day.provisional && (
            <span className="ml-2 rounded bg-amber-900/50 text-amber-300 px-1.5 py-0.5">calibration</span>
          )}
        </div>
      </header>

      <Timers items={items} logs={logs} date={date} onDay={onDay} />

      {domains.map((domain) => {
        const dItems = items.filter((i) => i.domainId === domain.id && !isTimerItem(i.id));
        const dScore = day.domains.find((d) => d.domainId === domain.id)?.score ?? null;
        if (dItems.length === 0 && domain.id !== "home") return null;
        return (
          <section key={domain.id} className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-2">
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
              <h2 className="text-sm font-medium">
                {domain.icon} {domain.name}
              </h2>
              <span className="text-sm font-semibold text-zinc-300">
                {dScore == null ? "–" : Math.round(dScore)}
              </span>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {dItems.map((item) =>
                item.shape === "checklist" ? (
                  <div key={item.id} className="py-2.5">
                    <div className="text-sm mb-1.5">{item.name}</div>
                    {cleaningTasks.length === 0 && (
                      <div className="text-xs text-zinc-500">Nothing due today 🎉</div>
                    )}
                    {cleaningTasks.map((t) => {
                      const cl = cleaningLogs.find((l) => l.taskId === t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={async () => {
                            const r = await postLog({
                              type: "cleaning",
                              taskId: t.id,
                              date,
                              done: !cl?.done,
                            });
                            setData((d) =>
                              d
                                ? {
                                    ...d,
                                    day: r.day,
                                    cleaningLogs: [
                                      ...d.cleaningLogs.filter((l) => l.taskId !== t.id),
                                      { taskId: t.id, date, done: !cl?.done, na: false },
                                    ],
                                  }
                                : d
                            );
                          }}
                          className="flex items-center gap-2 w-full py-1.5 text-left"
                        >
                          <span
                            className={`w-5 h-5 rounded border text-xs flex items-center justify-center ${
                              cl?.done ? "bg-emerald-600 border-emerald-600" : "border-zinc-600"
                            }`}
                          >
                            {cl?.done ? "✓" : ""}
                          </span>
                          <span className="text-xs text-zinc-300">
                            <span className="text-zinc-500">{t.area}:</span> {t.task}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <ItemRow
                    key={item.id}
                    item={item}
                    log={logs.find((l) => l.itemId === item.id)}
                    date={date}
                    onDay={onDay}
                  />
                )
              )}
            </div>
          </section>
        );
      })}

      <WeightEntry date={date} />
    </main>
  );
}

function WeightEntry({ date }: { date: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-3 flex items-center justify-between">
      <span className="text-sm">⚖️ Weight (tracked, unscored)</span>
      <div className="flex items-center gap-2">
        {saved && <span className="text-xs text-emerald-400">saved</span>}
        <input
          type="number"
          step="0.1"
          placeholder="lbs"
          onBlur={async (e) => {
            if (e.target.value === "") return;
            await fetch("/api/metrics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "weight", date, value: Number(e.target.value) }),
            });
            setSaved(true);
          }}
          className="w-24 rounded-lg bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm text-right"
        />
      </div>
    </section>
  );
}
