import { describe, it, expect } from "vitest";
import { scoreDay, scoreItem, profileFor } from "./scoring";
import { isDue } from "./schedule";
import { effectiveDate } from "./dates";
import type { Domain, Item, ScoringProfile, CleaningTask } from "./types";

// ---------- fixtures ----------

const domains: Domain[] = [
  { id: "health", name: "Health", icon: "❤️", sort: 1 },
  { id: "balance", name: "Balance", icon: "⚖️", sort: 2 },
  { id: "home", name: "Home", icon: "🏠", sort: 3 },
];

const items: Item[] = [
  {
    id: "meds",
    domainId: "health",
    name: "Morning meds",
    shape: "binary",
    config: {},
    schedule: { kind: "daily" },
    active: true,
    sort: 1,
  },
  {
    id: "insulin",
    domainId: "health",
    name: "Insulin at meals",
    shape: "binary",
    config: { slots: 3, slotLabels: ["breakfast", "lunch", "dinner"] },
    schedule: { kind: "daily" },
    active: true,
    sort: 2,
  },
  {
    id: "water",
    domainId: "health",
    name: "Water",
    shape: "quantity",
    config: { target: 80, unit: "oz" },
    schedule: { kind: "daily" },
    active: true,
    sort: 3,
  },
  {
    id: "soda",
    domainId: "health",
    name: "Soda",
    shape: "limit",
    config: { cap: 3, unit: "cans", penaltyPerUnit: 25 },
    schedule: { kind: "daily" },
    active: true,
    sort: 4,
  },
  {
    id: "ebay-hours",
    domainId: "balance",
    name: "eBay hours",
    shape: "limit",
    config: { cap: 3, unit: "h", penaltyPerUnit: 25, capByWeekday: { 5: 5, 6: 5 } },
    schedule: { kind: "daily" },
    active: true,
    sort: 1,
  },
  {
    id: "ozempic",
    domainId: "health",
    name: "Ozempic",
    shape: "binary",
    config: {},
    schedule: { kind: "weekly", day: 0 }, // Sundays
    active: true,
    sort: 5,
  },
  {
    id: "cleaning",
    domainId: "home",
    name: "Cleaning checklist",
    shape: "checklist",
    config: { source: "cleaning" },
    schedule: { kind: "daily" },
    active: true,
    sort: 1,
  },
];

const profile: ScoringProfile = {
  version: 1,
  effectiveDate: "2026-01-01",
  domainWeights: { health: 30, balance: 15, home: 15 },
  itemWeights: {
    meds: 2,
    insulin: 2,
    water: 1,
    soda: 1,
    "ebay-hours": 1,
    ozempic: 2,
    cleaning: 1,
  },
};

// 2026-07-16 is a Thursday; 2026-07-17 Friday; 2026-07-19 Sunday.
const THURSDAY = "2026-07-16";
const FRIDAY = "2026-07-17";
const SUNDAY = "2026-07-19";

// ---------- schedule ----------

describe("isDue", () => {
  it("handles daily/weekdays/weekly", () => {
    expect(isDue({ kind: "daily" }, SUNDAY)).toBe(true);
    expect(isDue({ kind: "weekdays" }, SUNDAY)).toBe(false);
    expect(isDue({ kind: "weekdays" }, FRIDAY)).toBe(true);
    expect(isDue({ kind: "weekly", day: 0 }, SUNDAY)).toBe(true);
    expect(isDue({ kind: "weekly", day: 0 }, FRIDAY)).toBe(false);
  });
  it("handles everyNWeeks with anchor", () => {
    const s = { kind: "everyNWeeks", n: 2, day: 4, anchor: "2026-07-02" } as const; // Thursdays biweekly
    expect(isDue(s, "2026-07-02")).toBe(true);
    expect(isDue(s, "2026-07-09")).toBe(false);
    expect(isDue(s, THURSDAY)).toBe(true);
  });
  it("handles monthly with clamp", () => {
    expect(isDue({ kind: "monthly", day: 31 }, "2026-02-28")).toBe(true); // clamped
    expect(isDue({ kind: "monthly", day: 15 }, "2026-07-15")).toBe(true);
    expect(isDue({ kind: "monthly", day: 15 }, "2026-07-16")).toBe(false);
  });
});

