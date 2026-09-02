# Raw Signal data ingestion

## Current operating model

OpenAI Sites hosts the application and owns the logical `DB` binding. Sites does not currently configure a Cron Trigger for this project, so production refreshes remain controlled sync operations. Do not expose an unauthenticated ingestion route as a scheduling substitute.

`sync-tcgcsv.mjs` and `sync-sealed.mjs` separate four concerns:

1. retrying source clients under `core/clients/`;
2. deterministic normalization under `core/normalize/`;
3. schema, identity, nullability, duplicate, and minimum-count validation under `scripts/validate/`;
4. staged last-good output replacement under `scripts/io/`.

Every successful sync produces provenance metadata containing schema version, source update time, record counts, rejected-record reasons, and duplicate decisions. Validation completes before any last-good file is replaced.

## Refresh commands

```powershell
npm run data:sync:singles
npm run data:sync:sealed
```

Both commands access external services and can rewrite generated feeds. Review validation output and diffs before committing them. `sync-sealed.mjs` currently regenerates Pokémon Sealed only; Riftbound and One Piece Sealed feeds are maintained assets until dedicated validated generators are added.

## Durable market observations

`runDailyMarketIngestion` is the Cloudflare-compatible database job boundary. A daily run:

- validates that product IDs are unique and the snapshot is non-empty;
- upserts catalog identities and current prices idempotently;
- records one dated observation for every available market price;
- recalculates 7-, 30-, and 90-day metrics and extrema;
- classifies and stores the market-regime label (`market_metrics.regime`) from the same points, plus the demand-trend counts (`sales_30_prior` alongside `sales_7`/`sales_30`) when the fetch carried sale buckets;
- replaces all Conservative, Balanced, and Aggressive Buy/Sell signals, deleting signals that no longer qualify (evaluated with the liquidity floor and demand trend via `SignalContext`);
- evaluates the v2 challenger at balanced strictness into `shadow_signals` (todo P1b) — never served; the daily metrics rollup snapshots its top-100 boards into `shadow_signal_history` for the champion/challenger scoreboard;
- records coverage, observation date, counts, rejection totals, duplicate decisions, and source freshness;
- advances `refresh_state` only after every record succeeds.

The catalog API compares the published run count with records bearing that run ID. While a new run is incomplete, it serves the last-good bundled feed instead of a partial database result.

## History backfill and signal readiness

The transitional browser implementation evaluates at most 400 candidates. Pokémon currently has 499 Illustration Rares and 721 cards across Illustration Rare plus Special Illustration Rare, so 99 and 321 candidates respectively can be unevaluated in that fallback.

Candidate selection is proportional across selected rarities and evenly stratified through each rarity's existing price order. An earlier source file or only the highest-priced records can no longer consume the full budget.

`runHistoryBackfillBatch` removes that limitation without creating one oversized Worker invocation. It processes a bounded batch, persists its cursor, stores exact/fallback coverage, and derives signals from normalized observations. Only completion advances the independent `history-signals` marker. Singles and Sealed use persisted signals only when that marker exists; otherwise they retain the bounded fallback. Singles discloses its evaluated-candidate count during this transition.

See [Signal eligibility](signal-eligibility.md) for the qualification and exclusion contract.

## Direct Cloudflare activation

When hosting moves to a directly managed Cloudflare Worker:

1. bind the migrated D1 database as `DB`;
2. implement the scheduled adapter that obtains a validated live TCGCSV snapshot and calls `runDailyMarketIngestion`;
3. configure a daily Cron Trigger for catalog/current-price ingestion;
4. configure bounded continuation invocations for `runHistoryBackfillBatch` until it reports `done`;
5. verify catalog counts, nullable values, representative histories, rejection totals, and signal counts against the bundled feeds;
6. confirm `history-signals` is present before removing the browser fallback;
7. monitor failed ingestion runs and source freshness without advancing the last-success pointer.

Daily TCGCSV observations are sufficient for ongoing history after backfill. Detailed TCGplayer history remains the bootstrap and cache-miss source rather than a daily full-catalog fan-out.
