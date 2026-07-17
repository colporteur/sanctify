// Server-side service: load catalog + logs, compute a day's score, cache it.
import { eq, and, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { scoreDay, profileFor } from "./scoring";
import type {
  Item, Domain, ScoringProfile, LogEntry, CleaningTask, CleaningLog, Schedule, ItemConfig, DayScore,
} from "./types";
import { isDue } from "./schedule";

export async function loadCatalog() {
  const [domains, items, tasks, profiles, user] = await Promise.all([
    db.select().from(schema.domains),
    db.select().from(schema.items),
    db.select().from(schema.cleaningTasks),
    db.select().from(schema.scoringProfiles),
    db.select().from(schema.users).then((r) => r[0]),
  ]);
  return {
    domains: domains as Domain[],
    items: items.map((i) => ({
      ...i,
      config: i.config as ItemConfig,
      schedule: i.schedule as Schedule,
    })) as Item[],
    tasks: tasks.map((t) => ({ ...t, schedule: t.schedule as Schedule })) as CleaningTask[],
    profiles: profiles.map((p) => ({
      version: p.version,
      effectiveDate: p.effectiveDate,
      domainWeights: p.domainWeights as Record<string, number>,
      itemWeights: p.itemWeights as Record<string, number>,
    })) as ScoringProfile[],
    user,
  };
}

export async function loadDayLogs(date: string) {
  const [logRows, cleaningRows] = await Promise.all([
    db.select().from(schema.logs).where(eq(schema.logs.date, date)),
    db.select().from(schema.cleaningLogs).where(eq(schema.cleaningLogs.date, date)),
  ]);
  return {
    logs: logRows.map((l) => ({
      itemId: l.itemId,
      date: l.date,
      value: l.value,
      detail: (l.detail ?? undefined) as Record<string, unknown> | undefined,
      na: l.na,
      source: l.source,
    })) as LogEntry[],
    cleaningLogs: cleaningRows as CleaningLog[],
  };
}

export async function computeAndCacheDay(date: string): Promise<DayScore> {
  const catalog = await loadCatalog();
  const { logs, cleaningLogs } = await loadDayLogs(date);
  const profile = profileFor(catalog.profiles, date);
  const day = scoreDay({
    date,
    domains: catalog.domains,
    items: catalog.items,
    profile,
    logs,
    cleaningTasks: catalog.tasks,
    cleaningLogs,
    provisional: catalog.user?.mode === "calibration",
  });
  await db
    .insert(schema.dayScores)
    .values({
      date,
      lifeScore: day.lifeScore,
      domainScores: day.domains,
      profileVersion: day.profileVersion,
      provisional: day.provisional,
    })
    .onConflictDoUpdate({
      target: schema.dayScores.date,
      set: {
        lifeScore: day.lifeScore,
        domainScores: day.domains,
        profileVersion: day.profileVersion,
        provisional: day.provisional,
        computedAt: new Date(),
      },
    });
  return day;
}

/** Everything the Today screen needs for a date. */
export async function dayPayload(date: string) {
  const catalog = await loadCatalog();
  const { logs, cleaningLogs } = await loadDayLogs(date);
  const profile = profileFor(catalog.profiles, date);
  const day = scoreDay({
    date,
    domains: catalog.domains,
    items: catalog.items,
    profile,
    logs,
    cleaningTasks: catalog.tasks,
    cleaningLogs,
    provisional: catalog.user?.mode === "calibration",
  });
  const dueTasks = catalog.tasks.filter((t) => t.active && isDue(t.schedule, date));
  return {
    date,
    day,
    domains: catalog.domains,
    items: catalog.items.filter((i) => i.active && isDue(i.schedule, date)),
    logs,
    cleaningTasks: dueTasks,
    cleaningLogs,
    profile,
    mode: catalog.user?.mode ?? "calibration",
    settings: catalog.user?.settings ?? {},
  };
}

export async function scoreRange(from: string, to: string) {
  return db
    .select()
    .from(schema.dayScores)
    .where(and(gte(schema.dayScores.date, from), lte(schema.dayScores.date, to)));
}
