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
| 6 | `/api/collectr` GET caps the API pagination walk | an unauthenticated request could trigger up to 201 upstream fetches (6000/30 pages) | very large showcases import via the browser worker path (`mode=full`) as designed; the page path stays partial-and-honest |
| 6 | `/api/collectr` POST rejects oversized bodies before parsing | the 8 MB CSV limit was checked after the whole body was parsed | oversized uploads get the 413 sooner; no change for valid uploads |

(The table is appended as waves land; entries are provisional until their wave ships.)
