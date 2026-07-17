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
}

function naButton(item: Item, date: string, onDay: (d: DayScore) => void, na: boolean) {
  return (
    <button
      onClick={async () => {
        const r = await postLog({ type: "item", itemId: item.id, date, value: null, na: !na });
        onDay(r.day);
      }}
      className={`text-[10px] px-1.5 py-0.5 rounded ${na ? "bg-zinc-600 text-white" : "text-zinc-600"}`}
      title="Mark not applicable today"
    >
      N/A
    </button>
  );
}

export default function ItemRow({ item, log, date, onDay }: Props) {
  const [busy, setBusy] = useState(false);
  const na = !!log?.na;

  async function send(value: number | null, detail?: Record<string, unknown>, source = "manual") {
    setBusy(true);
    const r = await postLog({ type: "item", itemId: item.id, date, value, detail, na: false, source });
    onDay(r.day);
    setBusy(false);
  }

  const rowCls = `flex items-center justify-between gap-2 py-2.5 ${na ? "opacity-40" : ""}`;

  // ----- multi-slot binary (insulin) -----
  const binCfg = item.config as BinaryConfig;
  if (item.shape === "binary" && (binCfg.slots ?? 1) > 1) {
    const detail = (log?.detail ?? {}) as Record<string, boolean | "na">;
    return (
      <div className={rowCls}>
        <span className="text-sm">{item.name}</span>
        <div className="flex gap-1.5 items-center">
          {(binCfg.slotLabels ?? []).map((slot) => {
            const v = detail[slot];
            return (
              <button
                key={slot}
                disabled={busy}
                onClick={() => {
                  const next = v === true ? "na" : v === "na" ? false : true;
                  send(null, { ...detail, [slot]: next });
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border ${
                  v === true
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : v === "na"
                      ? "bg-zinc-700 border-zinc-700 text-zinc-300 line-through"
                      : "border-zinc-700 text-zinc-400"
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
        <span className="text-sm">{item.name}</span>
        <div className="flex items-center gap-2">
          {naButton(item, date, onDay, na)}
          <button
            disabled={busy}
            onClick={() => send(done ? 0 : 1)}
            className={`w-9 h-9 rounded-full border text-lg leading-none ${
              done ? "bg-emerald-600 border-emerald-600" : "border-zinc-600 text-zinc-500"
            }`}
          >
            {done ? "✓" : ""}
          </button>
        </div>
      </div>
    );
  }

  // ----- quantity -----
  if (item.shape === "quantity") {
    const cfg = item.config as QuantityConfig;
    const v = na ? 0 : (log?.value ?? 0);
    return (
      <div className={rowCls}>
        <div>
          <span className="text-sm">{item.name}</span>
          <div className="text-xs text-zinc-500">
            {v}/{cfg.target} {cfg.unit}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {naButton(item, date, onDay, na)}
          <button
            disabled={busy || v <= 0}
            onClick={() => send(Math.max(0, v - (cfg.step ?? 1)))}
            className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-400"
          >
            −
          </button>
          <button
            disabled={busy}
            onClick={() => send(v + (cfg.step ?? 1))}
            className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-600"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // ----- limit (counter type, e.g., soda). Hour-based limits are handled by Timers. -----
  if (item.shape === "limit") {
    const cfg = item.config as LimitConfig;
    const v = na ? 0 : (log?.value ?? 0);
    return (
      <div className={rowCls}>
        <div>
          <span className="text-sm">{item.name}</span>
          <div className="text-xs text-zinc-500">
            {v} of max {cfg.cap} {cfg.unit}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {naButton(item, date, onDay, na)}
          <button
            disabled={busy || v <= 0}
            onClick={() => send(Math.max(0, v - 1))}
            className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-400"
          >
            −
          </button>
          <button
            disabled={busy}
            onClick={() => send(v + 1)}
            className={`w-9 h-9 rounded-full border ${v >= cfg.cap ? "bg-red-900/60 border-red-800" : "bg-zinc-800 border-zinc-600"}`}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // ----- rating -----
  if (item.shape === "rating") {
    const cfg = item.config as RatingConfig;
    const v = na ? null : (log?.value ?? null);
    return (
      <div className={`py-2.5 ${na ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm">{item.name}</span>
          {naButton(item, date, onDay, na)}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {Array.from({ length: cfg.max + 1 }, (_, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => send(i)}
              className={`flex-1 text-xs py-1.5 rounded-lg border ${
                v === i ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-700 text-zinc-400"
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
        <span className="text-sm">{item.name}</span>
        <input
          type="number"
          min={0}
          max={100}
          defaultValue={v ?? ""}
          placeholder="%"
          onBlur={(e) => e.target.value !== "" && send(Number(e.target.value))}
          className="w-20 rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-right"
        />
      </div>
    );
  }

  return null;
}
