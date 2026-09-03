# Raw Signal architecture

## Product boundary

Raw Signal presents market intelligence for raw trading cards and unopened products. Pokémon and Riftbound are supported for Singles; Pokémon, Riftbound, and selected One Piece products are supported for Sealed. Magic support is paused and must not be reintroduced through an isolated UI or API branch.

## Runtime and hosting

The application is React 19 and TypeScript compiled by vinext into a Cloudflare Worker. Production is the directly managed Worker `raw-signal` serving `https://rawsignal.cards` on the production D1 database, with a guarded minutely cron advancing daily ingestion in checkpointed batches. A sandbox Worker `raw-signal-staging` stays on workers.dev with its own deliberately stale D1 (no cron) for cheap pre-production review. OpenAI Sites is dormant: `.openai/hosting.json` and Sites build compatibility are retained only as a rollback path (see [Cloudflare cutover](cloudflare-cutover.md)).

`worker/index.ts` is the Worker entry point. It delegates application requests to vinext, retains the Cloudflare image-optimization route, and mounts the scheduled-ingestion cron handler plus the staging-only ops adapter. `vite.config.ts` supplies a local placeholder D1 binding without encoding production resource identifiers.

The migration direction documented in [ADR 001](adr/001-hosting-and-database.md) is complete: the same Worker and logical schema now run on directly managed Cloudflare hosting with scheduled ingestion and resumable history backfill.

## Application layers

### Domain

`core/domain/` owns market types, runtime input contracts, display formatting, and dated-history calculations. Missing source values remain `null`; presentation code decides whether to render `N/A` or another established unavailable label.

### State

`app/state/market-query.ts` is the canonical parser and serializer for Singles and Sealed URL state. `app/state/useMarketQueryState.ts` synchronizes meaningful changes with browser history and replaces rapid search edits so Back/Forward navigation remains useful.

### Catalog service

`core/catalog-query.ts` owns shared fuzzy search, filters, sorting, null ordering, deduplication, facets, signal filtering, sealed calculations, and pagination. Both UI adapters and server repositories call the same query engine.

Repository implementations are transport-neutral:

- the bundled-feed repository reads validated JSON assets;
- the memory repository supports deterministic tests;
- the D1 repository reads a completed published ingestion run;
- `/api/catalog` exposes compact paged results through the same contract.

Production reads D1 (catalog, sealed, and signals report `source: "database"`); bundled feeds remain the automatic fallback for any market without a completed published run. Repository parity is verified with `npm run cloudflare:parity` during cutovers.

Two caches sit in front of D1 (review §14): `worker/edge-cache.ts` stores `/api/*` and `/data/*` GET responses in the colo's Cache API for the `s-maxage` each route declares (Cloudflare does not cache Worker-generated responses on its own; responses carry `X-Raw-Signal-Edge: HIT|MISS`), and the sets directory, set detail, and card detail pages opt into vinext ISR (`export const revalidate = 600`, in-isolate, regenerated in the background). The D1 catalog repository also keeps whole-game product rows per isolate for 10 minutes, keyed by the published run id. All three are accelerators: a cold isolate or colo behaves exactly as before.

### History and signals

