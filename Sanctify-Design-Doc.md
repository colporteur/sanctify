# Sanctify — Design Document (v0.3 — Approved for Build)

*A gamified life-balance scoring app for Todd. v0.3 finalizes: Ozempic weekly dose item, tidy-focused cleaning (maid handles vacuuming/dusting/full cleans), no bed-making, no PhotoDeleter, meal photos feed the AI coach, evening review at 10 PM with early-call and snooze, Fri/Sat eBay cap 5 h, insulin = breakfast/lunch/dinner only. Repo: `colporteur/sanctify`.*

---

## 1. Vision & Principles

Sanctify turns daily living into a single, honest number — the **Life Score** — computed from everything you choose to track: health habits, home care, finances, family time, work discipline, and balance. The design is guided by five principles:

1. **A perfect day is always 100.** No matter how many items you track or how you weight them, the score is a percentage of what was *possible that day*. This is what keeps scores comparable across months and across changes in focus.
2. **Low friction beats high fidelity.** A habit app dies when logging becomes a chore. Most logs are one tap; anything measurable automatically gets automated (Dexcom in phase 2); an evening review sweeps up the rest.
3. **Balance is scored, not just activity.** Overdoing eBay or vibecoding *costs* points via limit-type items. The score rewards a balanced day, not a maximal one.
4. **Everything is data-driven, nothing is hard-coded.** Adding a new thing to track is a form, not a code change. Weights, targets, schedules, and scoring shapes are all configuration.
5. **The score is honest.** Streaks, badges, and XP make it fun, but they live *outside* the 0–100 score so the number itself never inflates.

---

## 2. The Scoring Engine

### 2.1 Item scoring shapes

Every tracked item produces a daily **item score** from 0–100 using one of six shapes:

| Shape | How it scores | Example items |
|---|---|---|
| **Binary** | Done = 100, not done = 0 | Took meds, wore Dexcom, brushed teeth (AM and PM as two checkoffs → 0/50/100) |
| **Quantity** | `min(logged ÷ target, 1) × 100` | Water (target 80 oz), exercise (target 30 min), reading (target 20 min), kid time (target 45 min) |
| **Limit** (inverse) | At or under cap = 100; each unit over subtracts a penalty. Caps can vary **per weekday** (e.g., a looser eBay cap on your Friday off and Saturday) | Soda (cap 3/day to start, −25 per extra), eBay hours (cap 3 h weekdays / 5 h Fri–Sat, −25/h over), vibecoding hours (cap 2 h, −25/h over) |
| **Checklist** | `completed ÷ due × 100` | Cleaning tasks due today, eBay routine tasks (ship orders, answer messages, list N items) |
| **Range/Metric** | A measured percentage or a value mapped through a curve | Dexcom time-in-range (maps directly), weight vs. trend goal |
| **Rating** | Self-rated 0–3 mapped to 0/33/67/100 | Healthy eating quality for the day |

Design notes on the trickier ones:

- **Healthy eating — photo-first, self-rating fallback.** The plan: snap each meal *inside the Sanctify app* (in-app camera capture goes straight to app storage — it never touches your camera roll, so no clutter to clean up). A vision model via OpenRouter returns a 0–3 healthiness rating plus a line of feedback ("solid protein and veg; the fries and the 32 oz soda are what's dragging this down"); you confirm or override. On days when you didn't photograph most meals, the evening review falls back to the plain self-rating (0 = off the rails, 3 = clean day). Photos land in Cloudflare R2 (free 10 GB tier — years of meal photos). If you sometimes shoot with the native camera and share into the app instead, that's where PhotoDeleter could sweep up — tell me how it identifies photos to delete (album? filename tag? where does it run?) and we'll wire the two together.
- **Time tracking for eBay & vibecoding — dual timers plus chunks.** The Today screen gets two independent stopwatch chips (eBay, Vibecoding) that can run **simultaneously** — when you're vibecoding on eBay tooling, both clocks count, matching how you actually work. Alongside the timers: quick-add buttons (+15 m / +30 m) and a manual entry field for small chunks logged after the fact. An item's daily total = timer time + chunks, and pure self-estimation at evening review remains available as the lazy path.
- **Insulin & meds are separate items.** Insulin is a 3-slot checklist tied to meals (breakfast / lunch / dinner — each slot check-off, so 2 of 3 scores 67); morning meds are a single binary with a morning push reminder. A meal marked N/A (skipped lunch) drops that slot from the denominator.
- **Weight** starts as a *tracked metric, not a scored item* — you log it, it charts, but it doesn't move the daily score (daily weight noise would punish you randomly). If you want it scored later, the right shape is "weekly trend vs. goal."
- **Cleaning** gets its own sub-system: a library of rooms → tasks, each with its own schedule (full proposed set for your house in §3.1). The daily "Home care" checklist item scores completed-÷-due among tasks due that day, and the scheduler **staggers** weekly/monthly tasks across days so no single day is crushing — you never face everything at once.
- **VirginPulse** starts as a binary "did my VirginPulse dailies" checkoff (no public API exists). If their site proves automatable later, we can revisit.
- **Blood sugar (phase 2)**: Dexcom's official API reports estimated glucose values, from which we compute daily **time-in-range %** — that percentage *is* the item score. Until then, "wore Dexcom" is a binary item.

