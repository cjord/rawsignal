# Codebase review — 2026-09-03

Evidence document for the September refactor program (`docs/refactor-plan-2026-09.md`,
branch `refactor/review-2026-09`). Every number here came from a mechanical pass on the
branch at 21a8c1e; dispositions reference the plan's waves. The August audit
(`docs/codebase-audit-2026-08-28.md`) remains the record for the layering decisions this
review builds on.

## 1. Baseline

`npm run check` on `main` (2026-09-03): production build OK, **202 node tests (201 pass,
1 skipped by design — the collectr worker contract), lint clean, 4/4 Playwright**.
`tsc --noEmit` was **not** part of the gate and reported 4 errors (§7). `madge`: 150
modules, **no circular dependencies**. `jscpd`: 11 TypeScript clones (1.2 % of lines),
9 CSS clones. `npm audit`: 21 advisories (16 high), all in dev/transitive packages (§8).

## 2. Build commands and deployments

| Command | What it does | Notes |
|---|---|---|
| `npm run dev` | `vinext dev` on :3000 (`.claude/launch.json` → `rawsignal-dev`) | Cloudflare vite plugin binds a placeholder D1 (`vite.config.ts`); `npm run db:local:max` swaps in the 2.17 GB max-profile database |
| `npm run build` | `vinext build` → `dist/client` + `dist/server` (Worker) | **Wipes `dist/`**, including any generated `wrangler.<env>.json` — regenerate after every gate before deploying |
| `npm test` | build + `node --test tests/*.test.mjs` | 45 suites; several are source-contract pins (`source-contracts`, `css-architecture`, `maintainer-docs`, `cloudflare-cutover`, `scalper-mode`) that fail on moves until updated deliberately |
| `npm run lint` | ESLint flat config: JS recommended, TS recommended, React + hooks, jsx-a11y, Next core-web-vitals | No `complexity`/`max-depth` rules; this review ran them ad hoc (§5) |
| `npm run typecheck` | `tsc --noEmit` — **new in wave 1** | Was never run by the gate; 4 latent errors had accumulated |
| `npm run check` | test → lint → typecheck → Playwright (4 journeys on :4173 against a fresh dev server) | The release gate; dev server on :3000 must be stopped; CI (`.github/workflows/quality.yml`) runs the same on Node 24 for pushes to `main` and PRs |
| `npm run data:*` | feed regeneration (`sync-tcgcsv.mjs`, `sync-sealed*.mjs`, scalper, details, graded, set logos) | External network; last-good protected |
| `npm run db:*` | `drizzle-kit generate`, local max-profile database build/swap | |
| `npm run backtest:*`, `shadow:scoreboard` | walk-forward harness and champion/challenger scoreboard against local sqlite | research tooling, no production coupling |
| `npm run cloudflare:prepare:*`, `cloudflare:parity` | writes `dist/server/wrangler.<env>.json` from `dist/server/wrangler.json` + `cloudflare/environments.json`; catalog parity check | production requires `--route rawsignal.cards --cron "*/1 * * * *"` and the D1 UUID via env |

Deployment: `prepare-deployment.mjs` clones the vinext-emitted base config and sets
name, `workers_dev` (staging only), D1 binding + `migrations_dir`, assets with
`run_worker_first: ["/data/*"]` (live feeds), Images, version metadata, `ENVIRONMENT`,
the cron trigger (explicit only), observability, the `COLLECTR_FETCH` service binding,
and the custom-domain route. Migrations are applied separately (`wrangler d1 migrations
apply`, deploy first then migrate). Observations:

- `next.config.ts` is an empty Next scaffold; vinext does not need it (knip flags it).
  Left in place — harmless, but it is the last Next-template artifact besides `legacy/`.
- `tsconfig.json` includes `.next/types/**` and `next-env.d.ts` (Next-era globs) — inert.
- `playwright.config.ts` reuses an existing :4173 server locally and starts its own
  otherwise; `fullyParallel:false`, one worker — deliberate (state-dependent journeys).
- Deploy config generation is unit-tested (`tests/cloudflare-cutover.test.mjs`).

## 3. Architecture walk and data flows

The layering recorded in `docs/helicopter-view.md` holds up under the dependency scan:
`core/` (pure TS) is imported by `app/`, `db/`+`worker/`, and the node scripts, and
imports nothing outward. Two edges deviated from the documented rule:

