"use client";
import { useEffect, useState } from "react";
import { fetchDay, postLog, type DayData } from "@/lib/client";
import type { DayScore } from "@/lib/types";
import ScoreRing from "./ScoreRing";
import ItemRow from "./ItemRow";
import Timers, { isTimerItem } from "./Timers";

export default function TodayView() {
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    fetchDay().then(setData);
  }, []);

  if (!data) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  const { date, domains, items, logs, cleaningTasks, cleaningLogs } = data;
  const day = data.day;
  const onDay = (d: DayScore) => setData((cur) => (cur ? { ...cur, day: d } : cur));
  // Optimistic: reflect a tap in the row immediately, before the server responds.
  const onLog = (l: import("@/lib/types").LogEntry) =>
    setData((cur) =>
      cur ? { ...cur, logs: [...cur.logs.filter((x) => x.itemId !== l.itemId), l] } : cur
    );

  // timer-enabled items render as timer cards up top; everything else as rows

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
        const dItems = items.filter((i) => i.domainId === domain.id && !isTimerItem(i));
        const dScore = day.domains.find((d) => d.domainId === domain.id)?.score ?? null;
        if (dItems.length === 0 && domain.id !== "home") return null;
        return (
          <section key={domain.id} className="rounded-2xl bg-zinc-800/60 border border-zinc-700 px-4 py-2">
            <div className="flex items-center justify-between py-2 border-b border-zinc-700">
              <h2 className="text-[15px] font-semibold">
                {domain.icon} {domain.name}
              </h2>
              <span
                className={`text-base font-bold tabular-nums ${
                  dScore == null ? "text-zinc-500" : dScore >= 80 ? "text-emerald-400" : dScore >= 50 ? "text-amber-400" : "text-red-400"
                }`}
              >
                {dScore == null ? "–" : Math.round(dScore)}
              </span>
            </div>
            <div className="divide-y divide-zinc-700/50">
              {dItems.map((item) =>
                item.shape === "checklist" ? (
                  <div key={item.id} className="py-2.5">
                    <div className="text-[15px] font-medium text-zinc-50 mb-1.5">{item.name}</div>
                    {cleaningTasks.length === 0 && (
                      <div className="text-sm text-zinc-400">Nothing due today 🎉</div>
                    )}
                    {cleaningTasks.map((t) => {
                      const cl = cleaningLogs.find((l) => l.taskId === t.id);
                      const done = !!cl?.done;
                      return (
                        <button
                          key={`${t.id}-${done}`}
                          onClick={async () => {
                            // Optimistic flip first, then persist.
                            setData((d) =>
                              d
                                ? {
                                    ...d,
                                    cleaningLogs: [
                                      ...d.cleaningLogs.filter((l) => l.taskId !== t.id),
                                      { taskId: t.id, date, done: !done, na: false },
                                    ],
                                  }
                                : d
                            );
                            const r = await postLog({ type: "cleaning", taskId: t.id, date, done: !done });
                            onDay(r.day);
                          }}
                          className="flex items-center gap-2.5 w-full py-2 text-left"
                        >
                          <span
                            className={`w-7 h-7 shrink-0 rounded-lg border-2 text-sm font-bold flex items-center justify-center ${
                              done
                                ? "bg-emerald-500 border-emerald-500 text-zinc-950 animate-pop"
                                : "bg-zinc-800 border-zinc-500"
                            }`}
                          >
                            {done ? "✓" : ""}
                          </span>
                          <span className={`text-[15px] ${done ? "text-zinc-500 line-through" : "text-zinc-50"}`}>
                            <span className={done ? "" : "text-zinc-300"}>{t.area}:</span> {t.task}
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
                    onLog={onLog}
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
    <section className="rounded-2xl bg-zinc-800/60 border border-zinc-700 px-4 py-3 flex items-center justify-between">
      <span className="text-[15px] text-zinc-100">⚖️ Weight (tracked, unscored)</span>
      <div className="flex items-center gap-2">
        {saved && <span className="text-sm text-emerald-400 font-medium">saved ✓</span>}
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
          className="w-24 rounded-lg bg-zinc-800 border-2 border-zinc-500 px-2 py-2 text-base text-right text-zinc-100"
        />
      </div>
    </section>
  );
}
