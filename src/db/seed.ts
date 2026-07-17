// Seed Todd's starter catalog (design doc v0.3). Run: npm run db:seed
import { db, schema } from "./index";

const D = schema.domains;
const I = schema.items;
const C = schema.cleaningTasks;
const P = schema.scoringProfiles;
const U = schema.users;

async function seed() {
  await db
    .insert(U)
    .values({ id: "todd", mode: "calibration", timezone: "America/Chicago", settings: { reviewTime: "22:00" } })
    .onConflictDoNothing();

  await db
    .insert(D)
    .values([
      { id: "health", name: "Health", icon: "❤️", sort: 1 },
      { id: "family", name: "Family", icon: "👨‍👩‍👧‍👦", sort: 2 },
      { id: "balance", name: "Balance", icon: "⚖️", sort: 3 },
      { id: "home", name: "Home", icon: "🏠", sort: 4 },
      { id: "finance", name: "Finance", icon: "💵", sort: 5 },
      { id: "ebay", name: "eBay Ops", icon: "📦", sort: 6 },
    ])
    .onConflictDoNothing();

  await db
    .insert(I)
    .values([
      // ---- Health ----
      { id: "insulin", domainId: "health", name: "Insulin at meals", shape: "binary",
        config: { slots: 3, slotLabels: ["breakfast", "lunch", "dinner"] },
        schedule: { kind: "daily" }, sort: 1 },
      { id: "morning-meds", domainId: "health", name: "Morning meds", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 2 },
      { id: "ozempic", domainId: "health", name: "Ozempic dose", shape: "binary",
        config: {}, schedule: { kind: "weekly", day: 0 }, sort: 3 }, // Sunday; adjust to your dose day
      { id: "teeth", domainId: "health", name: "Brush teeth", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 4 },
      { id: "water", domainId: "health", name: "Water", shape: "quantity",
        config: { target: 80, unit: "oz", step: 8 }, schedule: { kind: "daily" }, sort: 5 },
      { id: "soda", domainId: "health", name: "Soda", shape: "limit",
        config: { cap: 3, unit: "cans", penaltyPerUnit: 25 }, schedule: { kind: "daily" }, sort: 6 },
      { id: "eating", domainId: "health", name: "Eating quality", shape: "rating",
        config: { max: 3, labels: ["Off the rails", "Rough", "Decent", "Clean day"] },
        schedule: { kind: "daily" }, sort: 7 },
      { id: "exercise", domainId: "health", name: "Exercise", shape: "quantity",
        config: { target: 30, unit: "min", step: 10 },
        schedule: { kind: "daysOfWeek", days: [1, 2, 3, 4, 5] }, sort: 8 },
      { id: "dexcom-worn", domainId: "health", name: "Wore Dexcom", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 9 },
      { id: "virgin-pulse", domainId: "health", name: "VirginPulse dailies", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 10 },
      // Time-in-range arrives in phase 2 (Dexcom API); created inactive so weights are ready.
      { id: "glucose-tir", domainId: "health", name: "Glucose time-in-range", shape: "range",
        config: { map: "direct" }, schedule: { kind: "daily" }, active: false, sort: 11 },

      // ---- Family ----
      { id: "kid-time", domainId: "family", name: "Focused kid time", shape: "quantity",
        config: { target: 45, unit: "min", step: 15 }, schedule: { kind: "daily" }, sort: 1 },
      { id: "couple-time", domainId: "family", name: "Couple time", shape: "quantity",
        config: { target: 30, unit: "min", step: 15 }, schedule: { kind: "daily" }, sort: 2 },
      { id: "family-activity", domainId: "family", name: "Family activity", shape: "binary",
        config: {}, schedule: { kind: "weekly", day: 6 }, sort: 3 },

      // ---- Balance ----
      { id: "ebay-hours", domainId: "balance", name: "eBay hours", shape: "limit",
        config: { cap: 3, unit: "h", penaltyPerUnit: 25, capByWeekday: { 5: 5, 6: 5 } },
        schedule: { kind: "daily" }, sort: 1 },
      { id: "vibecoding-hours", domainId: "balance", name: "Vibecoding hours", shape: "limit",
        config: { cap: 2, unit: "h", penaltyPerUnit: 25 }, schedule: { kind: "daily" }, sort: 2 },
      { id: "reading", domainId: "balance", name: "Daily reading", shape: "quantity",
        config: { target: 20, unit: "min", step: 10 }, schedule: { kind: "daily" }, sort: 3 },

      // ---- Home ----
      { id: "cleaning", domainId: "home", name: "Tidying checklist", shape: "checklist",
        config: { source: "cleaning" }, schedule: { kind: "daily" }, sort: 1 },
      { id: "mail", domainId: "home", name: "Mail processed", shape: "binary",
        config: {}, schedule: { kind: "weekdays" }, sort: 2 },

      // ---- Finance ----
      { id: "bills", domainId: "finance", name: "Bills current", shape: "binary",
        config: {}, schedule: { kind: "weekly", day: 5 }, sort: 1 }, // Friday (day off)
      { id: "recordkeeping", domainId: "finance", name: "Recordkeeping session", shape: "binary",
        config: {}, schedule: { kind: "weekly", day: 5 }, sort: 2 },
      { id: "spending-log", domainId: "finance", name: "Spending logged", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 3 },

      // ---- eBay Ops ----
      { id: "ship-orders", domainId: "ebay", name: "Ship pending orders", shape: "binary",
        config: {}, schedule: { kind: "daysOfWeek", days: [1, 2, 3, 4, 5, 6] }, sort: 1 }, // no Sundays
      { id: "ebay-messages", domainId: "ebay", name: "Answer messages", shape: "binary",
        config: {}, schedule: { kind: "daily" }, sort: 2 },
      { id: "new-listings", domainId: "ebay", name: "New listings", shape: "quantity",
        config: { target: 5, unit: "listings", step: 1 }, schedule: { kind: "weekly", day: 5 }, sort: 3 },
    ])
    .onConflictDoNothing();

  // ---- Cleaning tasks (tidy-focused; maid covers vacuum/dust/full cleans) ----
  // Weekly tasks staggered across the week so no day piles up.
  await db
    .insert(C)
    .values([
      { id: "kitchen-daily", area: "Kitchen", task: "Counters & dishes", schedule: { kind: "daily" } },
      { id: "bedroom-tidy", area: "Bedroom", task: "Tidy + surfaces", schedule: { kind: "weekly", day: 1 } },
      { id: "bath1-tidy", area: "Bathroom 1", task: "Quick tidy/wipe", schedule: { kind: "weekly", day: 2 } },
      { id: "bath2-tidy", area: "Bathroom 2", task: "Quick tidy/wipe", schedule: { kind: "weekly", day: 3 } },
      { id: "bath3-tidy", area: "Bathroom 3", task: "Quick tidy/wipe", schedule: { kind: "weekly", day: 4 } },
      { id: "family-tidy", area: "Family room", task: "Tidy", schedule: { kind: "daysOfWeek", days: [1, 4] } },
      { id: "living-tidy", area: "Living room", task: "Tidy", schedule: { kind: "daysOfWeek", days: [2, 5] } },
      { id: "study-desk", area: "Study", task: "Desk reset", schedule: { kind: "weekly", day: 5 } },
      { id: "study-full", area: "Study", task: "Full tidy", schedule: { kind: "monthly", day: 15 } },
      { id: "laundry-room", area: "Laundry room", task: "Tidy", schedule: { kind: "weekly", day: 6 } },
      { id: "laundry-chore", area: "Laundry", task: "Wash/dry/fold/put away", schedule: { kind: "daysOfWeek", days: [3, 6] } },
      { id: "carport-sweep", area: "Carport", task: "Sweep & tidy", schedule: { kind: "monthly", day: 1 } },
      { id: "carport-deep", area: "Carport", task: "Deep clean", schedule: { kind: "quarterly", months: [1, 4, 7, 10], day: 15 } },
      { id: "car-cleanout", area: "Car", task: "Clean out interior", schedule: { kind: "everyNWeeks", n: 2, day: 5, anchor: "2026-07-17" } },
      { id: "car-vacuum", area: "Car", task: "Vacuum interior", schedule: { kind: "monthly", day: 8 } },
      { id: "basement-tidy", area: "Basement (eBay HQ)", task: "Tidy work area", schedule: { kind: "weekly", day: 5 } },
      { id: "basement-reset", area: "Basement (eBay HQ)", task: "Deeper reset", schedule: { kind: "monthly", day: 22 } },
    ])
    .onConflictDoNothing();

  // ---- Profile v1 (doc §3 weights; item weights default 1, key items heavier) ----
  await db
    .insert(P)
    .values({
      effectiveDate: "2026-07-17",
      domainWeights: { health: 30, family: 20, balance: 15, home: 15, finance: 10, ebay: 10 },
      itemWeights: {
        insulin: 3, "morning-meds": 2, ozempic: 3, teeth: 1, water: 1, soda: 2, eating: 2,
        exercise: 2, "dexcom-worn": 1, "virgin-pulse": 1, "glucose-tir": 2,
        "kid-time": 2, "couple-time": 2, "family-activity": 1,
        "ebay-hours": 2, "vibecoding-hours": 2, reading: 1,
        cleaning: 2, mail: 1,
        bills: 2, recordkeeping: 1, "spending-log": 1,
        "ship-orders": 2, "ebay-messages": 1, "new-listings": 1,
      },
    })
    .onConflictDoNothing();

  console.log("Seeded.");
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
