# Raw Signal architecture

## Product boundary

Raw Signal presents market intelligence for raw trading cards and unopened products. Pokémon and Riftbound are supported for Singles; Pokémon, Riftbound, and selected One Piece products are supported for Sealed. Magic support is paused and must not be reintroduced through an isolated UI or API branch.

## Runtime and hosting

The application is React 19 and TypeScript compiled by vinext into a Cloudflare Worker-compatible build. OpenAI Sites is the current host. `.openai/hosting.json` declares the existing Site project and one logical D1 binding named `DB`; Sites owns the physical resource and deployment wiring.

`worker/index.ts` is the Worker entry point. It delegates application requests to vinext and retains the Cloudflare image-optimization route. `vite.config.ts` supplies a local placeholder D1 binding without encoding production resource identifiers.

The accepted migration direction is documented in [ADR 001](adr/001-hosting-and-database.md): move the same Worker and logical schema to directly managed Cloudflare hosting, then add scheduled ingestion and resumable history backfill.

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

The current browser remains on bundled feeds until D1 is fully populated and parity-validated. Server-side pagination should become authoritative only after that cutover.

### History and signals

`/api/history` normalizes TCGplayer history, preferring durable observations when they exist and caching successful upstream fallback data. `app/domain/history-metrics.ts` derives 7-, 30-, and 90-day changes plus extrema from dated observations.

`app/signal-utils.ts` is the single Buy/Sell scoring implementation. It evaluates proximity, adaptive volatility cutoffs, opposite-extreme price swing, strictness, and coverage confidence. It also returns explicit non-qualification reasons for diagnostics.

Persisted signals become authoritative only when the independent `history-signals` completion marker exists. Before that marker, `app/data/signal-coverage.ts` selects at most 400 proportional, price-stratified candidates and the interface discloses that transitional coverage.

### Presentation

`app/page.tsx` composes the application shell and Singles adapter. `app/SealedView.tsx` adapts the same shared leaderboard, control, filter, disclosure, pagination, history, and signal primitives for unopened products.

Shared primitives live under `app/leaderboard/`, `app/filters/`, `MarketUI.tsx`, `HistoryPanel.tsx`, and `PriceChart.tsx`. Component-owned CSS is loaded after base and legacy styles in this order:

1. `app/styles/tokens.css`;
2. `app/globals.css`;
3. `app/market-views.css`;
4. `app/styles/market-controls.css`;
5. `app/styles/market-content.css`.

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

`npm run check` is the required local and CI gate. It builds the production Worker, runs all unit/contract/rendered-output/critical-journey tests, and lints the repository. Stable Cloudflare previews should later host the focused browser suite for pointer, touch, theme, responsive, and Back/Forward journeys.
