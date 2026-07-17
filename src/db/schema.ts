import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  date,
  timestamp,
  doublePrecision,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Single-user app, but user row holds mode + settings.
export const users = pgTable("users", {
  id: text("id").primaryKey().default("todd"),
  mode: text("mode", { enum: ["calibration", "production"] })
    .notNull()
    .default("calibration"),
  timezone: text("timezone").notNull().default("America/Chicago"),
  settings: jsonb("settings").notNull().default({}), // reminder times, review time, etc.
});

export const domains = pgTable("domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  domainId: text("domain_id")
    .notNull()
    .references(() => domains.id),
  name: text("name").notNull(),
  shape: text("shape", {
    enum: ["binary", "quantity", "limit", "checklist", "range", "rating"],
  }).notNull(),
  config: jsonb("config").notNull().default({}),
  schedule: jsonb("schedule").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const scoringProfiles = pgTable("scoring_profiles", {
  version: serial("version").primaryKey(),
  effectiveDate: date("effective_date", { mode: "string" }).notNull(),
  domainWeights: jsonb("domain_weights").notNull(),
  itemWeights: jsonb("item_weights").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleaningTasks = pgTable("cleaning_tasks", {
  id: text("id").primaryKey(),
  area: text("area").notNull(),
  task: text("task").notNull(),
  schedule: jsonb("schedule").notNull(),
  active: boolean("active").notNull().default(true),
});

export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    date: date("date", { mode: "string" }).notNull(),
    value: doublePrecision("value"),
    detail: jsonb("detail"),
    na: boolean("na").notNull().default(false),
    source: text("source", {
      enum: ["manual", "timer", "dexcom", "ai-parse", "ai-photo"],
    })
      .notNull()
      .default("manual"),
    loggedAt: timestamp("logged_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("logs_item_date").on(t.itemId, t.date)]
);

export const cleaningLogs = pgTable(
  "cleaning_logs",
  {
    id: serial("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => cleaningTasks.id),
    date: date("date", { mode: "string" }).notNull(),
    done: boolean("done").notNull().default(false),
    na: boolean("na").notNull().default(false),
    loggedAt: timestamp("logged_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cleaning_logs_task_date").on(t.taskId, t.date)]
);

// Unscored tracked metrics (weight; later: glucose TIR raw, etc.)
export const metrics = pgTable(
  "metrics",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // "weight" | "glucose_tir" | ...
    date: date("date", { mode: "string" }).notNull(),
    value: doublePrecision("value").notNull(),
    meta: jsonb("meta"),
  },
  (t) => [uniqueIndex("metrics_kind_date").on(t.kind, t.date)]
);

// Cache of computed day scores (source of truth = logs + profiles).
export const dayScores = pgTable("day_scores", {
  date: date("date", { mode: "string" }).primaryKey(),
  lifeScore: doublePrecision("life_score"),
  domainScores: jsonb("domain_scores").notNull(),
  profileVersion: integer("profile_version").notNull(),
  provisional: boolean("provisional").notNull().default(false),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export const awards = pgTable("awards", {
  id: serial("id").primaryKey(),
  kind: text("kind", { enum: ["badge", "streak"] }).notNull(),
  key: text("key").notNull(),
  earnedDate: date("earned_date", { mode: "string" }).notNull(),
  meta: jsonb("meta"),
});

export const integrations = pgTable("integrations", {
  provider: text("provider").primaryKey(), // "dexcom"
  tokens: jsonb("tokens").notNull(),
  status: text("status").notNull().default("disconnected"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Meal photos: stored in R2 (phase 3); rating + AI description kept as data for the coach.
export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  slot: text("slot"), // breakfast/lunch/dinner/snack
  photoKey: text("photo_key"), // R2 object key
  aiRating: integer("ai_rating"), // 0-3
  aiDescription: text("ai_description"),
  userRating: integer("user_rating"), // override
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
