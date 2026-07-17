"use client";
// Timer cards: count-down-style limit timers (eBay, vibecoding — stay under cap)
// and count-up quantity timers (reading — reach the target). All can run
// concurrently. Each running timer shows its start timestamp, and a
// "forgot to stop?" input takes an estimated end time and back-computes
// the elapsed minutes from the logged start.
import { useEffect, useState } from "react";
import type { Item, LimitConfig, QuantityConfig, LogEntry, DayScore } from "@/lib/types";
import { loadTimer, saveTimer, postLog, type TimerState } from "@/lib/client";
import { dayOfWeek } from "@/lib/dates";

export function isTimerItem(item: Item): boolean {
  if (item.shape === "limit" && (item.config as LimitConfig).unit === "h") return true;
  if (item.shape === "quantity" && (item.config as QuantityConfig).timer) return true;
  return false;
}

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Timer({
  item,
  date,
  onDay,
}: {
  item: Item;
  date: string;
  onDay: (d: DayScore) => void;
}) {
  const isLimit = item.shape === "limit";
  const limitCfg = item.config as LimitConfig;
  const qtyCfg = item.config as QuantityConfig;
  const capOrTarget = isLimit
    ? (limitCfg.capByWeekday?.[dayOfWeek(date)] ?? limitCfg.cap)
    : qtyCfg.target; // hours for limit, minutes for quantity
  const [t, setT] = useState<TimerState | null>(null);
  const [showEndInput, setShowEndInput] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    setT(loadTimer(item.id, date));
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [item.id, date]);

  if (!t) return null;

  const runningMins = t.startedAt ? Math.max(0, (Date.now() - t.startedAt) / 60000) : 0;
  const totalMins = t.bankedMinutes + runningMins;
  const capMins = isLimit ? capOrTarget * 60 : capOrTarget;
  const over = isLimit && totalMins > capMins;
  const reached = !isLimit && totalMins >= capMins;
  const longRunning = t.startedAt && runningMins > 90;

  async function commit(next: TimerState) {
    saveTimer(item.id, next);
    setT(next);
    const value = isLimit
      ? Math.round((next.bankedMinutes / 60) * 100) / 100 // hours
      : Math.round(next.bankedMinutes); // minutes
    const r = await postLog({
      type: "item",
      itemId: item.id,
      date,
      value,
      detail: { sessions: next.sessions ?? [] },
      source: "timer",
    });
    onDay(r.day);
  }

  function stopAt(endMs: number, estimated = false) {
    if (!t?.startedAt) return;
    const end = Math.min(endMs, Date.now());
    const mins = Math.max(0, (end - t.startedAt) / 60000);
    commit({
      ...t,
      startedAt: null,
      bankedMinutes: t.bankedMinutes + mins,
      sessions: [...(t.sessions ?? []), { start: t.startedAt, end, mins: Math.round(mins), estimated }],
    });
    setShowEndInput(false);
  }

  function toggle() {
    if (t!.startedAt) {
      stopAt(Date.now());
    } else {
      const next = { ...t!, startedAt: Date.now() };
      saveTimer(item.id, next);
      setT(next);
    }
  }

  function endAtTime(hhmm: string) {
    if (!t?.startedAt || !hhmm) return;
    const [h, m] = hhmm.split(":").map(Number);
    const cand = new Date();
    cand.setHours(h, m, 0, 0);
    let ms = cand.getTime();
    // If the entered time is before the start, assume it crossed midnight forward.
    if (ms < t.startedAt) ms += 86400_000;
    stopAt(ms, true);
  }

  function addChunk(mins: number) {
    commit({ ...t!, bankedMinutes: Math.max(0, t!.bankedMinutes + mins) });
  }

  const timeColor = over ? "text-red-400" : reached ? "text-emerald-400" : "text-zinc-100";

  return (
    <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-zinc-50">
            {item.name.replace(" hours", "")}
          </div>
          <div className={`text-lg font-semibold tabular-nums ${timeColor}`}>
            {fmt(totalMins)}{" "}
            <span className="text-xs font-normal text-zinc-400">
              / {isLimit ? `${capOrTarget}h cap` : `${capOrTarget}m goal`} {reached && "✓"}
            </span>
          </div>
        </div>
        <button
          onClick={toggle}
          className={`w-14 h-14 rounded-full text-xl border-2 ${
            t.startedAt
              ? "bg-red-500 border-red-400 text-white animate-pulse"
              : "bg-emerald-600 border-emerald-500 text-white"
          }`}
        >
          {t.startedAt ? "⏸" : "▶"}
        </button>
      </div>

      {t.startedAt && (
        <div className={`mt-1.5 text-xs ${longRunning ? "text-amber-400" : "text-zinc-400"}`}>
          started {clock(t.startedAt)}
          {longRunning && " — still going?"}
        </div>
      )}

      {t.startedAt && !showEndInput && (
        <button
          onClick={() => setShowEndInput(true)}
          className="mt-1.5 text-xs px-2 py-1 rounded-lg border border-zinc-600 text-zinc-300"
        >
          Forgot to stop? Set end time…
        </button>
      )}
      {t.startedAt && showEndInput && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">ended at</span>
          <input
            type="time"
            onChange={(e) => endAtTime(e.target.value)}
            className="rounded-lg bg-zinc-800 border border-zinc-500 px-2 py-1 text-sm text-zinc-100"
          />
          <button onClick={() => setShowEndInput(false)} className="text-xs text-zinc-500 px-1">
            cancel
          </button>
        </div>
      )}

      <div className="flex gap-1.5 mt-2">
        {[15, 30].map((m) => (
          <button
            key={m}
            onClick={() => addChunk(m)}
            className="text-sm px-2.5 py-1.5 rounded-lg bg-zinc-700 border border-zinc-500 text-zinc-100 font-medium"
          >
            +{m}m
          </button>
        ))}
        <button
          onClick={() => addChunk(-15)}
          className="text-sm px-2.5 py-1.5 rounded-lg border border-zinc-600 text-zinc-400"
        >
          −15m
        </button>
      </div>
    </div>
  );
}

export default function Timers({
  items,
  date,
  onDay,
}: {
  items: Item[];
  logs: LogEntry[];
  date: string;
  onDay: (d: DayScore) => void;
}) {
  const timerItems = items.filter(isTimerItem);
  if (timerItems.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {timerItems.map((i) => (
        <Timer key={i.id} item={i} date={date} onDay={onDay} />
      ))}
    </div>
  );
}
