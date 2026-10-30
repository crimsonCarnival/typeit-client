# Usage analytics, privacy page, and tracking opt-out

Date: 2026-10-30
Repos: `typeit-client` (this one) and `typeit-server`. The spec lives here because most of the surface is client-side; the server parts are listed under "Server".

## Why

The owner wants to decide **which features are worth keeping** and **whether new features get used**. That needs to answer, for every feature: how many *different people* used it, how many *times*, whether that's growing or shrinking, and how guests compare with signed-in players.

Today only signed-in players' runs are saved, so guests (likely a large share of traffic) are invisible, and read-only pages (rankings, error map, replays…) leave no trace at all.

"How many times" alone was rejected as misleading: one heavy user running 200 code tests looks like a popular feature. **Distinct people is the primary number**; times is secondary.

## Goals

1. Count distinct people and times per feature and sub-feature, for guests and signed-in players, anonymously.
2. An admin **Usage** area with two tabs, each on its own URL:
   - **Feature usage** (`/admin/usage/features`): ranked bars, change vs previous period, expandable sub-features, rich tooltips.
   - **People over time** (`/admin/usage/trends`): Chart.js line chart of people per day/week for up to 5 chosen features or sub-features.
3. A general **privacy policy page** (`/privacy`) and a short **note on the About page** linking to it.
4. A **usage tracking toggle** in Settings, **on by default** (owner's decision), available to guests and signed-in players.

## Non-goals

- **Settings-changed tracking** (theme, caret, etc.) — explicitly dropped by the owner as not relevant.
- Migrating existing charts to Chart.js: they already use it (`performance-chart`, `session-history-chart`, `stats-charts`, About). The profile sparkline and landing-page illustrations stay hand-drawn SVG; they're decorative and Chart.js would add weight for nothing.
- Per-person usage views, funnels, session replay, heatmaps, A/B testing.
- URL routing for the existing admin tabs (Users, Races, Audit). Worth doing later, separate change.
- A consent banner. Default-on with an opt-out was chosen knowingly (see Constraints).

## Anti-goals (would make this a failure even if it works)

- Storing anything that identifies a person in the usage data: no raw visitor IDs, no IPs, no usernames, no user IDs, nothing typed.
- An action being triggerable or inflatable by anyone with a URL or a script, unchecked.
- Opting out not fully stopping collection (including from old open tabs).
- Numbers that look precise but compare unlike periods (e.g. showing a "previous 30d" change when only 10 days of previous data exist).

## Constraints

- Server: Express 5 + Mongoose, ES modules, `node:test`. Existing in-memory `rateLimit` middleware, permission system (`config/permissions.js`), `optionalAuth`.
- Client: Angular (signals, standalone components), Chart.js 4 already installed, `utils/chart-tokens.ts` turns `--color-*` tokens into canvas colours. **Use theme tokens, never hard-coded colours.**
- No client test suite exists; server has one (440+ tests) and new server logic gets tests.
- Legal: default-on was chosen over opt-in. The stored random browser ID is the part privacy law cares about (GDPR treats device identifiers as needing consent; Colombia's Ley 1581 may too). The owner accepted that tradeoff. The privacy page must describe it plainly, and the opt-out must be easy to find. **The owner should review the privacy text before it ships; it is not legal advice.**

## How it works

### Who counts as a person

- On first load, if tracking is on, the client creates a random ID (`crypto.randomUUID()`) and stores it in `localStorage`. This is the **visitor ID**.
- Signed-in players send the **same** browser visitor ID (not their account ID). So a guest who signs up is one person that day, not two. Accepted cost: one person on two devices counts as two; clearing browser data creates a "new" person.
- The server never stores the visitor ID. It stores `HMAC-SHA256(key, visitorId)` truncated to 16 bytes (hex). The key is derived from the existing `JWT_SECRET` (`HMAC(JWT_SECRET, 'usage-v1')`) so no new Render env var is required; an optional `USAGE_HASH_SECRET` overrides it. Rotating the key resets distinct counting going forward; that's acceptable.
- Each event is tagged **guest** or **signed-in** by whether the request carried a valid token.

### What gets counted (the event catalogue)

A fixed, server-side list. Anything not in it is dropped. Keys are dot-paths; a sub-feature is `parent.dimension=value`.

**Tests** — each with `started` and `finished` counted, so a finish rate exists. *My call:* these count **free-play runs only** (`/api/game/start`). Daily, lesson, practice and race runs have their own rows, so counting them here too would blur "which test mode do people choose":
- `test.words` — by `length` (the length option the player picked; time or word count, whichever the mode uses), `language` (from `WORD_LANGUAGES`), `modifiers` (none / punctuation / numbers / both)
- `test.phrases` — by `category` (`TEXT_CATEGORIES`: classics, quotes, speeches, gta)
- `test.code` — by `language` (`CODE_LANGUAGES`: javascript, python, go, rust, sql, bash)

**Modes & features:**
- `daily` — by `action`: attempt, ghost race after, opened a past day
- `lessons` — by `lesson` (1–12)
- `practice` — by `kind`: key drills, common words, review, word lists
- `race.live` — by `action` (created a room, joined a room, finished a race) and `size` (2, 3–4, 5+ players, counted at race start)
- `race.bot` — by `speed` (the `BOT_SPEEDS` values: 40/60/80/100). A bot race is client-only today (it starts as a normal run). *My call:* the client adds an optional `botWpm` field to the `/api/game/start` body. The server validates it against `BOT_SPEEDS`, records `race.bot` instead of `test.*`, and otherwise ignores it. That's no easier to fake than any other event, and it keeps the run itself counted once.

**Pages viewed** (no sub-features): rankings, error map, replays, achievements, stats, players, learn.

Adding a feature later = adding a catalogue entry on the server (and, for page views, a route mapping on the client). The dashboards read the catalogue, so they pick it up without UI changes.

### Where events come from (builder's guidance, my call)

- **Actions the server already handles** (test start/finish, daily attempt, ghost race, lesson/practice start, race create/join/finish, bot race start) are recorded **server-side**, where they already happen. The client attaches the visitor ID to every API request as an `X-Usage-Id` header (via the existing token interceptor) when tracking is on. This means a test only counts if it actually started on the server, which is harder to fake than a client "I did X" message. Guest runs already start server-side (`run-store.service.js`), so guests are covered.
  - The WebSocket race flow needs the visitor ID too; send it with the socket handshake/join.
- **Page views and client-only actions** (opening a past daily day) go through a small endpoint: `POST /api/usage/events` with `{ visitorId, events: [{ key }] }`, batched, sent on an interval and on `pagehide` via `fetch(..., { keepalive: true })`. Not `sendBeacon`: it can't carry the auth header, so events would be tagged guest and would skip the account opt-out check. The client maps router URLs to page-view keys.
- `POST /api/usage/events`: accepts only catalogued page-view/client keys, validates the ID is a UUID, caps events per request, rate-limited per IP (the IP is used in memory for limiting only, never stored), returns 204 regardless so it can't be probed.
- **New-ID cap (owner's decision):** besides the request rate limit, each IP may introduce at most **20 new visitor IDs per UTC day**. This applies to both the `X-Usage-Id` header path and `/events`. It's kept in memory only (IP → set of ID hashes, cleared daily, never persisted). An ID past the cap is ignored for usage, and the request itself still succeeds. IDs already seen from that IP that day keep counting. This turns "a fresh UUID per request" from thousands of fake people a day into 20. Accepted limits: the cap resets on server restart, and it doesn't stop spread-out abuse from many IPs. A real household or classroom behind one IP fits within 20.

### Opt-out

- **Settings → a "Usage statistics" toggle**, on by default, visible to guests too, with one line explaining it and a link to `/privacy`.
- **Precedence (my call): "off" wins.** A browser's local "off" is never overridden by an account's "on" synced from another device. `SettingsService`'s normal account↔local sync must special-case this key. The account stores `usageTracking` only after an explicit choice; there is no default written to it. A guest who explicitly opted out and then signs in or signs up writes `false` to the account. A GPC-derived default "off" stays local and is not written to the account. Turning it on is an explicit local choice and writes `true` to the account, but other devices that are locally "off" stay off.
- Off ⇒ the client deletes the visitor ID, stops attaching the header, stops sending events.
- Stored in `localStorage` for everyone; for signed-in players also in account settings (add `usageTracking: [true, false]` to `SETTINGS_SCHEMA`) so it follows them across devices. When a signed-in player loads with the account setting off, the local setting follows it.
- **Server enforces it too**: if the request's account has `usageTracking: false`, its events are dropped even if a stale tab still sends an ID.
- **Global Privacy Control** (`navigator.globalPrivacyControl === true`) makes the default **off** for that browser (my call: costs nothing, respects an explicit browser-level signal). The player can still turn it on.

### Storage

Collection `usage_days`, one document per **UTC day × key** (key includes sub-feature, e.g. `test.words.length=30`):

```
{ day: '2026-10-30', key: 'test.words.length=30',
  times: { guest: 41, user: 12 },          // started, for tests
  finished: { guest: 30, user: 11 },       // tests only
  visitors: { guest: [hash…], user: [hash…] },
  people: { guest: n, user: n, all: n } }  // filled when the sets are dropped
```

- Writes are `$inc` + `$addToSet`, upserted. Unique index on `{ day, key }`.
- **Retention: the hash sets are kept 180 days** — the 90d view compares against the *previous* 90 days, so 180 are needed for exact distinct counts. A daily job (follow the existing scheduler pattern in `notification-scheduler.js`) then writes the per-day `people` counts and unsets `visitors`. Older days still show people-per-day, but not exact distinct people across a range.
  - *Correction to what was said in conversation:* 90 days was mentioned earlier; 180 is what the 90d comparison actually needs.
- Daily counters themselves are kept indefinitely (they're tiny and contain nothing personal).
- A person may appear as both guest and signed-in on the same day (signed in mid-session). "All" is the union, so guests + signed-in can exceed all. The tooltip should not imply they add up.

### "Previous period" availability

The change vs previous period is shown only when the key has data covering the **whole** previous period: its first-seen day ≤ the first day of the previous period. Otherwise the change column shows "—" and the tooltip omits the Trend section. At launch, every feature shows "—" for the first full period.

**Partly covered current period (my call):** the summary returns each key's `firstSeen` day. When it falls inside the selected range, the row shows a small "tracked N days" marker, and the tooltip says "Only N of 30 days tracked". Rows still sort by people, but the marker keeps a new feature from being misread as unpopular. Same rule in the line chart: days before a key's first-seen day are `null` (a gap), not zero.

### Server API (admin)

New permission `usage.view` ("See usage statistics"). Admin and founder have it via full access. Routes behind `auth` + permission:

- `GET /api/admin/usage/summary?range=7|30|90&who=all|guests|signed-in` → the catalogue tree with, per node: `people` (+ `guests`, `signedIn`), `times`, `started`/`finished` for tests, and `prev` (people in previous period, or `null` when not available).
- `GET /api/admin/usage/series?keys=k1,k2,…(max 5)&range=7|30|90&who=…` → per key, buckets of distinct people. 7d/30d: one bucket per day. 90d: one bucket per week (Mon–Sun is fine; each bucket carries its `start` and `end` dates). Weekly buckets are distinct people within the week, not a sum of days.

Distinct counts across a range come from unioning the hash sets of the days in range (aggregation `$unwind` + `$group`), never by summing daily counts.

## Client

### Usage area (admin)

- Routes: `/admin/usage` → redirects to `/admin/usage/features`; `/admin/usage/trends`. Range and audience in query params (`?range=30d&who=all`) so links reproduce the view. Shown in the admin tabs when the player has `usage.view`.
- Shared toolbar on both tabs: range `7d | 30d | 90d` (default 30d) and audience `All | Guests | Signed in`.
- Content is **large**: 16px base text, 15px tooltips with generous padding (owner asked for readability).

**Feature usage tab** (approved mockup: v5 in `typeit/.superpowers/brainstorm/`):
- Groups: **Tests**, **Modes & features**, **Pages viewed**. Rows sorted by people within a group.
- Each row: name, stacked bar (guests / signed in), people, change vs previous same-length period as `▲ 12% (+90)` / `▼ 40% (−21)`, column header reading `vs prev. 30d` (follows the range).
- Rows with sub-features have an expand/collapse toggle (▸), with `aria-expanded`. Expanded rows list sub-features grouped by dimension ("By length", "By language"…). Sub-row bars use the **parent's** scale.
- Under an expanded row, one line: "A person can appear in several of these, so they don't add up to the total."
- **Tooltip** (hover, and keyboard focus on the row): name + range; guests (or "n/a (sign-in required)" for account-only features); signed in; times used and times per person; for tests, finish rate (finished of started); then a **Trend** section — previous period's people and the change — only when previous data is available.
- Bars are HTML/CSS, not Chart.js (my call: a table of expandable rows with bars is simpler, more accessible and easier to tooltip as HTML than as a canvas; the line chart is where Chart.js earns its place). Colours from theme tokens.

**People over time tab:**
- Chart.js line chart, people per day (7d/30d) or per week (90d). Previous-period comparison isn't drawn here.
- Under the chart, a checklist of **every** catalogue feature and sub-feature, grouped like the other tab; up to **5** selected at once (others disabled when 5 are picked). Default selection: the top 3 features by people.
- Tooltip in `index` mode, items sorted biggest first, value "N people" or "not tracked yet". **Title: the date for day buckets; `start – end` (e.g. "Oct 23 – Oct 29") for week buckets.**
- Gaps (null) before a key was tracked; no interpolation across them.
- Colours: a 5-colour series palette from theme tokens via `chart-tokens.ts` (add tokens if the theme lacks distinct series colours; check contrast in light and dark themes).

### Privacy page (`/privacy`)

Plain language, footer link, written to match what the code actually does. The builder must verify each statement against the code. Known facts to include:
- Account data: username, display name, email, password (bcrypt hash), optional Google sign-in (Google email), profile fields, settings.
- Gameplay: saved runs including keystroke logs (used for replays and integrity checks), stats, achievements, daily attempts, lessons, word lists, races, follows, blocks, notifications.
- Guests: runs are held in server memory briefly (30 min) and not saved.
- Browser storage: login token, settings, and (if tracking is on) the usage visitor ID.
- Usage statistics: what's counted, that it's anonymous (hashed ID, no IP/account link), retention (180 days for the hashed sets, then only daily totals), default on, how to turn it off, GPC honoured.
- **Server logs**: in production the server logs requests in Apache "combined" format (`morgan('combined')`), which includes **IP addresses and user agents**, kept by the host (Render) per its log retention. Say so.
- Hosting/processors: Vercel (front end), Render (server), MongoDB database hosted on AWS in N. Virginia, USA (us-east-1), so data is stored in the United States. Say so plainly, since players outside the US are covered by cross-border transfer rules. Also Google (only if signing in with Google), GitHub (changelog only; no player data).
- Account deletion: self-service (`DELETE /api/users/account`), what it removes.
- Contact: `CONTACT_EMAIL` (as the About page already does); if unset, omit the contact line.
- "Last updated" date.

### About page note

Short paragraph: "TypeIt counts which features get used, anonymously, so we know what's worth keeping. You can turn this off in Settings." Links to `/privacy` and Settings.

### Footer

Add a "Privacy" link next to the existing footer links.

## Server summary

- `config/usage.js`: the event catalogue (keys, dimensions, allowed values, which are page views).
- `models/usage-day.model.js`, `services/usage.service.js` (record, summarise, series, compaction job), `routes/usage.routes.js` (public `POST /api/usage/events`) and admin routes in `admin.routes.js`.
- Hook `usage.record(...)` into existing service points (run start/finish, daily, learn, race, bot race). Recording is fire-and-forget: it must never slow down or fail a gameplay request.
- `usage.view` permission; `usageTracking` settings key; CORS must allow the `X-Usage-Id` header; the per-IP new-ID cap.
- Tests (node:test): hashing never stores raw IDs; the 21st new ID from one IP in a day is ignored, while known IDs keep counting; catalogue rejects unknown keys/values; opted-out accounts are dropped; distinct counts union correctly across days (a person on 3 days counts once); `prev` is null when the period isn't fully covered; weekly buckets carry start/end; compaction keeps counts and drops sets.

## Left to the builder

- Exact client mapping of URLs → page-view keys, batching interval, request caps.
- Mongo aggregation shape and indexes beyond `{ day, key }`.
- Where in each service the record call sits, as long as "started" and "finished" mean what they say.
- Week bucket alignment (Mon–Sun is fine).
- Empty/loading/error states for both tabs (follow the admin page's existing patterns).
- Mobile layout: the tables can scroll horizontally inside their card; tooltips may become tap-to-show.

## Decisions log

Owner's decisions: track guests; cap new visitor IDs per IP per day (20); database on AWS us-east-1; distinct people matters; default on; privacy page + About note; opt-out toggle; mixed ranking + trend layout; tooltips everywhere; change % follows selected range; trend data inside the row tooltip; bigger content; hide "previous" when unavailable; line chart of trends; week tooltip shows start–end; two tabs with separate URLs; all features available in the trend chart; expandable sub-features; drop settings-changed tracking.

My calls (flagged for review): free-play-only test rows; `botWpm` on `/start` for bot races; "off wins" opt-out precedence; "tracked N days" marker; `fetch keepalive` instead of `sendBeacon`; browser visitor ID shared across sign-in; ID derived HMAC key from `JWT_SECRET`; server-side recording for actions; 180-day hash retention; GPC → default off; HTML bars instead of Chart.js on Feature usage; 5-line cap; finish rate in test tooltips; UTC day boundaries; `usage.view` permission; page-view list.