### 2.2 Schedules and N/A

Every item has a **schedule**: daily, specific weekdays, N×/week, weekly, or monthly. An item only enters the day's math when it's **due**. This solves the weekly-cleaning and weekly-finance problem cleanly — Tuesday isn't penalized for the bathroom you clean on Saturday.

Any due item can be marked **N/A** for the day (sick, traveling, no eBay orders to ship). N/A items drop out of the denominator instead of scoring zero. Unlogged items at day close (3:00 AM) count as 0 — the evening review exists so that's rare. Logs stay editable for 48 hours (indefinitely during calibration).

### 2.3 Rollup math

Items belong to **domains**; domains roll up to the Life Score:

```
DomainScore_d  = Σ (w_i × s_i) ÷ Σ w_i        over items due today in domain d
LifeScore      = Σ (W_d × D_d) ÷ Σ W_d        over domains with ≥1 due item today
```

Because both levels divide by the sum of *active* weights, the score is always "percent of today's possible." Weights are relative — you set them as sliders and the app shows the normalized percentages, so you can "tinker" freely without needing them to sum to anything.

### 2.4 Scoring profiles (how weights change without breaking history)

The full set of weights + item configs at any moment is a **scoring profile**. Editing weights creates a new profile version effective from that day; old days remain scored under the profile active at the time. Profiles are immutable once superseded.

- **Comparability:** since every profile's perfect day is 100, an 82 under your 2026 "health focus" profile means the same thing as an 82 under a future "finance focus" profile: 82% of what you asked of yourself. Charts show a subtle marker at each profile boundary so you can see regime changes.
- **What-if preview:** when tinkering with weights, the app re-computes your last 14 days under the draft profile side-by-side before you commit — so you can see "under these weights, my week would have averaged 74 instead of 81."

### 2.5 Calibration → Production lifecycle

- **Calibration mode (weeks 1–2+):** scores display with a "provisional" badge; weight changes can *retroactively re-score* the calibration period so you converge on a fair baseline; logs editable anytime.
- **Production mode:** you flip a switch. From then on profile changes apply forward-only, the 48-hour edit window applies, and your streaks/XP "count." You can still return a future period to calibration deliberately (e.g., after a major life change) — it just gets flagged on charts.

### 2.6 Gamification layer (outside the score)

- **XP & levels:** cumulative XP = sum of daily Life Scores (production days only). Levels are XP thresholds. Never resets, never inflates the daily score.
- **Streaks:** per-item and whole-score streaks (e.g., "7 days ≥ 75"), shown as flames; an occasional "streak freeze" token prevents one bad day from feeling catastrophic (this is a known retention mechanic worth stealing).
- **Badges:** milestone awards (first 90 day, 30-day meds streak, first full-clean week of the house, TIR ≥ 80% week, etc.).

---

## 3. Starter Catalog (proposed — this is the part to argue with)

Proposed domains and weights (sliders, shown normalized):

| Domain | Weight | Items (shape, target/cap, schedule) |
|---|---|---|
| **Health** — 30% | | Insulin at meals (checklist ×3, daily — breakfast/lunch/dinner, no snack doses) · Morning meds (binary, daily) · **Ozempic dose (binary, weekly — escalating reminders until logged, since this is the one you forget)** · Teeth (binary, once daily) · Water (quantity, 80 oz, daily) · Soda (limit, cap 3, daily — see ramp note) · Eating quality (photo-AI 0–3 with self-rating fallback, daily) · Exercise (quantity, 30 min, 5×/week) · Wore Dexcom (binary, daily) · Time-in-range (range, phase 2) · VirginPulse dailies (binary, daily) · Weight (metric only — charted, unscored; manual entry) |
| **Family** — 20% | | Focused kid time (quantity, 45 min, daily) · Couple time with wife (quantity, 30 min, daily) · Family activity (binary, weekly) |
| **Balance** — 15% | | eBay hours (limit, cap 3 h weekdays / **5 h Fri–Sat**, daily) · Vibecoding hours (limit, cap 2 h, daily) · Daily reading (quantity, 20 min, daily) |
| **Home** — 15% | | Cleaning checklist (checklist, room/task schedules in §3.1) · Mail processed (binary, weekdays) |
| **Finance** — 10% | | Bills current (binary, weekly review) · Recordkeeping session (binary, weekly) · Spending logged (binary, daily or N×/week) |
| **eBay Ops** — 10% | | Ship pending orders (checklist, daily **except Sunday**) · Answer messages (binary, daily) · New listings (quantity, N/week — you set N) |