1. `worker/staging-jobs.ts → app/data/tcgplayer-history-client.ts` — the last backend→app
   edge (the August audit's known residual). **Fixed in wave 1**: the client now lives at
   `core/clients/tcgplayer-history.ts` (with `mergeHistoryBuckets`, formerly
   `app/history-utils.ts`, folded in).
2. `app/data/load-detail.ts → db/*` — the RSC detail loader reads D1 directly. This is
   server-only code that happens to live under `app/`; it is the same shape as the API
   routes and is an accepted exception, now documented here rather than "fixed".

Request flows verified in code (each with its readiness fallback):

- **Leaderboards** (`/`): the client loads `/data/<section>.json` / `/data/sealed-<market>.json`;
  `run_worker_first` routes those through `worker/live-feeds.ts`, which serves D1 rows
  when the catalog run is published and otherwise falls through to the bundled asset.
  The browser then runs `core/catalog-query.ts` (search/sort/facets) locally. Payloads are
  large (§9): the biggest sections are 1–2 MB uncompressed.
- **Detail pages** (`/cards/[id]`, `/sealed/[id]`): RSC → `app/data/load-detail.ts` →
  `db/catalog-repository.getDetail` (D1) with the feed repository as fallback; the client
  then fetches `/api/history` (TCGplayer, 15-minute in-isolate cache) for chart/signals.
- **Sets** (`/sets`, `/sets/[game]/[slug]`): RSC → `db/sets-service.ts` (D1 only; `null`
  when unpublished → 404).
- **Metrics** (`/metrics`): `/api/metrics` → `db/metrics-service.ts` rollup tables.
- **Import** (`/import`): `/api/collectr` GET (showcase page → API pages → optional
  browser-rendering worker via service binding) and POST (CSV), three-tier matching
  against D1 with a top-50-per-market feed fallback in dev.
- **Ingestion**: the `*/1` guard cron → `worker/scheduled-ingestion.ts` →
  `worker/scheduled-decision.ts` (pure, tested) picks one due action (live walk,
  details, graded, metrics rollup, tiered history) and runs one checkpointed batch.

Document drift found on the walk (fixed in wave 7 unless noted): `docs/helicopter-view.md`
still called the leaderboard feeds "bundled" in one place; AGENTS.md's repository map
listed `app/history-utils.ts` and `app/data/tcgplayer-history-client.ts` (moved —
AGENTS.md change proposed to the user, not applied).

## 4. Dependency map

150 modules under `app/`, `core/`, `db/`, `worker/`. Highest fan-in: `core/domain/types.ts`
(48), `db/repository.ts` (28), `core/domain/formatters.ts` (13), `app/state/favorites.ts`
(10), `core/domain/regime.ts` (10). Highest fan-out: `app/page.tsx` (44),
`app/SealedView.tsx` (36), `app/CollectrImportView.tsx` (22), `app/MetricsView.tsx` (22),
`app/ProductDetailPage.tsx` (18).

**Dead code (removed in wave 1):** `db/index.ts` (a Drizzle `getDb()` no module
imported — the whole codebase uses raw `D1.prepare`; `drizzle-orm` now serves only the
schema definitions and `drizzle-kit`), `distanceAbove`/`distanceBelow`/`rangeWidth`
(`core/domain/detail-metrics.ts`), `metadataText`/`normalizeExtendedData`/
`detailPriceVariants` and their helpers (`core/domain/detail.ts` — the D1 detail path
has its own normalizers), `DERIVED_RULES` (`core/msrp/derived-msrp.ts`).

**Exported but internal-only (un-exported in wave 1):** `loadCatalogSources`,
`HOVER_OPEN_DELAY_MS`, `sealedProductType`, `isGradedRecord`, `parsePricePoint`,
`editDistance`, `pokemonSection`, `riftboundSection`.

**Exported tunables left exported on purpose** (documented sweep/scripting surfaces):
`REGIME_THRESHOLDS`, `RELEASE_SETTLE`, `OWN_WEIGHT_FULL_DAYS`, `PRESALE_WEIGHT_CAP`,
`LIQUIDITY_FLOOR`, `SALES_CONFIDENCE_BUMP`, `COHORT_RETENTION_DAYS`, `RIFTBOUND_GROUPS`,
`ONEPIECE_GROUPS`.

knip's "91 unused files" was noise (it cannot see vinext route entry points); every
listed `app/` file is reachable from a route. Its two dependency notes: `tailwindcss` is
only pulled through `@tailwindcss/postcss` (declared explicitly — harmless);
`@cloudflare/puppeteer` belongs to `workers/collectr-fetch`'s own package.

## 5. Complexity and nesting

ESLint `complexity` (threshold 12), `max-depth` (3), `max-lines-per-function` (120):
**67 functions over the complexity threshold, 9 blocks nested ≥4 deep, 5 functions over
120 lines.** The ones that matter, with disposition:

| Complexity | Function | Disposition |
|---|---|---|
| 86 | `core/signal-utils.ts` `evaluateMarketSignal` | Wave 4: extract `liquidityGate`, `candidateExtremes`, `scoreV1`/`scoreV2`, `turnGates` as named pure helpers behind a characterization suite that pins current outputs on fixture series for every side × strictness × model. The harness (`docs/backtests.md`) is the second net. Behavior byte-identical. |
| 73 | `app/ProductDetailPage.tsx` `ProductDetailPage` | Wave 4: the file already has 12 sub-components; the page body still inlines the hero (favorites, links, primary price, overview grid), the history section, and the hero-art tilt engine. Extract `useArtTilt`, `DetailHero`, `PriceHistorySection`. |
| 61 / 762 lines | `app/SealedView.tsx` `SealedView` | Wave 4 (bounded): lift the filter-chip builder and the scenario controls into hooks shared with `Home`; the twin-orchestrator shape is a known decision (mode adapter), not a rewrite target. |
| 47 / 228 lines | `app/CollectrImportView.tsx` | Extract the table row/sort model into `app/state/collectr-view.ts` (pure, testable). |
| 46 / 837 lines | `app/page.tsx` `Home` | Same treatment as `SealedView`. |
| 45 | `app/PriceChart.tsx` `PriceChart` | Extract scale/tick computation into a pure helper (also memoizable — §9). |
| 44 | `core/domain/regime.ts` `classifyRegime` | Wave 4: split into `spikeReading`, `nearHighReading`, `trendReading` behind `tests/regime.test.mjs` extensions. |
| 41 | `worker/scheduled-ingestion.ts` `runScheduledIngestionTick` | Keep — it is a dispatch table over the tested `decideScheduledAction`; the number is branch count, not logic. |
| 40 | `core/catalog-query.ts` singles filter arrow | Keep; pinned by ~650-combination parity tests. |
| 38 | `core/catalog-repository.ts` `getDetail` | Candidate later; heavily exercised by detail tests. |
| 33 | `db/daily-ingestion.ts` `persistDerivedHistory` | Wave 5 touches it for batching; split signal writes into `writeSignals` then. |
| 32 | `db/early-value.ts` `readEarlyValue` | Keep (new, P7 — has `early-value.test.mjs`). |
| 30 | `core/collectr.ts` `normalizeCollectrCsv` | Keep (fixture-tested). |

Nesting ≥4: `app/data/load-detail.ts:56`, `core/collectr.ts:200`, `db/graded-ingestion.ts:45–46`,
`db/history-backfill.ts:65,68`, `db/live-ingestion.ts:184–190` (depth 5 at 187). The
live-ingestion cluster is the one worth flattening (early `continue`s) — wave 4 if cheap.

## 6. Duplication

TypeScript clones (jscpd, ≥60 tokens):

| Clone | Disposition |
|---|---|
| `page.tsx` 53–82 ≡ `SealedView.tsx` 39–68 (the shared leaderboard import block) | Import lists — not code; no action |
| `page.tsx` 693–705 ≡ `SealedView.tsx` 464–476 (set/regime filter-chip builders) | Wave 3: `chipsForSelections()` in `app/leaderboard/ActiveFilterSummary.tsx` |
| `core/normalize/sealed.ts` — four normalizers repeat the 15-line product-shape + profit math | Wave 3: `sealedRecord(game, product, group, price, msrp, msrpSource, category)`; each normalizer keeps only its MSRP precedence |
| `db/catalog-repository.ts` `readCardsByIds`/`readSealedByIds`/`readCardsByNames`/`readSealedByNames` (chunked `IN` loops) | Wave 3: one `readChunked(db, whereColumn, kind, values, mapRow)` |
| `db/schema.ts` signal-column groups (`market_signals` ≡ `shadow_signals`; `signal_history` ≡ `shadow_signal_history`) | Leave: Drizzle table definitions are what migrations diff against; a column factory would obscure the migration history |
| `ProductDetailPage` `DetailSignalBadge` ≡ `SignalControls` `SignalBadge` | Wave 3: reuse `SignalBadge` |
| `sealed-product-utils.ts` 68–83 ≡ 119–123 | Inspect in wave 3 (classification tables) |

CSS: `app/styles/fonts.css` repeats `@font-face` blocks (inherent to self-hosted fonts —
no action); `market-controls.css` 87–93 ≡ 353–359 (the same selector list restating
`padding-right: 0` inside a media query — wave 3 drops the redundant block after checking
the cascade). `!important` density: `market-views.css` 47, `market-content.css` 44,
`globals.css` 27, `market-controls.css` 23, `collectr.css` 13 (the August census counted
301 across the tree; the import-order dependence is documented and pinned).

## 7. Type errors (fixed in wave 1)

| File | Error | Fix |
|---|---|---|
| `app/CollectrImportView.tsx:44` | `cardGame` returned `card.game` (`"onepiece"` possible) as `ImportMarket` | return type widened to `ImportMarket \| "onepiece" \| null` — runtime unchanged (One Piece rows never equal a market tab, by design) |
| `app/data/catalog-service.ts:82` | union page passed to a generic `apiPage<T>` | branch per kind |
| `app/leaderboard/detail-prefetch.ts:14` | `"requestIdleCallback" in window` narrowed `window` to `never` | `typeof window.requestIdleCallback === "function"` |
| `db/metrics-ingestion.ts:98` | implicit `any` parameter | annotated |

## 8. Security, logic, and antipattern findings

**Verified sound:** every D1 statement is parameterized (`?` binds); the only dynamic SQL
fragments are internal literals (column names in `momentumWindow`/`rungKey`/`seriesSql`,
`IN` placeholder lists). The staging ops token uses a SHA-256 constant-time compare.
The one `dangerouslySetInnerHTML` is the static theme-bootstrap script in `layout.tsx`.
Outbound fetches are to fixed hosts; the Collectr handle is validated/encoded.

**Findings:**

1. `/api/collectr` GET is unauthenticated and, when the showcase page loads, walks the
   Collectr API in 30-item pages up to `MAX_PRODUCTS` (6000 → up to 200 sequential
   upstream fetches per request). Amplification/abuse vector and a slow request path.
   → Wave 6: cap the page walk (the browser-worker `mode=full` path exists for large
   showcases and is rate-limited by a Durable Object). **Function change**, logged.
2. `/api/collectr` POST checks the 8 MB CSV limit after `request.json()` has parsed the
   whole body. → Wave 6: reject on `Content-Length` first. Function change (earlier 413).
3. `workers/collectr-fetch` compares the bearer with `!==` (not constant-time). It sits
   behind a service binding, so exposure is minimal; fix is trivial → wave 6.
4. Subtle: in `GET`, `partial` is `false` whenever `source === "api"`, but `fetchApiPages`
   returns the partial `collected` array when a later page fails (`!response.ok` at
   `offset > 0`). A truncated API walk is reported as complete. → wave 6 candidate
   (function change: `partial: true` in that case); listed for the user's decision.
5. `matchCards`' feed fallback only sees the top 50 per market — documented dev-only path,
   but the comment should say so at the call site (wave 7).
6. `npm audit`: 21 advisories, all dev/transitive (`ws` via `@cloudflare/vite-plugin`,
   `vite 8.0.x`, `esbuild`, `undici`, `sharp`, `postcss`, `nanoid`, `js-yaml`, …).
   `react-server-dom-webpack` (pinned 19.2.6) is inside a flagged range and *is* part of
   the built Worker. Seven fixes are non-breaking (`npm audit fix`); the rest need a
   `@cloudflare/vite-plugin` major/minor bump outside the declared range. → A separate
   dependency-upgrade change after this program (not behavior-preserving to bundle here).

**Performance antipatterns:**

7. `db/daily-ingestion.ts` `persistRecord`: ~15 sequential D1 round trips per record
   (card/sealed upsert, observation upsert, history read, liquidity read, cohort read,
   metrics upsert, 6 signal upsert/deletes, 2 shadow writes). At 80 records per tick that
   is ~1,200 awaited statements. → Wave 5: keep the reads, batch the writes with
   `D1.batch()` (atomic per record, same rows) — behavior-preserving.
8. `db/sets-service.ts` `loadSetDetail`: eight queries awaited strictly in sequence
   (including two identical-shape momentum queries). → Wave 5: `Promise.all`.
9. `db/catalog-repository.ts` `readGameSetProducts` and the set-detail observation
   aggregation filter `catalog_products` by `game, set_name`; the only index leads with
   `kind`, so the planner full-scans (§9 numbers). → Wave 5: migration 0013 adding
   `idx_catalog_game_set (game, set_name)`; verified with `EXPLAIN` locally.
10. `app/api/collectr/route.ts` `matchCards` feed fallback runs two 50-row catalog queries
    per request in dev — fine.

## 9. Performance measurements (local max-profile D1: 17,462 products, 13.5 M observations)

| Query | Plan | Time |
|---|---|---|
| set detail: observations aggregation by `game, set_name` | `SCAN o` (all 13.5 M rows) → `SEARCH p` | **1,133 ms** |
| set detail: `readGameSetProducts` | `SCAN p` (no usable index) | 6 ms (small table) |
| sets directory: singles group-by | index on `kind` | 332 ms |
| sets directory: releases group-by | `SCAN product_details` | 483 ms |
| sets directory: momentum window | `SCAN market_metrics` + temp b-trees | 150 ms |
| sets directory: signals group-by | covering indexes | 51 ms |
| history frontier per product (M1 delta) | covering PK | 3 ms |
| observations by date (metrics rollup shape) | index scan | 608 ms (cron-only; a date index would cost ~300 MB — not proposed) |

Frontend: the largest client payloads are the section feeds (`vintage.json` 2.1 MB,
`promos.json` 1.5 MB, `sealed-pokemon.json` 1.2 MB, `ultra-rares.json` 1.1 MB uncompressed;
served through the Worker with `CACHE_TIERS` and edge compression). `Home` (837 lines)
and `SealedView` (762) recompute derived lists on every render; `PriceChart` recomputes
scales per render. Wave 5 adds `useMemo` around the query engine call and the chip
builders, and memoizes `PriceChart`'s scale math — no visual change.

## 10. Tests

Baseline 45 suites / 202 tests. Modules never referenced by any test (35): the
`app/leaderboard/*` components (13 — exercised by the Playwright journeys and the
rendered contracts), `app/state/*` hooks (10), `core/clients/http-json.ts`,
`core/market-state.ts`, `core/domain/sets.ts`, `core/domain/types.ts` (types only),
`core/msrp/verified-msrp.ts` (data), `db/ingestion-batch.ts`, `worker/scheduled-ingestion.ts`
(its decision function is tested), `app/api/cache.ts`, `app/data/load-detail.ts`,
`app/data/set-logos.ts`, `app/data/useCatalogPage.ts`, `app/data/useFreshness.ts`.

Wave 2 adds characterization tests for the pure, load-bearing ones:
`http-json` (retry count, linear backoff, throttle, query-string scrubbing in errors),
`ingestion-batch` (`clampBatchSize`, `parseStatsJson`, `resumeCheckpoint` run-id gating),
`market-state` (defaults/allowed rarities invariants), `api/cache` (tier strings
well-formed and ordered), `market-memory` and `usePreference.parseStrictness` (storage
guards), `set-logos` lookup tiers, and the wave-3/4 extractions each ship with theirs.

## 11. Gaps and areas of improvement (not all in scope for this program)

- **Gate coverage**: no type checking until wave 1; no complexity budget — consider
  adding `complexity: [warn, 25]` to the ESLint config so new hotspots surface in
  reviews without failing the gate.
- **Feed payload size**: the client-side engine over full section feeds is a design
  decision, but the 1–2 MB sections argue for per-section field trimming (drop fields
  the leaderboard never renders) or a paginated `/api/catalog` path for the largest
  sections — a product decision, not a refactor.
- **Ingestion throughput**: batching (§8.7) is the single biggest server-side latency win.
- **Set pages**: index + query reorder (§8.9) turns a ~1.1 s query into an index seek.
- **Dependency hygiene**: audit findings (§8.6); `next.config.ts`/`.next` globs are inert
  Next-era leftovers.
- **Duplicated orchestrators**: `Home`/`SealedView` remain the two largest functions in
  the codebase; the mode adapter narrowed the gap, and wave 4 lifts the shared pieces
  incrementally rather than merging them.
- **UI test depth**: leaderboard components rely on 4 Playwright journeys; a component-
  level smoke (render each view mode with fixture rows) would catch regressions the
  journeys skip.

## 12. Function-change log

Maintained in `docs/refactor-plan-2026-09.md` (the plan of record). Everything else in
this program is intended to be behavior-preserving and is verified by the full gate.
