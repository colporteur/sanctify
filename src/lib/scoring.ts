// ---------- The Sanctify scoring engine ----------
// Pure functions: (catalog, profile, logs, date) -> DayScore.
// Invariant: a perfect day is always exactly 100, regardless of how many
// items are due or how weights are set, because both rollup levels divide
// by the sum of *active* weights.

import type {
  Item,
  Domain,
  ScoringProfile,
  LogEntry,
  CleaningTask,
  CleaningLog,
  ItemScore,
  DomainScore,
  DayScore,
  BinaryConfig,
  QuantityConfig,
  LimitConfig,
  ChecklistConfig,
  RatingConfig,
} from "./types";
import { isDue } from "./schedule";
import { dayOfWeek } from "./dates";

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/** Score a single item for a day. Returns null score if N/A. */
export function scoreItem(
  item: Item,
  log: LogEntry | undefined,
  date: string,
  cleaning?: { tasks: CleaningTask[]; logs: CleaningLog[] }
): { score: number | null; na: boolean; logged: boolean } {
  if (log?.na) return { score: null, na: true, logged: true };

  switch (item.shape) {
    case "binary": {
      const cfg = item.config as BinaryConfig;
      const slots = cfg.slots ?? 1;
      if (slots === 1) {
        return { score: log && log.value ? 100 : 0, na: false, logged: !!log };
      }
      // Multi-slot binary (e.g., insulin at 3 meals). detail: {slotLabel: true|false|"na"}
      const detail = (log?.detail ?? {}) as Record<string, boolean | "na">;
      const labels = cfg.slotLabels ?? Array.from({ length: slots }, (_, i) => `slot${i}`);
      let done = 0;
      let denominator = 0;
      for (const label of labels) {
        const v = detail[label];
        if (v === "na") continue; // skipped meal drops from denominator
        denominator++;
        if (v === true) done++;
      }
      if (denominator === 0) return { score: null, na: true, logged: !!log };
      return { score: clamp((done / denominator) * 100), na: false, logged: !!log };
    }

    case "quantity": {
      const cfg = item.config as QuantityConfig;
      const v = log?.value ?? 0;
      return { score: clamp((v / cfg.target) * 100), na: false, logged: !!log };
    }

    case "limit": {
      const cfg = item.config as LimitConfig;
      const dow = dayOfWeek(date);
      const cap = cfg.capByWeekday?.[dow] ?? cfg.cap;
      const v = log?.value ?? 0; // unlogged limit item = assumed 0 consumption = full score
      const over = Math.max(0, v - cap);
      return { score: clamp(100 - over * cfg.penaltyPerUnit), na: false, logged: !!log };
    }

    case "checklist": {
      const cfg = item.config as ChecklistConfig;
      if (cfg.source === "cleaning") {
        const tasks = (cleaning?.tasks ?? []).filter((t) => t.active && isDue(t.schedule, date));
        const logsByTask = new Map((cleaning?.logs ?? []).map((l) => [l.taskId, l]));
        const dueTasks = tasks.filter((t) => !logsByTask.get(t.id)?.na);
        if (dueTasks.length === 0) return { score: null, na: true, logged: false }; // nothing due -> excluded
        const done = dueTasks.filter((t) => logsByTask.get(t.id)?.done).length;
        return { score: clamp((done / dueTasks.length) * 100), na: false, logged: done > 0 };
      }
      // fixed slots checklist, detail: {label: true|false|"na"}
      const detail = (log?.detail ?? {}) as Record<string, boolean | "na">;
      const labels = cfg.slotLabels ?? [];
      const active = labels.filter((l) => detail[l] !== "na");
      if (active.length === 0) return { score: null, na: true, logged: !!log };
      const done = active.filter((l) => detail[l] === true).length;
      return { score: clamp((done / active.length) * 100), na: false, logged: !!log };
    }

    case "range": {
      // Value is already a 0-100 percentage (e.g., time-in-range).
      if (log?.value == null) return { score: 0, na: false, logged: false };
      return { score: clamp(log.value), na: false, logged: true };
    }

    case "rating": {
      const cfg = item.config as RatingConfig;
      if (log?.value == null) return { score: 0, na: false, logged: false };
      return { score: clamp((log.value / cfg.max) * 100), na: false, logged: true };
    }
  }
}

/** Compute the full day score. */
export function scoreDay(args: {
  date: string;
  domains: Domain[];
  items: Item[];
  profile: ScoringProfile;
  logs: LogEntry[]; // logs for this date
  cleaningTasks?: CleaningTask[];
  cleaningLogs?: CleaningLog[]; // for this date
  provisional?: boolean;
}): DayScore {
  const { date, domains, items, profile } = args;
  const logsByItem = new Map(args.logs.map((l) => [l.itemId, l]));
  const cleaning = { tasks: args.cleaningTasks ?? [], logs: args.cleaningLogs ?? [] };

  const domainScores: DomainScore[] = [];

  for (const domain of [...domains].sort((a, b) => a.sort - b.sort)) {
    const domainItems = items
      .filter((i) => i.domainId === domain.id && i.active && isDue(i.schedule, date))
      .sort((a, b) => a.sort - b.sort);

    const itemScores: ItemScore[] = [];
    let wSum = 0;
    let wsSum = 0;

    for (const item of domainItems) {
      const w = profile.itemWeights[item.id] ?? 1;
      const r = scoreItem(item, logsByItem.get(item.id), date, cleaning);
      itemScores.push({ itemId: item.id, due: true, na: r.na, score: r.score, logged: r.logged });
      if (r.score !== null) {
        wSum += w;
        wsSum += w * r.score;
      }
    }

    const score = wSum > 0 ? wsSum / wSum : null;
    domainScores.push({ domainId: domain.id, score, weightShare: 0, items: itemScores });
  }

  // Roll up domains with at least one scoring item today.
  let WSum = 0;
  let WsSum = 0;
  for (const d of domainScores) {
    if (d.score === null) continue;
    const W = profile.domainWeights[d.domainId] ?? 1;
    WSum += W;
    WsSum += W * d.score;
  }
  for (const d of domainScores) {
    d.weightShare =
      d.score === null || WSum === 0 ? 0 : (profile.domainWeights[d.domainId] ?? 1) / WSum;
  }

  return {
    date,
    lifeScore: WSum > 0 ? Math.round((WsSum / WSum) * 10) / 10 : null,
    domains: domainScores,
    profileVersion: profile.version,
    provisional: args.provisional ?? false,
  };
}

/** Pick the profile active on a date (latest effectiveDate <= date). */
export function profileFor(profiles: ScoringProfile[], date: string): ScoringProfile {
  const eligible = profiles
    .filter((p) => p.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.version - a.version);
  return eligible[0] ?? profiles[0];
}
