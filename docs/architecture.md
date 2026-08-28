# Raw Signal architecture

## Product boundary

Raw Signal presents market intelligence for raw trading cards and unopened products. Pokémon and Riftbound are supported for Singles; Pokémon, Riftbound, and selected One Piece products are supported for Sealed. Magic support is paused and must not be reintroduced through an isolated UI or API branch.

## Runtime and hosting

The application is React 19 and TypeScript compiled by vinext into a Cloudflare Worker. Production is the directly managed Worker `raw-signal` serving `https://rawsignal.cards` on the production D1 database, with a guarded `*/2` cron advancing daily ingestion in checkpointed batches. A sandbox Worker `raw-signal-staging` stays on workers.dev with its own deliberately stale D1 (no cron) for cheap pre-production review. OpenAI Sites is dormant: `.openai/hosting.json` and Sites build compatibility are retained only as a rollback path (see [Cloudflare cutover](cloudflare-cutover.md)).

`worker/index.ts` is the Worker entry point. It delegates application requests to vinext, retains the Cloudflare image-optimization route, and mounts the scheduled-ingestion cron handler plus the staging-only ops adapter. `vite.config.ts` supplies a local placeholder D1 binding without encoding production resource identifiers.

The migration direction documented in [ADR 001](adr/001-hosting-and-database.md) is complete: the same Worker and logical schema now run on directly managed Cloudflare hosting with scheduled ingestion and resumable history backfill.

## Application layers

### Domain

`app/domain/` owns market types, runtime input contracts, display formatting, and dated-history calculations. Missing source values remain `null`; presentation code decides whether to render `N/A` or another established unavailable label.

### State

`app/state/market-query.ts` is the canonical parser and serializer for Singles and Sealed URL state. `app/state/useMarketQueryState.ts` synchronizes meaningful changes with browser history and replaces rapid search edits so Back/Forward navigation remains useful.

### Catalog service

`app/data/catalog-query.ts` owns shared fuzzy search, filters, sorting, null ordering, deduplication, facets, signal filtering, sealed calculations, and pagination. Both UI adapters and server repositories call the same query engine.

Repository implementations are transport-neutral:

- the bundled-feed repository reads validated JSON assets;
- the memory repository supports deterministic tests;
- the D1 repository reads a completed published ingestion run;
- `/api/catalog` exposes compact paged results through the same contract.

Production reads D1 (catalog, sealed, and signals report `source: "database"`); bundled feeds remain the automatic fallback for any market without a completed published run. Repository parity is verified with `npm run cloudflare:parity` during cutovers.

### History and signals

`/api/history` normalizes TCGplayer history, preferring durable observations when they exist and caching successful upstream fallback data. `app/domain/history-metrics.ts` derives 7-, 30-, and 90-day changes plus extrema from dated observations.

`app/signal-utils.ts` is the single Buy/Sell scoring implementation. It evaluates proximity, adaptive volatility cutoffs, opposite-extreme price swing, strictness, and coverage confidence. It also returns explicit non-qualification reasons for diagnostics.

Persisted signals become authoritative only when the independent `history-signals` completion marker exists. Before that marker, `app/data/signal-coverage.ts` selects at most 400 proportional, price-stratified candidates and the interface discloses that transitional coverage.

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
9. `app/buylist.css`.

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

`npm run check` is the required local and CI gate. It builds the production Worker, runs all unit/contract/rendered-output/critical-journey tests plus the focused Playwright journey suite against a suite-managed local server, and lints the repository. Stop the dev server first — Playwright owns port 3000 during the gate.
