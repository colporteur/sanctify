// ---------- Core domain types for the Sanctify scoring engine ----------
// These are pure data types; the engine (scoring.ts) is pure functions over them.

export type Shape = "binary" | "quantity" | "limit" | "checklist" | "range" | "rating";

/** When an item is "due" and therefore enters the day's denominator. */
export type Schedule =
  | { kind: "daily" }
  | { kind: "weekdays" } // Mon–Fri
  | { kind: "daysOfWeek"; days: number[] } // 0=Sun..6=Sat
  | { kind: "weekly"; day: number }
  | { kind: "everyNWeeks"; n: number; day: number; anchor: string } // anchor ISO date
  | { kind: "monthly"; day: number } // day of month, clamped to month length
  | { kind: "quarterly"; months: number[]; day: number }; // months 1-12

export interface BinaryConfig {
  /** number of check slots; 1 = simple binary, 3 = insulin meals */
  slots?: number;
  slotLabels?: string[];
}

export interface QuantityConfig {
  target: number;
  unit: string;
  step?: number; // one-tap increment
  timer?: boolean; // render as a count-up timer card (minutes-based items like reading)
}

export interface LimitConfig {
  cap: number;
  unit: string;
  penaltyPerUnit: number; // points subtracted per unit over cap
  capByWeekday?: Partial<Record<number, number>>; // 0=Sun..6=Sat overrides
}

export interface ChecklistConfig {
  /** "cleaning" pulls due tasks from the cleaning system; "fixed" uses slotLabels */
  source: "cleaning" | "fixed";
  slotLabels?: string[];
}

export interface RangeConfig {
  /** value logged is already a 0-100 percentage (e.g., Dexcom time-in-range) */
  map: "direct";
}

export interface RatingConfig {
  max: number; // e.g., 3 → 0..3 maps to 0/33/67/100
  labels?: string[];
}

export type ItemConfig =
  | BinaryConfig
  | QuantityConfig
  | LimitConfig
  | ChecklistConfig
  | RangeConfig
  | RatingConfig;

export interface Item {
  id: string;
  domainId: string;
  name: string;
  shape: Shape;
  config: ItemConfig;
  schedule: Schedule;
  active: boolean;
  sort: number;
}

export interface Domain {
  id: string;
  name: string;
  icon: string;
  sort: number;
}

/** Immutable snapshot of all weights, effective from a date forward. */
export interface ScoringProfile {
  version: number;
  effectiveDate: string; // ISO date
  domainWeights: Record<string, number>; // domainId -> relative weight
  itemWeights: Record<string, number>; // itemId -> relative weight (within domain)
}

export interface LogEntry {
  itemId: string;
  date: string; // effective date (ISO)
  value: number | null; // meaning depends on shape
  detail?: Record<string, unknown>; // e.g., insulin slots {breakfast:true,...}, time chunks
  na: boolean;
  source: "manual" | "timer" | "dexcom" | "ai-parse" | "ai-photo";
}

export interface CleaningTask {
  id: string;
  area: string;
  task: string;
  schedule: Schedule;
  active: boolean;
}

export interface CleaningLog {
  taskId: string;
  date: string;
  done: boolean;
  na: boolean;
}

// ---------- Engine outputs ----------

export interface ItemScore {
  itemId: string;
  due: boolean;
  na: boolean;
  score: number | null; // 0-100, null when not due or N/A
  logged: boolean;
}

export interface DomainScore {
  domainId: string;
  score: number | null; // null when no due items today
  weightShare: number; // normalized share of today's total (0-1)
  items: ItemScore[];
}

export interface DayScore {
  date: string;
  lifeScore: number | null; // null on a day with nothing due (shouldn't happen)
  domains: DomainScore[];
  profileVersion: number;
  provisional: boolean;
}
