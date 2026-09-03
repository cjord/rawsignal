# Code review + refactor program — September 2026 (plan of record)

Branch: `refactor/review-2026-09` (off `main` at 21a8c1e). Started 2026-09-03. Companion
evidence document: `docs/codebase-review-2026-09-03.md` (findings, metrics, dependency
map, gaps). The August program (`docs/codebase-audit-2026-08-28.md`,
`docs/refactor-decisions-pending.md`) established the `core/` layering; this round
audits what landed since (detail pages, sets, Collectr import, ingestion scaling, the
signal-model program P1–P7) and hardens it.

## Goals (from the user, 2026-09-03)

1. Analyze build commands and deployments.
2. Walk the architecture (update documents when needed) to understand project and data flows.
3. Prefer incremental changes over large rewrites.
4. Ensure code, modules, and CSS are not unnecessarily duplicated.
5. Ensure tests pass; create tests for methods that lack them.
6. Point out gaps and areas of improvement.
7. Find performance improvements — database and frontend.
8. Preserve original function; identify and document any place function may change.
9. Search for security issues, subtle logic errors, performance antipatterns.
10. Map dependencies: cyclomatic complexity / deep nesting, exact functions or modules to
    extract or split, orphaned imports and dead code.

## Method

- **Baseline first.** `npm run check` on the branch before any change (green: 202 node
  tests, lint clean, 4/4 Playwright — 2026-09-03). Every wave ends with the same gate; a
  wave that cannot go green is reverted, not forced.
- **Evidence over opinion.** Mechanical passes drive the findings: `tsc --noEmit`, ESLint
  `complexity` / `max-depth` / `max-lines-per-function`, madge (cycles, fan-in/out,
  layering), jscpd (TS + CSS clones), knip cross-checked with a repo-wide symbol search
  (its "unused files" list is noise — it does not know vinext route entry points), `npm
  audit`, targeted pattern searches (SQL construction, token comparison, HTML injection,
  sequential awaits), and `EXPLAIN QUERY PLAN` against the local max-profile D1.
- **Incremental waves, one commit each**, smallest-risk first. Structural moves keep
  behavior byte-identical; anything that changes observable behavior is listed in the
  **Function-change log** at the bottom of this file before it lands.
- **Tests before extraction.** A function is only split after a characterization test pins
  its current outputs (or an existing suite already does).
- **Local verification.** Browser-observable changes are checked on the local dev server
  (`npm run dev`, port 3000) in addition to the gate; the Playwright suite runs on 4173.
- **No deploys, no pushes** from this program; release is the user's call after review.

## Waves

