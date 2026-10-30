# Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anonymous per-feature usage counting (distinct people + times, guests included), an admin Usage area with two tabs, a privacy page, an About note, and an opt-out toggle.

**Architecture:** Server records events into `usage_days` (one doc per UTC day × key) from the two places every run already passes (`/game/progress` first key, `/game/end`), from race socket messages, and from a small `/api/usage/events` endpoint for page views. Visitor IDs arrive as `X-Usage-Id` (or in the events body), are HMAC-hashed, and are capped at 20 new IDs per IP per day. The admin client reads `/api/admin/usage/summary` and `/series`.

**Tech Stack:** Express 5, Mongoose 9, node:test (server); Angular 20 standalone + signals, Chart.js 4 (client).

**Spec:** `docs/superpowers/specs/2026-10-30-usage-analytics-design.md`

## Global Constraints

- Never store raw visitor IDs, IPs, usernames or user IDs in usage data.
- Hash: `HMAC-SHA256(key, visitorId)` → first 32 hex chars; `key = USAGE_HASH_SECRET || HMAC(JWT_SECRET, 'usage-v1')`.
- New-ID cap: 20 new visitor IDs per IP per UTC day, in memory only.
- Visitor ID must match the UUID v4 format; anything else is ignored.
- Hash sets kept 180 days, then compacted to `people` counts.
- Ranges: 7 | 30 | 90 days; 90d series is weekly (Mon–Sun), with `start`/`end` per bucket.
- Usage recording is fire-and-forget: never awaited by, and never fails, a gameplay request.
- Client colours come from `--color-*` tokens (via `utils/chart-tokens.ts` for canvas).
- Opt-out: "off wins". Account field `usageOptOut` (boolean, like `leaderboardOptOut`), never synced through `SettingsService`.

## Review Focus

- A visitor who is guest in the morning and signs in later counts once in "All", and once each in guests and signed in. Test: `summary union counts a visitor once in all`.
- A key first seen 5 days ago with a 30d range: `prev` null, `firstSeen` returned. Test: `prev is null when the previous period is not fully covered`.
- An opted-out account still sending a header: dropped. Test: `record ignores opted-out accounts`.
- A malformed or hostile body on `/usage/events` (unknown key, 500 events, non-UUID): 204 and nothing written. Test: `events endpoint drops unknown keys and caps batch`.
- A replayed `/game/end` (the client retries) must not double-count `finished`. Count finished only when `endGame` succeeds for an incomplete run (the controller already rejects a finished run with 400).

---

### Task 1: Server catalogue, hashing, cap, recording

**Files:**
- Create: `server/src/config/usage.js`, `server/src/models/usage-day.model.js`, `server/src/services/usage.service.js`
- Test: `server/test/usage.test.js`

**Interfaces (produces):**
- `USAGE_CATALOGUE`: array of `{ key, group: 'tests'|'features'|'pages', label, account?: true, finish?: true, dims?: { [dim]: { label, values: string[] } } }`
- `PAGE_KEYS`: Set of page/client keys accepted from `/usage/events`
- `hashVisitor(id: string): string | null` — null when not a UUID
- `admitVisitor(ip: string, hash: string, now?: number): boolean` — the 20-per-IP-per-day cap
- `record({ visitorId, ip, user, key, dims?, finished? }): void` — fire-and-forget. Writes the parent key, plus one doc per `dim=value` pair, with `$inc` on `times.{guest|user}` (or `finished.*`) and `$addToSet` on `visitors.{guest|user}`. Ignores unknown keys/values, opted-out users (`user.usageOptOut`), bad IDs and IDs over the cap. Swallows errors.
- `runUsage(run, botWpm?): { key, dims } | null` — maps a session/guest run to a catalogue entry: `dailyDate && practice?.kind !== 'ghost'` → daily/attempt; `practice.kind === 'ghost'` → daily/ghost; `practice.kind === 'lesson'` → lessons/lesson=<index 1–12 from LESSONS order>; other practice kinds → practice/kind (drill and weak-keys → drills; common-words; review; list → word lists); `raceCode` → race.live/finished-or-started; `botWpm ∈ BOT_SPEEDS` → race.bot/speed; else `test.<gameMode>` with words: length=`timeMax`s, language, modifiers; phrases: category; code: language.