`/api/history` normalizes TCGplayer history, preferring durable observations when they exist and caching successful upstream fallback data (the cache warm also re-derives that product's metrics and signals). `/api/history/batch` answers a page of rows from stored series in one query and never writes; the leaderboard's rows render their change and range columns from the `metrics` block the D1 feeds carry (`db/catalog-repository.ts` `readSectionFeed`/`readSealedFeed`), and fetch a series only for an inline or revealed chart. `core/clients/tcgplayer-history.ts` loads the annual/quarterly TCGplayer series for the route and the history backfill; `core/domain/history-metrics.ts` derives 7-, 30-, and 90-day changes plus extrema from dated observations.

`core/signal-utils.ts` is the single Buy/Sell scoring implementation, called by the batch writer, the detail panel, row badges, and the backtest harness through one optional `SignalContext` (liquidity floor, demand trend, model variant; absent fields are neutral). The production model (v1) evaluates proximity, adaptive volatility cutoffs, opposite-extreme price swing, strictness, coverage confidence, a buy-side stabilization gate, and the 5/30D + 1/7D liquidity floor, returning explicit non-qualification reasons for diagnostics. A challenger (v2: winsorized percentile extremes, breakout sell gate) rides the same code behind `model:"v2"` and serves nothing until promoted (todo §P; evidence in `docs/backtests.md`).

`core/domain/regime.ts` classifies every product's market regime (Falling / Improving / Breakout / Overextended / Spike / Steady) from momentum, change windows, drawdown, and the optional demand trend. The label persists on `market_metrics.regime`, surfaces as chips (board signal cells, history popovers, detail page), and is a board filter (`regime=` URL param). Labels are descriptive; only the v2 challenger consumes them for scoring.

Persisted signals become authoritative only when the independent `history-signals` completion marker exists (published in production since 2026-08-28). Before that marker, `app/data/signal-coverage.ts` selects at most 400 proportional, price-stratified candidates and the interface discloses that transitional coverage.

`scripts/backtest/walk-forward.mjs` (`npm run backtest:walk`) replays the local max-profile archive through the production evaluator for walk-forward validation; findings land in `docs/backtests.md`.

The champion/challenger shadow (todo P1b) runs live: daily ingestion also evaluates the v2 challenger into `shadow_signals`, the metrics rollup snapshots its top-100 boards into `shadow_signal_history` beside the champion's `signal_history`, and `npm run shadow:scoreboard` compares forward returns (promotion needs the harness verdict plus ~30 days of shadow overlap).

### Presentation

`app/page.tsx` composes the application shell and Singles adapter. `app/SealedView.tsx` adapts the same shared leaderboard, control, filter, disclosure, pagination, history, and signal primitives for unopened products.

Shared primitives live under `app/leaderboard/`, `app/filters/`, `MarketUI.tsx`, `HistoryPanel.tsx`, and `PriceChart.tsx`. Component-owned CSS is loaded in this order (later sheets deliberately out-rank earlier ones; `tests/css-architecture.test.mjs` pins the core of it):

1. `app/styles/fonts.css`;
2. `app/styles/tokens.css`;
3. `app/globals.css`;
4. `app/market-views.css`;
5. `app/styles/market-controls.css`;
6. `app/styles/market-content.css`;
7. `app/detail.css`;
8. `app/metrics.css`;
9. `app/buylist.css`;
10. `app/sets.css`;
11. `app/collectr.css`.

New rules should use the shared tokens and component-owned styles rather than append another versioned override to a legacy stylesheet.

## Data lifecycle

1. Source clients fetch TCGCSV and approved supplemental data with bounded retries.
2. Pure normalizers create domain records and explicit rejection counts.
3. Validators enforce schema, identity, market ownership, duplicates, nullability, and minimum record counts.
4. Last-good publication replaces generated feeds only after validation succeeds.
5. Daily D1 ingestion upserts catalog/current prices, records dated observations, derives metrics/signals, and advances the published pointer only after success.
6. Resumable history backfill processes bounded batches and publishes signal readiness only when the complete target set finishes.

See [Data ingestion](data-ingestion.md) for operations and failure behavior.

## Reliability boundaries

- A malformed refresh must not overwrite the last-good feed.
- An incomplete D1 run must not become readable as the current catalog.
- An interrupted history backfill must resume from its durable cursor.
- Missing data must not be silently inferred.
- Listing prices must not be described as sales volume.
- Rows and artwork are non-navigational; a marketplace action can be added later as an explicit button.

## Tests and release gate

`npm run check` is the required local and CI gate. It builds the production Worker, runs all unit/contract/characterization/critical-journey tests, lints the repository, type-checks it (`tsc --noEmit`), and runs the focused Playwright journey suite against a suite-managed local server on port 4173 (stop the :3000 dev server first: vinext refuses a second dev server for the same directory). Migrations under `drizzle/` are hand-written, contiguously numbered SQL files applied by wrangler in filename order; `drizzle-kit` is retired (its journal stopped at 0004, and the generator, its config, and the devDependency were removed on 2026-09-03). `drizzle-orm` remains for the schema types in `db/schema.ts`.