| # | Wave | Scope | Risk |
|---|------|-------|------|
| 0 | Baseline + analysis | Branch, gate, mechanical passes, review document, this plan | none |
| 1 | Hygiene | Fix the 4 `tsc` errors; delete `db/index.ts` (dead); drop the `export` from symbols used only inside their module; move `app/data/tcgplayer-history-client.ts` to `core/clients/` (last backend→app edge); add `tsc --noEmit` to the gate so type errors cannot return | low |
| 2 | Tests for untested modules | Characterization tests for `core/clients/http-json.ts` (retry/backoff), `worker/scheduled-ingestion.ts` tick decisions, `db/ingestion-batch.ts`, `core/market-state.ts`, `core/domain/sets.ts`, `app/api/cache.ts`, the pure parts of `app/state/*` stores | low |
| 3 | Duplication | Shared helpers for the jscpd clones: `page.tsx`/`SealedView.tsx` twin blocks, `core/normalize/sealed.ts` repeated normalizer skeleton, `db/catalog-repository.ts` chunked-`IN` readers, `db/schema.ts` repeated signal-column groups; CSS: `fonts.css` `@font-face` blocks, `market-controls.css` twin block | low–medium |
| 4 | Complexity extraction | Split `ProductDetailPage` into panel components; extract the tick decision from `runScheduledIngestionTick`; break `classifyRegime` and `evaluateMarketSignal` into named gate helpers behind characterization tests; extract `loadMetricsPayload` sections; reduce the `Home`/`SealedView` bodies via the existing mode-adapter seam | medium |
| 5 | Performance | DB: verify index candidates with `EXPLAIN QUERY PLAN` (catalog_products by `game,set_name`; observations by date), batch per-record writes in daily ingestion via `D1.batch`, consolidate the per-set query fan-out in `db/sets-service.ts`; frontend: memoize derived lists in `Home`/`SealedView`, cheap wins in `PriceChart`, confirm feed responses are cache-tiered and compressed | medium |
| 6 | Security hardening | Cap upstream page fetches per `/api/collectr` request and check `Content-Length` before parsing CSV bodies; constant-time token compare in `workers/collectr-fetch`; evaluate `npm audit` (transitive `ws` via `@cloudflare/vite-plugin`) | low |
| 7 | Documentation | Update `docs/helicopter-view.md`, `docs/architecture.md`, `docs/data-ingestion.md` where the walk found drift; finalize the review document; record the function-change log | none |
| 8 | Guard-cron tick (post-review follow-up) | The wave 2/4 items the program had skipped: move the history resume-key policy from `runScheduledIngestionTick` into `worker/scheduled-decision.ts` as `planScheduledAction` (a typed plan per action, no `!` assertions); one `db/run-id.ts` helper for the `prefix:date` run-id format (tick, decision, backfill); inject clock, probe, and job runners; name the four batch sizes; `tests/scheduled-ingestion.test.mjs` pins the dispatch | low |
| 9 | Cheap leftovers (post-review follow-up) | `persistDerivedHistory` → `signalStatements` + `shadowSignalStatements` with the first direct suite (`tests/derived-history.test.mjs`, migrated in-memory D1); ESLint `complexity: ["warn", 25]`; retire `drizzle-kit` (`db:generate` script, `drizzle.config.ts`, devDependency) and document hand-written migrations in the README. The `core/domain/sets.ts` test item was moot — the module is types only | low |
| 10 | Collectr import view (post-review follow-up) | The wave 4 item the program had skipped: `app/state/collectr-view.ts` holds the pure table model (value ordering, filter, sort with null-sinking, set options, portfolio totals, page window) with `tests/collectr-view.test.mjs`; the row renderer is an `ImportRow` component. Behavior-identical. Also: `formatFullDate` in UTC (set-page hydration fix, shipped as version 0fbd5b4c) and the review's "Next-era leftovers" item withdrawn — vinext parses `next.config.*` and writes `.next/types` | low |
| 11 | Home/SealedView bounded lift (post-review follow-up) | The last identical block in the two orchestrators — the per-item `signalFor` resolver (persisted signal when ready, else a live evaluation at the item's price) — is `signalResolver()` in `app/leaderboard/mode-adapter.ts`, tested with the bounce fixture. Everything else the plan named (`derived`, `catalogResult`, `eligible`, sorts, chips, set groups, favorites scope) was already shared or memoized through the mode-adapter seam; the remaining size of both files is state orchestration pinned by the state suites, left by decision | low |

Each wave: implement → narrowest tests → `npm run check` → commit on the branch with the
wave number in the message. Waves 1–2 are prerequisites for 3–5 (type safety and
characterization tests are the safety net for the structural moves).

## Function-change log

Anything below changes observable behavior or tooling and is deliberate. Everything not
listed here is intended to be behavior-preserving.

| Wave | Change | Why | Observable effect |
|------|--------|-----|-------------------|
| 1 | `npm run check` gains `tsc --noEmit` | the gate never ran the type checker; 4 latent errors accumulated | a type error now fails the gate (CI included) |
| 2 | `clampBatchSize` treats a non-finite request as "not requested" | `Math.max(1, Math.min(max, NaN))` is `NaN`, so a malformed `batchSize` produced `NaN` slice bounds (an empty batch that still checkpointed) | a NaN/Infinity batch size now uses the runner's default; finite values unchanged |
| 5 | Migration `0013` adds `idx_catalog_game_set (game, set_name)` | set pages and the sets directory filter by game+set without a kind; the planner full-scanned (`readGameSetProducts` 6.8 → 0.1 ms; the set-detail observation aggregation 3.9 → 2.7 s locally) | no output change; **operational**: apply to both D1s at the next deploy (deploy first, then migrate, per `docs/cloudflare-cutover.md`) |
| 5 | Ingestion writes per product are batched (`D1.batch`) | ~15 sequential awaits per record → 2 batches + 3 reads; ~80 records per cron tick | same rows; the metrics + signal + shadow writes for one product are now atomic — a mid-pass failure rolls the product's pass back instead of leaving partial rows |
| 5 | `loadSetDetail` runs its seven reads concurrently | they depend only on game+set; the observation aggregation dominated wall time | identical payload (golden-diffed); lower page latency |
| 6 | `/api/collectr` GET caps the direct API walk at 20 pages (600 products) | an unauthenticated request could trigger up to 201 upstream fetches (6000/30 pages) | showcases beyond 600 products import in full through the rate-limited browser worker (`mode=full`) as designed; the direct path returns the first 600 flagged `partial: true` |
| 6 | `/api/collectr` GET reports a truncated direct-API walk as `partial: true` | `partial` was hard-coded `false` for `source: "api"`, so a walk cut short by a failed page claimed completeness | the UI's honest "partial import" banner now also appears for a truncated or capped API walk |
| 6 | `/api/collectr` POST rejects oversized bodies before parsing | the 8 MB CSV limit was checked after the whole body was parsed | oversized uploads get the 413 sooner; no change for valid uploads |
| 6 | `workers/collectr-fetch` compares its bearer in constant time | plain `!==` string compare | none observable; the worker is redeployed separately (`workers/collectr-fetch`) |
| 8 | `planScheduledAction` throws if policy ever chose `live` without a probe timestamp | replaces the `probeUpdatedAt!` assertion, which would have passed `null` into the live job's run id | unreachable with the current policy (the decision only returns `live` on a non-null probe, pinned by tests); if a future policy edit breaks that, the tick fails loudly as `scheduled_tick_failed` instead of writing a malformed run. Everything else in wave 8 is behavior-identical: same reads, same probe rule, same batch sizes, same job arguments |
| 9 | `npm run db:generate` removed; `drizzle-kit` uninstalled | the generator's journal stopped at 0004, so it produced wrong cumulative diffs (§8.11) | **tooling**: new migrations are hand-written `drizzle/00NN_name.sql` (README "Database changes"); `db/schema.ts` still documents the shape for `drizzle-orm` types. No runtime change |
| 9 | ESLint `complexity: ["warn", 25]` | no budget existed; the review's §11 suggestion | **tooling**: `npm run lint` now prints ~20 warnings for the known orchestrators; exit code unchanged (warnings never fail the gate) |

(The table is appended as waves land; entries are provisional until their wave ships.)