- [ ] Tests first: hashVisitor rejects non-UUIDs and is stable; the cap admits 20 new hashes per IP, rejects the 21st, keeps admitting known ones, resets next day; record ignores opted-out accounts and unknown keys; record writes parent + dim docs with the right `$inc`/`$addToSet` (mock `UsageDay.updateOne`); runUsage maps each run shape above.
- [ ] Implement, run `npm test`, commit `feat(usage): record anonymous feature usage`.

### Task 2: Server wiring (game, race, events endpoint, opt-out, CORS)

**Files:** `controllers/game.controller.js` (progress: record start when `run.startedAt` was null before `appendKeys`; end: record start too if it wasn't started, then finished after `endGame`), `sockets/race.socket.js` (auth msg carries `usageId`; record `race.live` action=created on `create`, joined on `join`/`queue`), `routes/usage.routes.js` + `routes/index.js` (`POST /usage/events`, `optionalAuth`, own rate limit 30/min/IP, ≤ 20 events, 204 always), `models/user.model.js` + `controllers/auth.controller.js` (`usageOptOut`), `routes/user.routes.js` (`PUT /users/usage-opt-out { optOut: boolean }`), `server.js` CORS `allowedHeaders` add `X-Usage-Id`, `config/permissions.js` (`usage.view`). `botWpm` is read from the `/progress` and `/end` body (the run is already created by then; deviation from spec's `/start`, same trust level).
- [ ] Test: events endpoint drops unknown keys and caps batch (unit-test the handler); `usage.view` exists in `PERMISSION_IDS`.
- [ ] `npm test` green, commit `feat(usage): count runs, races and page views`.

### Task 3: Server summary, series, compaction

**Files:** `services/usage.service.js` (+ `summary({ range, who, now })`, `series({ keys, range, who, now })`, `compact(now)`), `routes/admin.routes.js` (`GET /usage/summary`, `GET /usage/series` behind `can('usage.view')`), daily `compact` timer started from `server.js`.
- `summary` → `{ range, who, rows: [{ key, label, group, account, people, guests, signedIn, times, finished?, prev: number|null, firstSeen: string|null, children: [{ dim, label, rows: [...] }] }] }`.
- `series` → `{ buckets: [{ start, end }], lines: [{ key, label, data: (number|null)[] }] }`; null before `firstSeen`.
- Distinct = union of hash sets over the days (aggregation `$unwind` + `$group` by key → `$addToSet`); for compacted days fall back to summing `people`.
- [ ] Tests: summary union counts a visitor once in all; prev is null when the previous period is not fully covered; weekly buckets carry start/end and Monday alignment; compaction keeps counts and drops sets past 180 days. Pure helpers (`rangeDays`, `weekBuckets`, `unionCounts`) carry the logic so tests don't need Mongo.
- [ ] Commit `feat(usage): admin usage summary and series`.

### Task 4: Client tracking + opt-out

**Files:** create `client/src/app/services/usage.service.ts` (visitor ID in `ls` key `usageId`, opt-out in `usageOptOut`, GPC default; `enabled` signal; `track(key)` batched every 10 s and on `pagehide` via `fetch` keepalive; router page-view mapping), `core/token.interceptor.ts` (add `X-Usage-Id` when enabled), `services/game.service.ts` (send `botWpm` with progress/end), race socket auth message (`usageId`), `pages/settings` (toggle row), `models/models.ts` + `auth.service.ts` normalizeUser (`usageOptOut`), `user-api.service.ts` (`setUsageOptOut`).
- [ ] `npx ng build` passes; commit `feat(usage): anonymous usage tracking with opt-out`.

### Task 5: Privacy page, About note, footer link

**Files:** `pages/privacy/privacy.component.{ts,html,css}`, `app.routes.ts` (`privacy`), `app.html` footer, `pages/about` note.
- [ ] Build passes; commit `feat(privacy): add privacy policy page`.

### Task 6: Admin Usage area

**Files:** `pages/usage/usage.component.{ts,html,css}` (both tabs, URL `admin/usage/:tab`, `?range=&who=`), `services/admin-api.service.ts` (`usageSummary`, `usageSeries`), `models/models.ts` (`UsageRow`, `UsageSummary`, `UsageSeries`), `app.routes.ts` (+ `usageGuard` = `usage.view`), admin tab bar link.
- [ ] Build passes; commit `feat(admin): usage dashboard`.
