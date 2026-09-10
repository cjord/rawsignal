# PokemonPriceTracker removal plan (2026-09)

## Decision and boundary

Retire PokemonPriceTracker as a Raw Signal source instead of upgrading its plan. The
provider currently supplies graded and raw-card completed-sale snapshots for a small,
slowly rotating subset of Pokémon singles. It does not feed the catalog, price history,
signals, metrics, or modeled fair value, so removing it does not require replacing those
core market features.

eBay Browse data is not a semantic replacement. It provides current active listings and
asks, not completed sales. After removal, the eBay panel must continue to say "asks" and
the graded/sold-price fields must render as unavailable or be removed; they must never be
backfilled from listing prices.

## Current footprint

- `db/graded-ingestion.ts` spends 90 credits a day (two credits per card), prioritizing a
  600-card Pokémon pool. That is at most 45 attempted cards per day, or about 13.3 days for
  one best-case pass before no-data responses and retries.
- `graded_prices` stores the parsed grade map. The product detail page displays sales count,
  median, smart-market price and confidence, market trend, raw-versus-graded comparisons,
  and the PSA 10 grading edge. Average price and last-sale date are stored but not displayed.
- The bundled fallback is `public/data/graded-prices.json`; the local sync entry point is
  `scripts/graded/sync-graded.mjs` / `npm run data:sync:graded`.
- The production scheduler, staging job adapter, page publish signature, Worker environment,
  tests, and maintainer documentation all carry a graded/PokemonPriceTracker branch.

## Removal sequence

### Phase 0 — rollback baseline

1. Export or otherwise retain a dated copy of `graded_prices` outside the deploy artifact,
   record row count and newest/oldest fetch dates, and capture representative card pages.
2. Record the current production secret name, scheduler state, and bundled-feed checksum;
   never copy the secret value into source, logs, or the backup report.
3. Add characterization coverage proving ordinary card and sealed detail pages work with no
   graded record. Keep the existing D1 table during the first deploy for a simple rollback.

### Phase 1 — remove the read and presentation path

1. Remove the graded panel and every raw/graded derived comparison from
   `app/ProductDetailPage.tsx`.
2. Remove `CatalogDetailBase.graded`, the loader/parser contract, bundled-repository join,
   and `db/catalog-repository.ts`'s graded read. Missing completed-sale data then has no UI
   placeholder that could be mistaken for an eBay Browse substitute.
3. Remove the no-longer-reachable helpers in `core/graded.ts` and the corresponding detail,
   domain-contract, and rendering tests.

### Phase 2 — stop collection and spending

1. Remove the `graded` action from `worker/scheduled-decision.ts` and
   `worker/scheduled-ingestion.ts`; the production order becomes live → details → metrics →
   history. Remove the staging adapter job at the same time.
2. Remove `db/graded-ingestion.ts`, the PokemonPriceTracker client configuration, and
   `POKEMONPRICETRACKER_API_KEY` from Worker environment types and deployment documentation.
3. Remove `graded-rotation` from `worker/page-signature.ts` only after the read path is gone,
   so the deployment itself invalidates cached pages without depending on that checkpoint.
4. Deploy, verify the scheduler advances through metrics/history, verify representative
   details return normally, then delete the production Worker secret. Secret deletion is
   last so rolling back the code remains possible during the initial verification window.

### Phase 3 — remove fallback and historical storage

1. Remove `scripts/graded/sync-graded.mjs`, the package script, the generated fallback file,
   feed parsing/loading code, fixtures, and source-contract assertions.
2. Update `architecture.md`, `data-sources.md`, `data-ingestion.md`, roadmap/todo history,
   and operational docs. Historical completed-work notes can remain, clearly marked as the
   superseded implementation record.
3. After a production soak and backup check, add the next numbered hand-written migration
   that drops `graded_prices`. Do not edit the original migration. Apply it after the code
   deploy to staging and production, then verify no query or publish-signature reference
   remains.

## Acceptance gate

- `rg -i "pokemonpricetracker|graded_prices|graded-rotation|data:sync:graded"` returns only
  intentional history and this removal record.
- No Worker environment or deployment config expects the provider key; no scheduled or
  operator action can spend provider credits.
- Singles and sealed detail pages pass with and without eBay credentials, and no active ask
  is labelled as a sale, comp, graded value, or fair value input.
- Scheduler tests pin the new live → details → metrics → history order; the complete
  `npm run check` gate is green before each deployment.
- The D1 table is dropped only in Phase 3, after the rollback window closes.