// ---------- item shapes ----------

describe("scoreItem shapes", () => {
  const get = (id: string) => items.find((i) => i.id === id)!;

  it("binary", () => {
    expect(scoreItem(get("meds"), undefined, THURSDAY).score).toBe(0);
    expect(
      scoreItem(get("meds"), { itemId: "meds", date: THURSDAY, value: 1, na: false, source: "manual" }, THURSDAY)
        .score
    ).toBe(100);
  });

  it("multi-slot binary (insulin) with skipped meal", () => {
    const r = scoreItem(
      get("insulin"),
      {
        itemId: "insulin",
        date: THURSDAY,
        value: null,
        detail: { breakfast: true, lunch: "na", dinner: false },
        na: false,
        source: "manual",
      },
      THURSDAY
    );
    expect(r.score).toBe(50); // 1 of 2 counted slots
  });

  it("quantity caps at 100", () => {
    const mk = (v: number) =>
      scoreItem(get("water"), { itemId: "water", date: THURSDAY, value: v, na: false, source: "manual" }, THURSDAY)
        .score;
    expect(mk(40)).toBe(50);
    expect(mk(120)).toBe(100);
  });

  it("limit: under cap = 100, over penalized, floor 0", () => {
    const mk = (v: number) =>
      scoreItem(get("soda"), { itemId: "soda", date: THURSDAY, value: v, na: false, source: "manual" }, THURSDAY)
        .score;
    expect(mk(0)).toBe(100);
    expect(mk(3)).toBe(100);
    expect(mk(4)).toBe(75);
    expect(mk(10)).toBe(0);
  });

  it("limit honors per-weekday caps (Fri/Sat eBay flex)", () => {
    const mk = (v: number, date: string) =>
      scoreItem(
        get("ebay-hours"),
        { itemId: "ebay-hours", date, value: v, na: false, source: "timer" },
        date
      ).score;
    expect(mk(4, THURSDAY)).toBe(75); // 1h over weekday cap of 3
    expect(mk(4, FRIDAY)).toBe(100); // under Friday cap of 5
    expect(mk(6, FRIDAY)).toBe(75);
  });

  it("N/A excludes item", () => {
    const r = scoreItem(
      get("water"),
      { itemId: "water", date: THURSDAY, value: null, na: true, source: "manual" },
      THURSDAY
    );
    expect(r.score).toBeNull();
    expect(r.na).toBe(true);
  });
});

// ---------- day rollup ----------

