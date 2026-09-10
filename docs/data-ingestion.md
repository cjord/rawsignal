# Raw Signal data ingestion

## Current operating model

The production Worker `raw-signal` owns the `DB` binding to the production D1 database and runs a `*/1 * * * *` guard cron (`worker/scheduled-ingestion.ts`, policy in `worker/scheduled-decision.ts`). Every tick first claims the single-flight `cron-lease` row in `refresh_state` for 170 seconds (`db/tick-lease.ts`) or exits idle, then advances at most one checkpointed batch of the first due job in policy order: live catalog walk → product details → graded rotation → metrics rollup → history backfill. Staging carries no schedule; its jobs run only through the operator adapter. Do not expose an unauthenticated ingestion route as a scheduling substitute.

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
npm run data:sync:sealed:onepiece
```

These commands access external services and can rewrite generated feeds. Review validation output and diffs before committing them. `sync-sealed.mjs` regenerates Pokémon Sealed and `sync-sealed-onepiece.mjs` regenerates One Piece Sealed (TCGCSV category 68, same validation and last-good publication); the Riftbound Sealed feed is a maintained asset until a dedicated validated generator is added.

## Durable market observations

`runDailyMarketIngestion` is the Cloudflare-compatible database job boundary. A daily run:

- validates that product IDs are unique and the snapshot is non-empty;
- upserts catalog identities and current prices idempotently;
- records one dated observation for every available market price;
- recalculates 7-, 30-, and 90-day metrics and extrema;
- classifies and stores the market-regime label (`market_metrics.regime`) from the same points, plus the demand-trend counts (`sales_30_prior` alongside `sales_7`/`sales_30`) when the fetch carried sale buckets;
- replaces all Conservative, Balanced, and Aggressive Buy/Sell signals, deleting signals that no longer qualify (evaluated with the liquidity floor and demand trend via `SignalContext`);
- evaluates the v2 challenger at balanced strictness into `shadow_signals` (todo P1b) — never served; the daily metrics rollup (keyed to the live run's publish date, `metrics-rollup:<date>`, and run by the guard cron once that live run is published — R1, 2026-09-03) snapshots its top-100 boards into `shadow_signal_history` for the champion/challenger scoreboard;
- writes the per-tier set aggregates (`set_rarity_stats`, see "Per-tier set aggregates" below) from the group files the walk already fetched;
- records coverage, observation date, counts, rejection totals, duplicate decisions, and source freshness;
- advances `refresh_state` only after every record succeeds.

The catalog API compares the published run count with records bearing that run ID. While a new run is incomplete, it serves the last-good bundled feed instead of a partial database result.

## History backfill and signal readiness

The `history-signals` readiness marker has been published in production since 2026-08-28, so the bounded browser evaluation below is the cold-start fallback for a database without it, not a live transition. That fallback evaluates at most 400 candidates (`SIGNAL_FALLBACK_LIMIT`). Pokémon has 499 Illustration Rares and 721 cards across Illustration Rare plus Special Illustration Rare, so 99 and 321 candidates respectively can be unevaluated in that fallback.

Candidate selection is proportional across selected rarities and evenly stratified through each rarity's existing price order. An earlier source file or only the highest-priced records can no longer consume the full budget.

`runHistoryBackfillBatch` removes that limitation without creating one oversized Worker invocation. It processes a bounded batch, persists its cursor, stores exact/fallback coverage, and derives signals from normalized observations. Only completion advances the independent `history-signals` marker. Singles and Sealed use persisted signals only when that marker exists; otherwise they retain the bounded fallback, and Singles discloses its evaluated-candidate count.

See [Signal eligibility](signal-eligibility.md) for the qualification and exclusion contract.

## Cloudflare activation (completed 2026-08-28)

The move to a directly managed Worker is done (see [Cloudflare cutover](cloudflare-cutover.md)): the production D1 database is bound as `DB`; the scheduled adapter walks TCGCSV live and calls `runDailyMarketIngestion` in checkpointed batches; the guard cron runs every minute rather than daily, taking the first due job in policy order; `runHistoryBackfillBatch` continues on idle ticks until it reports `done`; catalog counts, nullable values, representative histories, rejection totals, and signal counts were verified against the bundled feeds; `history-signals` is present; and failed runs are recorded without advancing the last-success pointer.

Daily TCGCSV observations are sufficient for ongoing history after backfill. Detailed TCGplayer history remains the bootstrap and cache-miss source rather than a daily full-catalog fan-out.

## eBay on-demand listing cache (2026-09-10)

`db/ebay-ingestion.ts` keeps one active-ask snapshot per product in `ebay_listings`.
Migration 0018 adds the accepted sample count and an explicit expiry, plus the shared
`ebay_api_usage` budget and `ebay_fetch_leases` concurrency guard. The Browse application
token is minted with the client-credentials grant and cached per Worker isolate.

- **Demand path.** `ProductDetailPage` starts `GET /api/ebay/listings?productId=` only when
  its listing section approaches the viewport. A snapshot whose `expires_at` is still in the
  future returns from D1 without an eBay call. A stale or absent snapshot spends one Browse
  search, writes a new six-hour snapshot, and returns it; expired data is never displayed.
- **Quota and concurrency.** An atomic D1 counter admits no more than 4,000 interactive calls
  per UTC day inside eBay's default 5,000-call allowance, leaving 1,000 calls of headroom.
  A 30-second atomic lease per product coalesces simultaneous misses; losing callers receive
  a short retry response instead of duplicating the upstream request.
- **Query.** The request uses the same text as the site's eBay search link, the individual
  cards category for singles, ungraded (singles) or new (sealed) condition, fixed-price USD
  listings, and a price window of ¼× to 4× the TCGplayer market price. Singles also use
  eBay's `Language` aspect: English by default, Japanese for the `japanese-promos` section
  and Japanese promo-number families such as `S-P`/`SV-P`, or the language explicitly named
  by a language-specific promo. The ordinary and sold eBay links carry the matching Language
  facet. Fewer than three accepted listings still records the result count and samples, but
  aggregate asks remain unavailable. Samples include an HTTPS image, title, condition, price,
  shipping, and the affiliate item URL when eBay supplies one.
- **Configuration.** `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are Worker secrets, never vars
  or repository files. The eBay Dev ID is not used by the Browse client-credentials flow.
  Optional var `EBAY_EPN_CAMPAIGN_ID` enables affiliate item URLs and a per-product reference
  ID. Without both secrets the API returns unavailable and the ordinary search links remain.
