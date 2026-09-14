# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# vega-vireos-cf

A Cloudflare Workers rewrite of [vega-vireos](../vega-vireos), a bird sighting
tracker for Durham Central Park, NC powered by the eBird API. The original runs
as a Flask/SQLite/APScheduler app in Docker behind a Cloudflare Tunnel; this
rewrite targets a fully serverless, statically-served deployment with no home
server dependency.

## Architecture

```
Cloudflare Cron Trigger (hourly)
  └─ Worker: polls eBird API → writes sightings to D1

HTTP requests
  └─ Worker (Hono router): reads D1 → renders HTML responses

Static assets (htmx.min.js, favicon.svg, cardinal.svg, cardinal-card.png)
  └─ Served directly by Workers Assets from ./public/
```

No server to manage. No Docker. No tunnel. Everything runs in Cloudflare's
free tier (100k req/day, 5GB D1, Cron Triggers included).

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Cloudflare Workers (TypeScript) | |
| Router | [Hono](https://hono.dev) | Lightweight, first-class Workers support |
| Database | Cloudflare D1 | Managed SQLite; query syntax is identical to original |
| Scheduler | Cloudflare Cron Triggers | Replaces APScheduler; configured in wrangler.toml |
| Static assets | Workers Assets | Copy `public/` from original `app/static/` |
| Templating | Hono JSX (`hono/jsx`) | `.tsx` components; auto-escaping, type-safe, zero extra deps |

## D1 Schema

The schema is split across three migrations (logical full schema shown below).
Syntax is identical to the original SQLite — no translation needed.

- `0001_initial.sql` — the four base tables (`sighting_days`, `sightings`,
  `species`, `poll_status`)
- `0002_indexes.sql` — perf indexes: `idx_sightings_obs_date` on
  `sightings(obs_date)`, `idx_species_fetched_at` on `species(fetched_at)`
- `0003_checklist_comments.sql` — the `checklist_comments` table and its
  `idx_checklist_comments_obs_date` index

```sql
CREATE TABLE IF NOT EXISTS sighting_days (
    obs_date TEXT PRIMARY KEY,
    polled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sightings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    obs_date TEXT NOT NULL,
    species_code TEXT NOT NULL,
    common_name TEXT NOT NULL,
    sci_name TEXT NOT NULL,
    location_name TEXT,
    how_many INTEGER,
    obs_valid INTEGER NOT NULL,
    obs_reviewed INTEGER NOT NULL,
    sub_id TEXT,
    notable INTEGER NOT NULL DEFAULT 0,
    UNIQUE(obs_date, species_code)
);

CREATE TABLE IF NOT EXISTS species (
    species_code TEXT PRIMARY KEY,
    thumbnail_url TEXT,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_status (
    id INTEGER PRIMARY KEY,
    polled_at TEXT NOT NULL,
    success INTEGER NOT NULL,
    count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_comments (
    sub_id TEXT PRIMARY KEY,
    obs_date TEXT NOT NULL,
    observer_name TEXT,
    comment_text TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);
```

Apply with: `wrangler d1 migrations apply birds --local` (dev) or
`wrangler d1 migrations apply birds --remote` (production).

## Routes

Port from `../vega-vireos/app/routes.py`. Use Hono handlers.

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/` | `index` | Today's week strip + day detail; reads poll_status |
| GET | `/week/:anchor` | `weekView` | Returns week_strip HTML fragment (HTMX target) |
| GET | `/day/:obsDate` | `dayDetail` | Returns day_detail HTML fragment (HTMX target) |
| POST | `/admin/poll` | `adminPoll` | Triggers immediate poll; auth via `POLL_SECRET` header (see below) |
| GET | `/health` | — | JSON liveness check; runs `SELECT 1` against D1, returns `{status: "ok"}`/200 or `{status: "error"}`/503. Polled by an external monitor (Home Assistant `rest` sensor). No auth. |
| GET | `/how-it-works` | `howItWorks` | Static info page |
| GET | `/how-to-contribute` | `howToContribute` | Static info page |
| GET | `/admin/thumbnails/pending` | — | Returns `{species_codes: [...]}` — species with no thumbnail or a stale (>30d) one. Auth via `THUMBNAIL_PUSH_SECRET` (see below). Consumed by `bird-sync/` (see [bird-sync](#bird-sync-thumbnail-home-helper)). |
| POST | `/admin/thumbnails` | — | Body `{updates: [{species_code, thumbnail_url}]}`, writes to the `species` table. Auth via `THUMBNAIL_PUSH_SECRET`. Strict input validation (see [bird-sync](#bird-sync-thumbnail-home-helper)): rejects malformed `species_code`/`thumbnail_url`, caps batch size at 200, fails the whole batch (400) on the first bad entry rather than partially applying it. |

**Admin poll auth**: The original restricts to `127.0.0.1`. In Workers there is
no localhost concept. Replace with a secret token check:
```
Authorization: Bearer <POLL_SECRET>
```
Store `POLL_SECRET` as a Worker secret (`wrangler secret put POLL_SECRET`).

`/admin/thumbnails*` use the same `Authorization: Bearer` pattern but a
**separate** secret, `THUMBNAIL_PUSH_SECRET` — deliberately not shared with
`POLL_SECRET`, since these routes write to D1 (bigger blast radius than
triggering a poll) and are called by an external service (`bird-sync/`)
rather than only from within this repo's own admin UI.

**Poll footer timestamps**: The original uses `astimezone()` to convert UTC to
America/New_York. In Workers use `Intl.DateTimeFormat` with
`timeZone: 'America/New_York'`.

## Poller

Port from `../vega-vireos/app/poller.py`.

**eBird API** — two requests per poll cycle:
1. `GET https://api.ebird.org/v2/data/obs/geo/recent` — recent observations
   - params: `lat=36.000538`, `lng=-78.900216`, `dist=2`, `back=3`,
     `includeProvisional=true`, `detail=full`, `fmt=json`
   - header: `x-ebirdapitoken: <EBIRD_API_KEY>`
2. `GET https://api.ebird.org/v2/data/obs/geo/recent/notable` — rare sightings
   - same lat/lng/dist/back params (used to set `notable` flag)

**Macaulay Library thumbnails** — for each new species seen:
1. `GET https://search.macaulaylibrary.org/api/v2/search?taxonCode=<code>&count=1&mediaType=photo&sort=rating_rank_desc`
   (v1 was retired; v2 returns a bare array, not `{results: {content: [...]}}`)
2. Extract `[0].assetId`, build URL:
   `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/<assetId>/320`

In the original, `ThreadPoolExecutor` fetches thumbnails concurrently. In
Workers use `Promise.all()` with `fetch()` — no threads needed.

Thumbnails older than 30 days are refreshed on each poll (check `fetched_at`
in the `species` table). A failed fetch does not count as "fetched" — no row
is written, so the species stays retry-eligible on the very next poll rather
than being locked out for the 30-day window.

**Rate limiting**: If eBird returns HTTP 429, log a warning and record a failed
poll status without throwing. Retry naturally on next cron tick.

## bird-sync (thumbnail home helper)

`bird-sync/` is a standalone Docker service, **not part of the Worker
build** — it runs on the home server (`brian`), not on Cloudflare.

**Why it exists**: `search.macaulaylibrary.org` (the Macaulay Library
thumbnail search API) sits behind [Anubis](https://github.com/TecharoHQ/anubis),
a real client-side proof-of-work bot-check — not just an IP-reputation
fluke, it blocks `fetch()` from Workers *and* from the home network.
`bird-sync` solves the PoW challenge itself (algorithm read directly from
Anubis's own MIT-licensed client JS — a documented, client-solvable
Hashcash-style puzzle any JS runtime is meant to pass, not a security
bypass) and pushes the resulting thumbnail URLs back to this Worker.

**How it talks to the Worker**: polls `GET /admin/thumbnails/pending` for
species needing a thumbnail, fetches each from Macaulay, `POST
/admin/thumbnails` with the results — both authenticated via
`THUMBNAIL_PUSH_SECRET` (see Environment/Secrets above). Configured with a
single `THUMBNAIL_WORKER_URL` (`http://localhost:8787` locally,
`https://birds.burns.sh` in prod) — both admin paths are derived from it in
`bird-sync/src/urls.ts`, so there's only one URL to keep in sync.

**Operating it** (`bird-sync/justfile`):
```bash
just build          # docker compose build
just start          # docker compose up -d (local: host networking, reaches wrangler dev)
just start-prod     # docker compose -f docker-compose.yml up -d (bridge networking, no local-host access)
just poll           # docker kill -s SIGUSR1 — forces an immediate poll cycle, no restart
just logs           # docker compose logs -f
just stop           # docker compose down
```
`docker-compose.override.yml` adds `network_mode: host`, auto-merged by
plain `docker compose`/`just` commands — needed locally to reach
`wrangler dev` on the same host (the default bridge network can't see the
host's `localhost`). It's excluded by `just start-prod`, since prod's
`THUMBNAIL_WORKER_URL` is a public HTTPS domain — bridge networking is
sufficient there and keeps the container's network exposure minimal on an
always-on home-server service.

**Cloudflare Access**: `/admin/*` is additionally gated by a Zero Trust
Access Service Token policy (dashboard-only config, not in this repo) —
chosen over IP-allowlisting since the home network's public IP is dynamic.
`bird-sync` sends `CF-Access-Client-Id`/`CF-Access-Client-Secret` headers
when `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` are set in its `.env`
(no-op locally, where Access doesn't front `localhost`).

**Cloudflare dashboard build-path filtering**: pushes to `main` normally
trigger a Cloudflare Workers Build. Since `bird-sync/` is deployed
separately (to `brian`, not Cloudflare), a push touching only
`bird-sync/**` should not trigger a Worker rebuild — configure this under
Workers & Pages → this Worker → Settings → Builds → **Build watch paths**
(dashboard-only, not expressible in a repo file).

## Templates

Port from `../vega-vireos/app/templates/`. Use Hono JSX — all template files
are `.tsx` exporting functional components. Enable in `tsconfig.json` with
`"jsx": "react-jsx"` and `"jsxImportSource": "hono/jsx"`. Routes render via
`renderToString(<Component ...props />)`.

JSX auto-escapes all `{expression}` values — no `escapeHtml` helper needed.
HTMX attributes (`hx-get`, `hx-target`, etc.) pass through as-is.

| Template | File | Exports |
|---|---|---|
| `base.html` | `src/templates/Base.tsx` | `<Base title={...}>children</Base>` |
| `index.html` | `src/templates/Index.tsx` | `<IndexPage weekGrid sightings pollStatus speciesCount />` |
| `week_strip.html` | `src/templates/WeekStrip.tsx` | `<WeekStrip weekGrid />` |
| `day_detail.html` | `src/templates/DayDetail.tsx` | `<DayDetail sightings date />` |
| `how_it_works.html` | `src/templates/HowItWorks.tsx` | `<HowItWorks />` |
| `how_to_contribute.html` | `src/templates/HowToContribute.tsx` | `<HowToContribute />` |
| *(new)* | `src/templates/SpeciesSummaryBar.tsx` | `<SpeciesSummaryBar weekGrid speciesCount />` |

The full CSS lives in `base.html` inline — copy it verbatim into `Base.tsx`.
Do not move it to a separate file; keeping it inline avoids an extra HTTP
request and matches the original's approach.

**HTMX behavior to preserve**:
- Week navigation: `hx-get="/week/<anchor>"` swaps `#week-strip-container innerHTML`
- Day clicks: `hx-get="/day/<date>"` swaps `#day-detail innerHTML`
- Loading indicator: `hx-indicator="#day-loading"`
- Selected-day highlight is cleared/set via inline `hx-on::before-request` JS
  on each `.week-day` cell (keep this exactly as-is)
- `selected_date` is only meaningful on the initial full-page render; the
  `/week/:anchor` fragment route does not need to pass it (no cell will be
  highlighted on week navigation, which matches the original Flask behavior)
- `SpeciesSummaryBar` lives inside `#week-strip-container` so it updates
  automatically on week navigation without any out-of-band swaps; it is
  unaffected by day clicks (which only swap `#day-detail`)

## Calendar Utility

Port `../vega-vireos/app/calendar_util.py` to `src/calendarUtil.ts`.
The logic is pure date arithmetic with no external dependencies — a
straightforward translation. The function signature:

```typescript
function buildWeekGrid(anchorDate: Date, sightedDates: Set<string>): WeekGrid
```

Returns the same shape as the Python version: `cells[]`, `prevAnchor`,
`nextAnchor`, `canGoNext`, `label`.

## wrangler.toml

Production lives at **https://birds.burns.sh** (custom domain bound to the Worker).

```toml
name = "vega-vireos"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[triggers]
crons = ["0 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "birds"
database_id = "cca2c12e-adde-4ae8-917a-b1466551c3e0"

[assets]
directory = "./public"

[[routes]]
pattern = "birds.burns.sh"
custom_domain = true

[observability]
[observability.logs]
enabled = true
invocation_logs = true
```

## Environment / Secrets

| Name | How to set | Notes |
|---|---|---|
| `EBIRD_API_KEY` | `wrangler secret put EBIRD_API_KEY` | Required |
| `POLL_SECRET` | `wrangler secret put POLL_SECRET` | For `/admin/poll` auth |
| `THUMBNAIL_PUSH_SECRET` | `wrangler secret put THUMBNAIL_PUSH_SECRET` (or `wrangler versions secret put ...` if the latest Worker version isn't currently deployed — see [bird-sync](#bird-sync-thumbnail-home-helper)) | For `/admin/thumbnails*` auth. Generate with `openssl rand -hex 32` — don't reuse `POLL_SECRET`'s value. |

For local dev, put them in `.dev.vars` (gitignored):
```
EBIRD_API_KEY=your_key_here
POLL_SECRET=anything
THUMBNAIL_PUSH_SECRET=anything
```

## Development Setup

```bash
npm install
wrangler d1 create birds                         # one-time, copy ID into wrangler.toml
wrangler d1 migrations apply birds --local       # create local DB schema
wrangler dev                                     # local dev server at localhost:8787
```

Run tests:
```bash
npm test                                         # vitest (Workers test environment)
```

Deploy to production:
```bash
wrangler d1 migrations apply birds --remote     # run against production D1 (manual step)
git push                                        # triggers Cloudflare auto-build and deploy
```

**Note:** `wrangler deploy` is no longer used — the repo is connected to Cloudflare's
CI/CD pipeline which deploys automatically on push to `main`. Migrations must still
be applied manually with `--remote` since the build pipeline does not run them.
The `npm run deploy` script (`wrangler deploy`) still exists in `package.json` but is
legacy — it is **not** the deploy path; ignore it in favor of push-to-`main`.

## Data Migration (from existing birds.db)

To seed production D1 with data from the running Docker deployment:

```bash
# On the host machine, export the SQLite database
sqlite3 ~/devel/vega-vireos/data/birds.db .dump > /tmp/birds_dump.sql

# Strip DDL — keep only INSERT lines (tables already exist from migrations)
grep "^INSERT" /tmp/birds_dump.sql \
  | sed 's/^INSERT INTO/INSERT OR REPLACE INTO/' \
  > /tmp/birds_import.sql

# Import into production D1
wrangler d1 execute birds --remote --file=/tmp/birds_import.sql

# For local D1 instead:
# wrangler d1 execute birds --local --file=/tmp/birds_import.sql
```

For local dev, use `--local` flag on the execute command.

## Conversion Roadmap

Work through these in order. Each step is independently testable with
`wrangler dev`.

- [x] 1. Scaffold project: `npm init`, install `hono`, configure `tsconfig.json` (set `"jsx": "react-jsx"`, `"jsxImportSource": "hono/jsx"`)
- [x] 2. Write `wrangler.toml` (D1 binding, cron trigger, assets dir)
- [x] 3. Create `migrations/0001_initial.sql` and apply locally
- [x] 4. Port `db.py` → `src/db.ts` (D1 query wrappers matching original function signatures)
- [x] 5. Port `calendar_util.py` → `src/calendarUtil.ts`
- [x] 6. Port `poller.py` → `src/poller.ts` (use `fetch()` + `Promise.all()`)
- [x] 7. Port templates → `src/templates/*.ts` (start with `base.ts`, then fragments)
- [x] 8. Port `routes.py` → `src/routes.ts` (Hono router, wire up all 6 routes)
- [x] 9. Write `src/index.ts` — export `fetch` handler (Hono app) and `scheduled` handler (cron)
- [x] 10. Copy static assets: `app/static/` → `public/` (htmx.min.js, favicon.svg, cardinal.svg)
- [x] 11. Set secrets (`EBIRD_API_KEY`, `POLL_SECRET`) and test locally with `.dev.vars`
- [x] 12. Write tests with vitest (Workers pool)
- [x] 13. Deploy to production and run data migration
- [x] 14. Point custom domain at the Worker in Cloudflare dashboard

## Deviations from Original Python App

These are intentional differences introduced during the port, including one
bug fix that was not backported to the original.

| Area | Deviation |
|---|---|
| `src/db.ts` `upsertSightings` | No longer takes a `pollDate` param. Creates `sighting_days` rows per unique `obs_date` in the records (not per poll date). The original only writes one row for today, so the week strip highlights the poll day rather than the days birds were actually seen — a bug. See `../vega-vireos/CLAUDE.md` for the Python fix. |
| `src/db.ts` `upsertSightings` | Chunks D1 batch into ≤100 statements to stay within D1's hard limit. Accepts `preserveExisting` option that switches to `INSERT OR IGNORE` (used when the notable endpoint fails, to avoid overwriting existing `notable` values with 0). |
| `src/db.ts` `getStaleThumbnails` | Adds `LIMIT 20` to cap concurrent Macaulay API calls per poll cycle. |
| `src/routes.tsx` | File is `.tsx` (not `.ts`) since it contains JSX. Validates `anchor` and `obsDate` URL params with `isValidDate()` — returns 400 for malformed input. Manual `/admin/poll` passes `{ verbose: true }` to `runPoll`; cron handler passes nothing (quiet mode). |
| `src/poller.ts` | `runPoll` accepts `opts.verbose` boolean. Verbose gates per-checklist detail logs and thumbnail counts. Always-on logs: poll start, sighting count, comment save count. Hard failures always use `console.error`. |
| `src/poller.ts` | After each poll, fetches top-level checklist comments from `GET /v2/product/checklist/view/{subId}` for any new `sub_id`s. Stores in `checklist_comments` table (keyed by `sub_id`, not by sighting upsert key) so multiple observers' notes for the same day are all preserved. |
| `src/calendarUtil.ts` `buildWeekGrid` | Accepts `anchor: string` (ISO date) instead of `anchorDate: Date` to avoid timezone-on-construction issues. |
| `src/poller.ts` | Both eBird fetches (recent + notable) run in parallel via `Promise.all`. Original makes them sequentially. Notable endpoint failure sets `notableKeys=null` (skips overwriting notable) rather than falling back to an empty set. |
| Asset paths | `/htmx.min.js`, `/cardinal.svg`, `/favicon.svg` — no `/static/` prefix (Workers Assets serves `public/` at root). |
| Admin auth | Original restricts `/admin/poll` to `127.0.0.1`. Workers has no localhost concept; replaced with `Authorization: Bearer <POLL_SECRET>`. |
| `src/templates/WeekStrip.tsx` | Past days with no sightings are clickable (show "No birds were spotted on this date."). Original only made days with data clickable. Days remain visually inactive; only future days are non-clickable. |
| `src/calendarUtil.ts` `EARLIEST_DATE` | Back-navigation is disabled when navigating before `2026-04-03` (project start date; no data exists before this). Computed via `canGoPrev` in `WeekGrid`. |
| Thumbnail fetching | The Worker's own in-process `fetchThumbnail()` in `src/poller.ts` still runs on every poll, but is best-effort only — Macaulay's search API blocks Workers via an Anubis bot-check (see [bird-sync](#bird-sync-thumbnail-home-helper)). Real thumbnail coverage comes from `bird-sync/`, a separate home-server service with no Python/original-app counterpart. |

## Testing

```bash
npm test   # vitest with @cloudflare/vitest-pool-workers
```

Tests run inside the Workers runtime (Miniflare). `test/setup.ts` applies the
D1 schema via `beforeAll` before each test file. Three test files:
- `test/calendarUtil.test.ts` — pure date arithmetic (11 tests)
- `test/db.test.ts` — D1 query wrappers (17 tests)
- `test/routes.test.ts` — HTTP integration via `SELF` (15 tests)

**vitest config note**: config lives in `vitest.config.mts` (`.mts`, not `.ts`).
It uses `cloudflareTest` as a Vite plugin (not `cloudflarePool` directly).
`cloudflareTest` registers the `resolveId`/`load` hooks that make `cloudflare:test`
available as a virtual module.

## Reference Files (original Python app)

All source files live at `../vega-vireos/app/`:

| File | Purpose |
|---|---|
| `main.py` | App factory + APScheduler setup (maps to `src/index.ts` scheduled handler) |
| `routes.py` | Flask routes → port to Hono handlers in `src/routes.ts` |
| `poller.py` | eBird + Macaulay API client → port to `src/poller.ts` |
| `db.py` | SQLite queries → port to D1 queries in `src/db.ts` |
| `calendar_util.py` | Week grid builder → port to `src/calendarUtil.ts` |
| `templates/` | Jinja2 templates → port to Hono JSX components in `src/templates/*.tsx` |
| `static/` | Copy to `public/` as-is |

Worker-only source with no Python counterpart: `src/types.ts` — shared TypeScript
interfaces (`Env`, `Sighting`, `PollStatus`, `ChecklistComment`, `WeekCell`, `WeekGrid`).

## Returning to this project

After any gap, run `npm outdated` before `npm install`. If wrangler or the
rest of the toolchain is behind, update it first (`npm update`, then any
majors you want one at a time), run the tests, and commit the lockfile as its
own chore commit before starting feature work. Transitive dev dependencies
such as miniflare, workerd and sharp only move when wrangler does, so a stale
wrangler is the usual cause of a surprising install failure.