describe("scoreDay", () => {
  it("perfect day is exactly 100", () => {
    const day = scoreDay({
      date: THURSDAY,
      domains,
      items,
      profile,
      logs: [
        { itemId: "meds", date: THURSDAY, value: 1, na: false, source: "manual" },
        {
          itemId: "insulin",
          date: THURSDAY,
          value: null,
          detail: { breakfast: true, lunch: true, dinner: true },
          na: false,
          source: "manual",
        },
        { itemId: "water", date: THURSDAY, value: 80, na: false, source: "manual" },
        { itemId: "soda", date: THURSDAY, value: 2, na: false, source: "manual" },
        { itemId: "ebay-hours", date: THURSDAY, value: 3, na: false, source: "timer" },
      ],
      cleaningTasks: [],
      cleaningLogs: [],
    });
    // ozempic not due Thursday; cleaning has no due tasks -> excluded; rest perfect
    expect(day.lifeScore).toBe(100);
  });

  it("weekly item enters only on its due day and N/A domains drop out", () => {
    const thursdayScores = scoreDay({ date: THURSDAY, domains, items, profile, logs: [] });
    const thursdayHealth = thursdayScores.domains.find((d) => d.domainId === "health")!;
    expect(thursdayHealth.items.find((i) => i.itemId === "ozempic")).toBeUndefined();

    const sundayScores = scoreDay({ date: SUNDAY, domains, items, profile, logs: [] });
    const sundayHealth = sundayScores.domains.find((d) => d.domainId === "health")!;
    expect(sundayHealth.items.find((i) => i.itemId === "ozempic")).toBeDefined();
  });

  it("weights shift domain influence but keep 0-100 bounds", () => {
    const logsGoodHealthBadBalance = [
      { itemId: "meds", date: THURSDAY, value: 1, na: false, source: "manual" as const },
      {
        itemId: "insulin",
        date: THURSDAY,
        value: null,
        detail: { breakfast: true, lunch: true, dinner: true },
        na: false,
        source: "manual" as const,
      },
      { itemId: "water", date: THURSDAY, value: 80, na: false, source: "manual" as const },
      { itemId: "soda", date: THURSDAY, value: 3, na: false, source: "manual" as const },
      { itemId: "ebay-hours", date: THURSDAY, value: 7, na: false, source: "timer" as const }, // 0 score
    ];
    const healthHeavy = scoreDay({
      date: THURSDAY,
      domains,
      items,
      profile,
      logs: logsGoodHealthBadBalance,
    });
    const balanceHeavy = scoreDay({
      date: THURSDAY,
      domains,
      items,
      profile: { ...profile, domainWeights: { health: 10, balance: 60, home: 15 } },
      logs: logsGoodHealthBadBalance,
    });
    expect(healthHeavy.lifeScore!).toBeGreaterThan(balanceHeavy.lifeScore!);
    expect(balanceHeavy.lifeScore!).toBeGreaterThanOrEqual(0);
    expect(healthHeavy.lifeScore!).toBeLessThanOrEqual(100);
  });

  it("cleaning checklist scores done/due among due tasks only", () => {
    const tasks: CleaningTask[] = [
      { id: "t1", area: "Kitchen", task: "Counters & dishes", schedule: { kind: "daily" }, active: true },
      { id: "t2", area: "Study", task: "Desk reset", schedule: { kind: "weekly", day: 4 }, active: true }, // Thursday
      { id: "t3", area: "Carport", task: "Sweep", schedule: { kind: "monthly", day: 1 }, active: true }, // not due
    ];
    const day = scoreDay({
      date: THURSDAY,
      domains,
      items,
      profile,
      logs: [],
      cleaningTasks: tasks,
      cleaningLogs: [{ taskId: "t1", date: THURSDAY, done: true, na: false }],
    });
    const home = day.domains.find((d) => d.domainId === "home")!;
    const cleaning = home.items.find((i) => i.itemId === "cleaning")!;
    expect(cleaning.score).toBe(50); // 1 of 2 due tasks done
  });
});

// ---------- profiles ----------

describe("profileFor", () => {
  it("picks the latest profile effective on or before the date", () => {
    const profiles: ScoringProfile[] = [
      { ...profile, version: 1, effectiveDate: "2026-01-01" },
      { ...profile, version: 2, effectiveDate: "2026-07-01" },
      { ...profile, version: 3, effectiveDate: "2026-08-01" },
    ];
    expect(profileFor(profiles, "2026-06-30").version).toBe(1);
    expect(profileFor(profiles, "2026-07-01").version).toBe(2);
    expect(profileFor(profiles, "2026-09-01").version).toBe(3);
  });
});

// ---------- effective date / 3 AM rollover ----------

describe("effectiveDate", () => {
  it("assigns 1:30 AM to the previous day, 9 AM to the same day (America/Chicago)", () => {
    // 2026-07-17T06:30Z == 01:30 Chicago (CDT, UTC-5)
    expect(effectiveDate(new Date("2026-07-17T06:30:00Z"), "America/Chicago")).toBe("2026-07-16");
    // 2026-07-17T14:00Z == 09:00 Chicago
    expect(effectiveDate(new Date("2026-07-17T14:00:00Z"), "America/Chicago")).toBe("2026-07-17");
  });
});
