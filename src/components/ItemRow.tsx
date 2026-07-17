"use client";
import type { Item, LogEntry, BinaryConfig, QuantityConfig, LimitConfig, RatingConfig } from "@/lib/types";
import { postLog } from "@/lib/client";
import type { DayScore } from "@/lib/types";
import { useState } from "react";

interface Props {
  item: Item;
  log?: LogEntry;
  date: string;
  onDay: (d: DayScore) => void;
  /** Optimistic local update so the row reflects the tap instantly. */
  onLog?: (l: LogEntry) => void;
}

export default function ItemRow({ item, log, date, onDay, onLog }: Props) {
  const [flash, setFlash] = useState(false);
  const na = !!log?.na;

  async function send(
    value: number | null,
    detail?: Record<string, unknown>,
    naFlag = false,
    source: LogEntry["source"] = "manual"
  ) {
    // 1. Instant local update — no waiting on the network to show the tap.
    onLog?.({ itemId: item.id, date, value, detail, na: naFlag, source });
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    // 2. Persist + refresh the day's scores.
    const r = await postLog({ type: "item", itemId: item.id, date, value, detail, na: naFlag, source });
    onDay(r.day);
  }

  const naBtn = (
    <button
      onClick={() => send(null, undefined, !na)}
      className={`text-xs px-2 py-1.5 rounded-lg border font-medium ${
        na
          ? "bg-zinc-400 border-zinc-400 text-zinc-900 animate-pop"
          : "bg-zinc-800/80 border-zinc-600 text-zinc-400"
      }`}
      title="Mark not applicable today"
    >
      N/A
    </button>
  );

  const rowCls = `flex items-center justify-between gap-2 py-3 ${na ? "opacity-40" : ""}`;
  const name = <span className="text-[15px] font-medium text-zinc-50">{item.name}</span>;

  // ----- multi-slot binary (insulin) -----
  const binCfg = item.config as BinaryConfig;
  if (item.shape === "binary" && (binCfg.slots ?? 1) > 1) {
    const detail = (log?.detail ?? {}) as Record<string, boolean | "na">;
    return (
      <div className={rowCls}>
        {name}
        <div className="flex gap-1.5 items-center">
          {(binCfg.slotLabels ?? []).map((slot) => {
            const v = detail[slot];
            return (
              <button
                key={`${slot}-${String(v)}`}
                onClick={() => {
                  const next = v === true ? "na" : v === "na" ? false : true;
                  send(null, { ...detail, [slot]: next });
                }}
                className={`text-sm px-3 py-2 rounded-lg border font-medium ${
                  v === true
                    ? "bg-emerald-500 border-emerald-500 text-zinc-950 animate-pop"
                    : v === "na"
                      ? "bg-zinc-600 border-zinc-600 text-zinc-300 line-through"
                      : "bg-zinc-800 border-zinc-500 text-zinc-200"
                }`}
              >
                {slot.slice(0, 1).toUpperCase() + slot.slice(1, 3)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ----- simple binary -----
  if (item.shape === "binary") {
    const done = !na && !!log?.value;
    return (
      <div className={rowCls}>
        {name}
        <div className="flex items-center gap-2">
          {naBtn}
          <button
            key={String(done)}
            onClick={() => send(done ? 0 : 1)}
            className={`w-11 h-11 rounded-full border-2 text-xl leading-none font-bold ${
              done
                ? "bg-emerald-500 border-emerald-500 text-zinc-950 animate-pop"
                : "bg-zinc-800 border-zinc-500 text-zinc-600"
            }`}
          >
            ✓
          </button>
        </div>
      </div>
    );
  }

  // ----- quantity -----
  if (item.shape === "quantity") {
    const cfg = item.config as QuantityConfig;
    const v = na ? 0 : (log?.value ?? 0);
    const pct = Math.min(100, (v / cfg.target) * 100);
    return (
      <div className={`py-3 ${na ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            {name}
            <div className={`text-sm tabular-nums ${pct >= 100 ? "text-emerald-400 font-medium" : "text-zinc-300"}`}>
              {v} / {cfg.target} {cfg.unit} {pct >= 100 && "✓"}
            </div>
            {/* progress bar = immediate visual confirmation of each tap */}
            <div className="h-1.5 mt-1.5 rounded-full bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pct >= 100 ? "bg-emerald-400" : "bg-emerald-600"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {naBtn}
            <button
              disabled={v <= 0}
              onClick={() => send(Math.max(0, v - (cfg.step ?? 1)))}
              className="w-11 h-11 rounded-full bg-zinc-800 border-2 border-zinc-500 text-zinc-200 text-xl disabled:opacity-30"
            >
              −
            </button>
            <button
              onClick={() => send(v + (cfg.step ?? 1))}
              className={`w-11 h-11 rounded-full border-2 text-xl font-medium ${
                flash
                  ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                  : "bg-zinc-700 border-zinc-400 text-zinc-100"
              }`}
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- limit (counter type, e.g., soda). Hour-based limits are handled by Timers. -----
  if (item.shape === "limit") {
    const cfg = item.config as LimitConfig;
    const v = na ? 0 : (log?.value ?? 0);
    const over = v > cfg.cap;
    return (
      <div className={`py-3 ${na ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            {name}
            <div className={`text-sm tabular-nums ${over ? "text-red-400 font-semibold" : "text-zinc-300"}`}>
              {v} of max {cfg.cap} {cfg.unit} {over && "— over!"}
            </div>
            {/* dot per unit up to cap; extras go red */}
            <div className="flex gap-1 mt-1.5">
              {Array.from({ length: Math.max(cfg.cap, v) }, (_, i) => (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < v ? (i < cfg.cap ? "bg-amber-400" : "bg-red-500") : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {naBtn}
            <button
              disabled={v <= 0}
              onClick={() => send(Math.max(0, v - 1))}
              className="w-11 h-11 rounded-full bg-zinc-800 border-2 border-zinc-500 text-zinc-200 text-xl disabled:opacity-30"
            >
              −
            </button>
            <button
              onClick={() => send(v + 1)}
              className={`w-11 h-11 rounded-full border-2 text-xl font-medium ${
                v >= cfg.cap
                  ? "bg-red-900/70 border-red-600 text-red-200"
                  : "bg-zinc-700 border-zinc-400 text-zinc-100"
              }`}
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- rating -----
  if (item.shape === "rating") {
    const cfg = item.config as RatingConfig;
    const v = na ? null : (log?.value ?? null);
    return (
      <div className={`py-3 ${na ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-between">
          {name}
          {naBtn}
        </div>
        <div className="flex gap-1.5 mt-2">
          {Array.from({ length: cfg.max + 1 }, (_, i) => (
            <button
              key={`${i}-${v === i}`}
              onClick={() => send(i)}
              className={`flex-1 text-xs py-2.5 rounded-lg border font-medium ${
                v === i
                  ? "bg-emerald-500 border-emerald-500 text-zinc-950 animate-pop"
                  : "bg-zinc-800 border-zinc-600 text-zinc-300"
              }`}
            >
              {cfg.labels?.[i] ?? i}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- range (e.g., TIR — usually automated; manual % entry) -----
  if (item.shape === "range") {
    const v = log?.value ?? null;
    return (
      <div className={rowCls}>
        {name}
        <div className="flex items-center gap-2">
          {flash && <span className="text-xs text-emerald-400">saved ✓</span>}
          <input
            type="number"
            min={0}
            max={100}
            defaultValue={v ?? ""}
            placeholder="%"
            onBlur={(e) => e.target.value !== "" && send(Number(e.target.value))}
            className="w-20 rounded-lg bg-zinc-800 border-2 border-zinc-500 px-2 py-2 text-base text-right text-zinc-100"
          />
        </div>
      </div>
    );
  }

  return null;
}
