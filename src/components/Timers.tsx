"use client";
// Dual concurrent timers for eBay / Vibecoding, plus quick-add chunks.
// Both can run at once (layered work counts on both clocks).
import { useEffect, useState } from "react";
import type { Item, LimitConfig, LogEntry, DayScore } from "@/lib/types";
import { loadTimer, saveTimer, postLog, type TimerState } from "@/lib/client";
import { dayOfWeek } from "@/lib/dates";

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Timer({
  item,
  log,
  date,
  onDay,
}: {
  item: Item;
  log?: LogEntry;
  date: string;
  onDay: (d: DayScore) => void;
}) {
  const cfg = item.config as LimitConfig;
  const cap = cfg.capByWeekday?.[dayOfWeek(date)] ?? cfg.cap;
  const [t, setT] = useState<TimerState | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setT(loadTimer(item.id, date));
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [item.id, date]);

  if (!t) return null;

  const runningMins = t.startedAt ? (Date.now() - t.startedAt) / 60000 : 0;
  const totalMins = t.bankedMinutes + runningMins;
  const hours = totalMins / 60;
  const over = hours > cap;

  async function commit(next: TimerState) {
    saveTimer(item.id, next);
    setT(next);
    const totalHours = Math.round((next.bankedMinutes / 60) * 100) / 100;
    const r = await postLog({ type: "item", itemId: item.id, date, value: totalHours, source: "timer" });
    onDay(r.day);
  }

  function toggle() {
    if (t!.startedAt) {
      commit({ ...t!, startedAt: null, bankedMinutes: t!.bankedMinutes + runningMins });
    } else {
      const next = { ...t!, startedAt: Date.now() };
      saveTimer(item.id, next);
      setT(next);
    }
  }

  function addChunk(mins: number) {
    commit({ ...t!, bankedMinutes: Math.max(0, t!.bankedMinutes + mins) });
  }

  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">{item.name.replace(" hours", "")}</div>
          <div className={`text-lg font-semibold tabular-nums ${over ? "text-red-400" : "text-zinc-100"}`}>
            {fmt(totalMins)} <span className="text-xs font-normal text-zinc-500">/ {cap}h cap</span>
          </div>
        </div>
        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-full text-xl border ${
            t.startedAt ? "bg-red-600 border-red-600 animate-pulse" : "bg-zinc-800 border-zinc-600"
          }`}
        >
          {t.startedAt ? "⏸" : "▶"}
        </button>
      </div>
      <div className="flex gap-1.5 mt-2">
        {[15, 30].map((m) => (
          <button
            key={m}
            onClick={() => addChunk(m)}
            className="text-xs px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400"
          >
            +{m}m
          </button>
        ))}
        <button
          onClick={() => addChunk(-15)}
          className="text-xs px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500"
        >
          −15m
        </button>
        {log?.value != null && log.value * 60 !== Math.round(t.bankedMinutes) && !t.startedAt && (
          <span className="text-[10px] text-zinc-600 self-center ml-auto">synced</span>
        )}
      </div>
    </div>
  );
}

export default function Timers({
  items,
  logs,
  date,
  onDay,
}: {
  items: Item[];
  logs: LogEntry[];
  date: string;
  onDay: (d: DayScore) => void;
}) {
  const hourItems = items.filter((i) => i.shape === "limit" && (i.config as LimitConfig).unit === "h");
  if (hourItems.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {hourItems.map((i) => (
        <Timer key={i.id} item={i} log={logs.find((l) => l.itemId === i.id)} date={date} onDay={onDay} />
      ))}
    </div>
  );
}