Every number above is a slider you'll adjust during calibration. Items you haven't thought of yet get added through the same form: name → shape → target/cap → schedule → domain → weight.

**Goal ramps.** For "get lower eventually" goals like soda, an item can carry an optional ramp: e.g., cap 3 now, and every 6–8 weeks the app proposes dropping it by one (you approve, which versions the profile). Comparability holds — a 100 always means "hit the standard I'd set for myself at the time," which is exactly what a ratcheting goal should mean.

### 3.1 Cleaning system — tidy-focused defaults (maid covers vacuuming, dusting, and full cleans)

| Area | Tasks & frequencies |
|---|---|
| Kitchen | Counters & dishes (daily) |
| Bedroom | Tidy + surfaces (weekly) — no bed-making except special occasions |
| Bathroom 1 / 2 / 3 | Quick tidy/wipe (weekly, each — staggered) |
| Family room | Tidy (2×/week) |
| Living room | Tidy (2×/week) |
| Study | Desk reset (weekly) · Full tidy (monthly) |
| Laundry room | Tidy (weekly) |
| Laundry (the chore) | Wash/dry/fold/put away (2×/week) |
| Carport | Sweep & tidy (monthly) · Deep clean (quarterly — maid doesn't touch this) |
| Car | Clean out interior (every 2 weeks) · Vacuum interior (monthly) — no exterior washing |
| Basement (eBay HQ) | Tidy work area (weekly) · Deeper reset (monthly) — this is your workspace, so it gets real attention |

Only tasks *due that day* count toward the score, so a normal day might have 2–4 cleaning check-offs, not thirty. Name the three bathrooms whatever you like in settings.

---

## 4. Data Model (Neon Postgres)

```
users               id, email, passcode_hash, mode (calibration|production), settings jsonb
domains             id, name, icon, sort
items               id, domain_id, name, shape, config jsonb (target/cap/penalty/rating labels),
                    schedule jsonb, active, sort
scoring_profiles    id, version, effective_date, weights jsonb (full domain+item weight snapshot),
                    created_at   -- immutable; current = max(effective_date <= today)
cleaning_tasks      id, room, task, frequency, last_done   -- feeds the Home checklist item
logs                id, item_id, date, value numeric, detail jsonb, source (manual|dexcom|ai-parse),
                    na boolean, logged_at
metrics             id, kind (weight|glucose_tir|...), date, value   -- unscored tracked data
day_scores          date, life_score, domain_scores jsonb, profile_version, provisional,
                    computed_at   -- cache; recomputable from logs at any time
integrations        id, provider (dexcom), tokens jsonb, status
awards              id, kind (badge|streak), key, earned_date, meta jsonb
```

Key property: `day_scores` is a pure cache. The source of truth is `logs` + `scoring_profiles`, so we can always re-derive history (essential for calibration re-scoring and what-if previews).

---

## 5. App Screens (PWA)

1. **Today** — the home screen. Big Life Score ring, domain rings beneath, the due-item list as one-tap check-offs / steppers (water +8 oz per tap), the two stopwatch chips (eBay / Vibecoding — can run concurrently) with quick-add time chunks, and a camera button for meal photos. Add-anything quick log at top.
2. **Evening Review** — a guided sweep of anything unlogged, the eating rating, hours estimates for eBay/vibecoding, and tomorrow preview. Push reminder at **10:00 PM**, callable early anytime from the Today screen, and snoozable 15 or 30 minutes from the notification.
3. **Trends** — daily Life Score line with 7-day rolling average, stacked domain-contribution chart, per-item calendar heatmaps, weekday-pattern chart ("Tuesdays average 9 points lower"), correlation view (e.g., soda vs. eating rating vs. TIR), weight and TIR trend lines. Profile-change and calibration markers on all time axes.
4. **Items & Weights** — the catalog editor with weight sliders, normalized-percentage display, and the 14-day what-if preview. Cleaning room/task editor lives here.
5. **Awards** — XP, level, streaks, badges.
6. **Settings** — mode switch (calibration/production), reminder times, Dexcom connect (phase 2), data export (CSV/JSON — your data stays yours).

PWA details: installable on your phone home screen, offline-capable logging (syncs when back online), web push notifications for item reminders and the evening review (supported on iOS 16.4+ installed PWAs and Android).

---

## 6. Integrations & Automation

**Dexcom (phase 2).** Official, free developer API with OAuth. You register a free app at developer.dexcom.com (~10 min, one-time); I build the OAuth flow and a nightly job that pulls estimated glucose values and computes daily time-in-range. Two caveats from Dexcom's docs: data is served with a **~3-hour delay** (fine for daily scoring; not for real-time alerts) and it's **retrospective US-user data** — both compatible with our use.

**OpenRouter (phase 3).**
- *Meal-photo scoring:* in-app photo → R2 storage → vision model returns 0–3 rating + feedback → you confirm. Self-rating remains the fallback. Even at 3–4 photos/day this is well under a dollar a month on a cheap multimodal model.
- *Weekly Coach's Review:* a Sunday job sends your week's numbers **and your meal-photo ratings/descriptions** to a model and returns a short narrative — patterns, wins, one suggested focus ("your TIR dips track the late-night eating photos; Tuesday sodas correlate with heavy eBay days"). The photo history is deliberately kept as structured data (rating + AI description per meal) so the coach can reason over weeks of eating without re-processing images. Cost: pennies/month.
- *Natural-language logging:* type or dictate "2 sodas, biked 40 min, cleaned the kitchen" and the model parses it into structured logs (marked `source: ai-parse`, always shown for confirmation).

**VirginPulse:** manual binary for now — no public API.

**Weight:** manual entry (no smart scale — confirmed).

---

## 7. Stack, Cost & Deployment

| Piece | Choice | Cost |
|---|---|---|
| App | Next.js (App Router) PWA, Tailwind, Recharts | free |
| Hosting | Vercel Hobby (includes cron for nightly jobs) | free |
| Database | Neon Postgres free tier (plenty for one user's logs) | free |
| Source | GitHub repo (private) under **colporteur**, Vercel auto-deploys on push | free |
| Photo storage | Cloudflare R2 (10 GB free tier) for meal photos | free |
| Domain | Skipped — the free `*.vercel.app` URL works fine for a personal PWA | $0 |
| AI | OpenRouter, cheap models: weekly review + photo scoring + parse calls | <$1/mo |
| Dexcom API | Official developer program | free |

Auth is a single-user passcode session (it's your private app; we can add real OAuth later if the family joins). Workflow: I scaffold and build in this session's workspace, push to a GitHub repo you own, Vercel deploys automatically; your local `Sanctify` folder holds a clone of the repo so you always have the code on your machine.

---

## 8. Build Roadmap

- **Phase 0 — this document.** Agree on scoring math, starter catalog, and screens.
- **Phase 1 — Trial-ready MVP (the big one).** Repo + schema + auth, item/domain/weight editors, cleaning task system, Today screen with one-tap logging, evening review, scoring engine with profiles and calibration mode, deploy to Vercel. *You start your 2-week trial the day this ships.*
- **Phase 2 — Insight.** Full Trends screen, push reminders, what-if weight preview, data export. (Ideally lands during your trial so calibration is informed by charts.)
- **Phase 3 — Automation.** Dexcom OAuth + nightly TIR job; meal-photo AI scoring (R2 + vision model); OpenRouter weekly review + natural-language logging.
- **Phase 4 — Production polish.** Production-mode lock, XP/levels/badges/streak-freezes, PWA offline hardening.

---

## 9. Decision Log

All design questions resolved as of v0.3: soda cap 3/day with downward ramp later · teeth once daily · insulin at breakfast/lunch/dinner (no snack doses) + morning meds + **weekly Ozempic with escalating reminders** · eBay cap 3 h weekdays / 5 h Fri–Sat · no order shipping Sundays · tidy-focused cleaning per §3.1 (maid handles vacuum/dust/full cleans; car vacuum monthly; carport deep clean quarterly; basement eBay HQ weekly) · no bed-making · dual concurrent timers + chunk entry · meal photos scored by AI and retained as structured data for the weekly coach · no PhotoDeleter integration · evening review 10 PM, early-call + 15/30-min snooze · GitHub `colporteur/sanctify` (created) · Sanctify folder connected · no custom domain · no smart scale.
