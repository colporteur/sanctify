"use client";
// Client-side helpers shared by screens.
import type { DayScore, Item, Domain, CleaningTask, CleaningLog, LogEntry, ScoringProfile } from "./types";

export interface DayData {
  date: string;
  day: DayScore;
  domains: Domain[];
  items: Item[];
  logs: LogEntry[];
  cleaningTasks: CleaningTask[];
  cleaningLogs: CleaningLog[];
  profile: ScoringProfile;
  mode: "calibration" | "production";
  settings: Record<string, unknown>;
}

export async function fetchDay(date?: string): Promise<DayData> {
  const res = await fetch(`/api/day${date ? `?date=${date}` : ""}`);
  if (res.status === 401) window.location.href = "/login";
  return res.json();
}

export async function postLog(body: Record<string, unknown>): Promise<{ day: DayScore }> {
  const res = await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---- dual timers, persisted in localStorage ----
export interface TimerState {
  startedAt: number | null; // epoch ms
  bankedMinutes: number; // minutes accumulated today from stops + chunks
  date: string;
}

export function loadTimer(key: string, date: string): TimerState {
  try {
    const raw = localStorage.getItem(`timer:${key}`);
    if (raw) {
      const t = JSON.parse(raw) as TimerState;
      if (t.date === date) return t;
    }
  } catch {}
  return { startedAt: null, bankedMinutes: 0, date };
}

export function saveTimer(key: string, t: TimerState) {
  localStorage.setItem(`timer:${key}`, JSON.stringify(t));
}