- **Account-deletion compliance.** `GET|POST /api/ebay/account-deletion` runs directly in
  the Worker, never in the page cache. `EBAY_DELETION_VERIFICATION_TOKEN` is a 32–80 character
  Worker secret shared only with eBay; the deployment config pins the exact production URL in
  public var `EBAY_DELETION_ENDPOINT_URL`. POST validates eBay's signed payload with the
  Notification API public key (one-hour in-isolate cache) before acknowledging it. No current
  table stores `username`, `userId`, or `eiasToken`, so the deletion processor is deliberately
  empty until a user-linked eBay field is introduced.
- **Background job.** The former ≥$20 catalog rotation is not in production cron: a multi-day
  sweep cannot meet the six-hour display rule efficiently. `POST /__ops/staging-jobs` with
  `{"job":"ebay","batchSize":40}` remains only for an explicit staging trial.

Production also reads optional `ALPHAVANTAGE_API_KEY` on each metrics tick for the S&P
benchmark (`db/benchmark-ingestion.ts`); when absent, that step skips silently.

## Image sources (2026-09-04)

Product images are TCGplayer's CDN (`tcgplayer-cdn.tcgplayer.com/product/<id>_in_1000x1000.jpg`),
complete for every catalog row in production. The CDN never 404s a product id: an id it has no
photo for returns a 200 placeholder JPEG (400×570; 200×285 for `_200w`), so `DeferredImage`
treats a loaded CDN image of exactly that size as a failure (audit: 0 placeholders in 300
sampled production URLs). Two manual sync scripts keep the fallbacks current:

- `node scripts/sets/sync-set-logos.mjs` — Pokémon set logos and symbols from pokemontcg.io into
  `app/data/set-logos.json` (141 of 308 production Pokémon sets match; Japanese sets, promos,
  trainer kits, and non-Pokémon games have no free logo source and show cover art instead).
- `node scripts/sets/sync-tcgdex.mjs` — the TCGdex set index into `app/data/tcgdex-sets.json`
  (English and Japanese sets with cards, keyed by set code and by name) for the card-image
  fallback; run when a new Pokémon set ships.

Sets without a logo show their highest-market product's art (`SetDirectoryRow.cover`, one
catalog scan inside the cached sets query). Supplemental sealed products carry their image in
`scripts/scalper/supplemental-products.json` (`image`, with an `imageNote` where the shot is a
stand-in) and the Riftbound Chinese/Korean editions in `public/data/sealed-riftbound.json`; the
next live run upserts those into `catalog_products.image_url`.

Sources considered and rejected: pokemontcg.io's API (timed out during the audit; its image
host answered), TCGdex Japanese logos (none published), Riftcodex (Riot CDN card images keyed by
TCGplayer id, but behind a browser-only challenge and with no set logos), Bandai's English site
(current products only), and API TCG (checked with a key: 300 requests a minute, sets for all
our games but no logos or set images, and product images that are TCGplayer CDN URLs — useful
only as a product-search index over TCGplayer's catalog, which is how two supplemental
products found their images).

## Per-tier set aggregates (2026-09-04, todo J2)

`set_rarity_stats` (migration 0017) holds one row per set × tier for every rarity in a TCGCSV
singles group, including the commons, uncommons, and rares the catalog never tracks. The live
walk computes it from the products and prices files it already fetches (`summarizeGroupRarities`)
and upserts the group's rows with the group's first slice each run — about 3 k rows a day, no
extra requests. Riftbound's showcase and rare tiers key by section slug (`alt-arts`,
`overnumbered`, `signatures`, `rares`, `epics`) because they share rarity strings; every other
tier keys by rarity. `sum_cents` is over priced cards, `card_count` over all cards, so the
displayed average divides by every card. Japanese promo groups (fixed section, no rarity
taxonomy) and sealed-only categories write nothing. The set page reads a set's rows with one
primary-key range scan and prices them with the curated `perPack` (cards per pack) and
packs-per-hit tables in `public/data/pull-rates.json`.
