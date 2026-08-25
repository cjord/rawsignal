# Raw Signal data ingestion

## Current operating model

OpenAI Sites hosts the application and owns the logical `DB` binding. Sites does not currently configure a Cron Trigger for this project, so production refreshes remain controlled sync operations. Do not expose an unauthenticated ingestion route as a scheduling substitute.

`sync-tcgcsv.mjs` and `sync-sealed.mjs` now separate four concerns:

1. retrying source clients under `scripts/clients/`;
2. deterministic normalization under `scripts/normalize/`;
3. schema, identity, nullability, duplicate, and minimum-count validation under `scripts/validate/`;
4. staged last-good output replacement under `scripts/io/`.

Every successful sync produces provenance metadata containing schema version, source update time, record counts, rejected-record reasons, and duplicate decisions. Validation completes before any last-good file is replaced.

## Durable market observations

`runDailyMarketIngestion` is the Cloudflare-compatible database job boundary. A daily run:

- validates that product IDs are unique and the snapshot is non-empty;
- upserts catalog identities and current prices idempotently;
- records one dated observation for every available market price;
- recalculates 7-, 30-, and 90-day metrics and extrema;
- replaces all Conservative, Balanced, and Aggressive Buy/Sell signals, deleting signals that no longer qualify;
- records coverage, observation date, counts, rejection totals, duplicate decisions, and source freshness;
- advances `refresh_state` only after every record succeeds.

The catalog API compares the published run count with records bearing that run ID. While a new run is incomplete, it serves the last-good bundled feed instead of a partial database result.

## History backfill and signal readiness

The previous browser implementation evaluates at most 400 candidates. Pokémon currently has 499 Illustration Rares and 721 cards across Illustration Rare plus Special Illustration Rare, so 99 and 321 candidates respectively can be unevaluated in that fallback.

`runHistoryBackfillBatch` replaces that limitation without creating one oversized Worker invocation. It processes a bounded batch, persists its cursor, stores exact/fallback coverage, and derives signals from normalized observations. Only completion advances the independent `history-signals` marker. Singles and Sealed use persisted signals only when that marker exists; otherwise they keep the bounded fallback. Singles discloses its evaluated-candidate count during this transition.

## Direct Cloudflare activation

When hosting moves to a directly managed Cloudflare Worker:

1. bind the migrated D1 database as `DB`;
2. implement the scheduled adapter that obtains a validated live TCGCSV snapshot and calls `runDailyMarketIngestion`;
3. configure a daily Cron Trigger for catalog/current-price ingestion;
4. configure bounded continuation invocations for `runHistoryBackfillBatch` until it reports `done`;
5. verify catalog counts, nullable values, representative histories, rejection totals, and signal counts against the bundled feeds;
6. confirm `history-signals` is present before removing the browser fallback;
7. monitor failed ingestion runs and source freshness without advancing the last-success pointer.

Daily TCGCSV observations are sufficient for ongoing history after backfill. Detailed TCGplayer history remains the one-time/bootstrap and cache-miss source, rather than a daily full-catalog fan-out.
