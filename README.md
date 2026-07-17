# Sanctify 🏆

A personal PWA that gamifies balanced living: every tracked habit scores 0–100, rolls up through
weighted domains into a single daily **Life Score**, and stays comparable over time even as goals
and weights change (versioned scoring profiles). See `Sanctify-Design-Doc.md` in the project
folder for the full design.

## Stack

Next.js 16 (App Router, PWA) · Neon Postgres · Drizzle ORM · Vercel · single-user passcode auth.

## One-time setup (~10 minutes)

### 1. Neon database (free)

1. Create a project at [neon.tech](https://neon.tech) (free tier).
2. Copy the **pooled connection string** (Connect → "Pooled connection").

### 2. Vercel (free)

1. At [vercel.com](https://vercel.com), **Add New → Project → Import** the `colporteur/sanctify` GitHub repo.
2. Under **Settings → Environment Variables**, add:
   - `DATABASE_URL` — the Neon connection string
   - `APP_PASSCODE` — the passcode you'll use to log in
   - `SESSION_SECRET` — any long random string (`openssl rand -base64 32`)
3. Deploy. Every future `git push` auto-deploys.

### 3. Create tables and seed the starter catalog

From a machine with the repo cloned (or ask Claude to run it):

```bash
cp .env.example .env.local   # fill in the same three vars
npm install
npm run db:push              # creates tables in Neon from src/db/schema.ts
npm run db:seed              # loads Todd's starter catalog (domains, items, cleaning tasks, profile v1)
```

### 4. Install on your phone

Open the Vercel URL in Safari/Chrome on your phone → Share → **Add to Home Screen**. It runs
standalone like a native app.

## Local development

```bash
npm install
cp .env.example .env.local   # point DATABASE_URL at Neon (or a dev branch of it)
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Scoring-engine unit tests (vitest) |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Seed starter catalog (idempotent) |

## How scoring works (short version)

- Items score 0–100 by shape: binary, quantity (vs target), limit (under-cap, per-weekday caps),
  checklist (done ÷ due), range (direct %), rating (0–3).
- Domain score = weighted average of *due* items; Life Score = weighted average of domains with
  due items. N/A items drop out of the denominator. A perfect day is always exactly 100.
- Weight changes create a new **scoring profile** effective that day; history keeps its old
  profile, so scores stay comparable forever.
- Day rolls over at 3 AM America/Chicago.

## Roadmap

- **Phase 1 (this)** — logging, scoring, calibration mode, core screens
- **Phase 2** — full Trends analytics, push reminders (10 PM review w/ snooze, morning meds, weekly Ozempic), what-if weight preview, export
- **Phase 3** — Dexcom time-in-range, meal-photo AI scoring (R2 + OpenRouter), weekly AI coach, natural-language logging
- **Phase 4** — production lock, XP/levels/badges/streak freezes
