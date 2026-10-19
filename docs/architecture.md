# Raw Signal architecture

## Product boundary

Raw Signal presents market intelligence for raw trading cards and unopened products. Pokémon and Riftbound are supported for Singles; Pokémon, Riftbound, and selected One Piece products are supported for Sealed. Magic support is paused and must not be reintroduced through an isolated UI or API branch.

## Runtime and hosting

The application is React 19 and TypeScript compiled by vinext into a Cloudflare Worker. Production is the directly managed Worker `raw-signal` serving `https://rawsignal.cards` on the production D1 database, with a guarded minutely cron advancing daily ingestion in checkpointed batches (policy order live → details → graded → metrics → heatmap snapshot → history; each tick first claims the 170-second `cron-lease` row in `refresh_state` via `db/tick-lease.ts`, so an overlapping tick exits idle). A sandbox Worker `raw-signal-staging` stays on workers.dev with its own deliberately stale D1 (no cron) for cheap pre-production review. OpenAI Sites is dormant: `.openai/hosting.json` and Sites build compatibility are retained only as a rollback path (see [Cloudflare cutover](cloudflare-cutover.md)).

`worker/index.ts` is the Worker entry point. It delegates application requests to vinext, retains the Cloudflare image-optimization route, and mounts the scheduled-ingestion cron handler, the staging-only ops adapter, and the Worker-native eBay account-deletion callback. `vite.config.ts` supplies a local placeholder D1 binding without encoding production resource identifiers.

The migration direction documented in [ADR 001](adr/001-hosting-and-database.md) is complete: the same Worker and logical schema now run on directly managed Cloudflare hosting with scheduled ingestion and resumable history backfill.

## Application layers

### Optional accounts

The local account foundation is default-off. `worker/account-auth.ts` configures
Better Auth and native email sending; `worker/account-routes.ts` intercepts private
auth/save routes before public caches. `db/account-documents.ts` owns session-scoped
revision-checked D1 writes; pure save validation lives in `core/domain/account-data.ts`.
`app/account/` provides controls and the guest/account storage boundary. No account
data is embedded in publicly cached market HTML, and unrelated market requests do
not query auth tables. Deployment/remaining launch work:
[Accounts and collections](accounts-and-collections.md).

Local follow-up adds `db/account-recovery.ts` (wrapped owner keys), `db/admin-audit.ts`
(bounded append-only access ledger), `worker/admin-pages.ts` + `admin-routes.ts`
(private server-enforced management access), and encrypted pending-draft IndexedDB
storage in `app/account/recovery-*`. Migration 0025 and explicit audit/recovery flags
are required; neither is remotely activated yet. The read-only `/admin`, `/admin/audit`
and `/admin/data` surfaces make no upstream market requests and add no cron.
[Scope, costs and safeguards](admin-and-recovery.md).

The next slice adds read-only `/admin/accounts`, `/admin/quality`, `/admin/jobs` and
an explicitly opt-in auction community. `db/admin-health.ts` reads bounded support
metadata/coverage/job data; `db/auction-community.ts` exposes only allowlisted public
profile fields. Migration 0026 projects unverified normal-play statistics atomically
from successful game-document saves. Community APIs run before edge caches so privacy
revocation affects future reads. `AUTH_COMMUNITY_ENABLED` is explicit/default-off.
[Community and management follow-up](auction-community.md).

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

Two caches sit in front of D1 (review §14): `worker/edge-cache.ts` stores ordinary `/api/*` and `/data/*` GET responses in the colo's Cache API for the `s-maxage` each route declares, capped at ten minutes (Cloudflare does not cache Worker-generated responses on its own; responses carry `X-Raw-Signal-Edge: HIT|MISS`), and the sets, card detail, sealed detail, and metrics pages are cached by the same layer, keyed by URL, the request headers vinext varies on, and a publish signature (`worker/page-signature.ts`: the published run ids of `daily-market`, `product-details`, `metrics-rollup`, `history-signals`, and `graded-rotation` plus the deployed version, read at most once a minute per isolate), so an entry lives until the next publish or deploy, up to a 36-hour ceiling (vinext's ISR was tried and never wrote an entry in production). `/api/ebay/listings` is a deliberate `private, no-store` exception that reads a D1 snapshot with an explicit six-hour expiry and performs at most one upstream Browse search when that product is stale. `/api/ebay/account-deletion` is intercepted before the cache entirely. `public/robots.txt` keeps crawlers off `/api/`, `/data/`, and the tooling paths, and `/sitemap.xml` lists the boards, the sets directory, the metrics page, and every set page — not the 18 k product pages. The D1 catalog repository also keeps whole-game product rows per isolate for 10 minutes, keyed by the published run id, and the early-value reader keeps its sibling-set list the same way. All of these are accelerators: a cold isolate or colo behaves exactly as before.

### History and signals

`/api/history` and `/api/history/batch` read exact shared price-history snapshots and never fetch upstream data or write metrics on a visitor request. Migration 0021 adds the current and previous snapshot's ID/JSON to `market_metrics`; the existing atomic metrics upsert writes rounded metrics and the normalized points that produced them together. Daily passes use combined durable observations; background TCGplayer refreshes derive from that same combined series after persisting their delta, rather than replacing it with the upstream-only window. Singles match the exact printing/Near Mint, and Sealed uses Sealed/Unopened; another printing is never substituted. Catalog feeds, catalog API rows, detail payloads and metrics movers carry the version their figures describe. Lazy charts request that version, with the cache URL and browser history key including it. Loading charts cannot change leaderboard metrics, filtering or order. One prior content version survives a refresh; a version older than that, an unversioned legacy metric block, or an unavailable snapshot shows no chart rather than conflicting points. Bundled feeds without snapshot metrics remain unavailable. Import rows derive their displayed movement and chart from one fetched snapshot; saved buylist prices remain explicitly capture-time values. `core/clients/tcgplayer-history.ts` is now background-only; `core/domain/history-metrics.ts` supplies both row calculations and chart cutoff changes. This revision is live in both environments since 2026-10-14: migration 0021 and guarded stored-observation bootstrap populated 19,044 staging and 19,085 production printing/condition series, including alternate printings. Full-database audits found zero metric/version mismatches; live browser checks confirmed row/chart parity and stable hover order. Staging remains cron-less; production's ordinary ingestion maintains subsequent versions.

`core/signal-utils.ts` is the single Buy/Sell scoring implementation, called by the batch writer, the detail panel, row badges, and the backtest harness through one optional `SignalContext` (liquidity floor, demand trend, model variant; absent fields are neutral). The production model (v1) evaluates proximity, adaptive volatility cutoffs, opposite-extreme price swing, strictness, coverage confidence, a buy-side stabilization gate, and the 5/30D + 1/7D liquidity floor, returning explicit non-qualification reasons for diagnostics. A challenger (v2: winsorized percentile extremes, breakout sell gate) rides the same code behind `model:"v2"` and serves nothing until promoted (todo §P; evidence in `docs/backtests.md`).

`core/domain/regime.ts` classifies every product's market regime (Falling / Improving / Breakout / Overextended / Spike / Steady) from momentum, change windows, drawdown, and the optional demand trend. The label persists on `market_metrics.regime`, surfaces as chips (board signal cells, history popovers, detail page), and is a board filter (`regime=` URL param). Labels are descriptive; only the v2 challenger consumes them for scoring.

The Sets heatmap's on-demand history scan is replaced in both environments by two source-dated
`set_heatmap_snapshots` rows (Pokémon and Riftbound). After a published live run, the
production guard cron computes the three windows once and atomically replaces both rows;
the API reads the saved JSON only. Migration 0020 and one manual snapshot job ran on
staging 2026-10-09 and production 2026-10-14. Production's first version-4 snapshot
was initialized from the published 2026-10-13 catalog using the same writer; future
published runs use the guard cron. The policy defaults to 7D and requires at least 7% of tracked printings
to have valid comparisons and limits Riftbound
heatmap rows to the five main expansions; Pokémon set inclusion and the Sets directory are unchanged.
Pokémon's nine Gallery/Vault/Radiant Collection catalog subsets are folded into their
parent heatmap rows from individual printings, retaining the original set names for
matching-card links. Optional series grouping changes presentation only, not medians.
Cells below the active gate remain unavailable, while cells with 1–2 eligible cards
carry a small-sample warning. Selection shows the exact eligible count.
Missing 30D/90D baselines remain `N/A` in their own windows.

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
11. `app/collectr.css`;
12. `app/games.css` (Games tiles and price-comparison interactions).

New rules should use the shared tokens and component-owned styles rather than append another versioned override to a legacy stylesheet.

## Data lifecycle

1. Source clients fetch TCGCSV and approved supplemental data with bounded retries.
2. Pure normalizers create domain records and explicit rejection counts.
3. Validators enforce schema, identity, market ownership, duplicates, nullability, and minimum record counts.
4. Last-good publication replaces generated feeds only after validation succeeds.
5. Daily D1 ingestion upserts catalog/current prices, records dated observations, derives metrics/signals, and advances the published pointer only after success. The same live walk writes the per-tier set aggregates (`set_rarity_stats`, `core/normalize/rarity-stats.ts`) that the set value breakdown reads.
6. Resumable history backfill processes bounded batches and publishes signal readiness only when the complete target set finishes.
7. The eBay listing resolver (`db/ebay-ingestion.ts`) serves fresh six-hour active-ask snapshots from D1 and spends one Browse call only on a stale product requested by a real detail-page visitor. An atomic per-product lease coalesces concurrent misses, and an atomic daily counter caps interactive calls at 4,000 within the default 5,000-call allowance. Each refresh also upserts one compact aggregate into `ebay_listing_observations` for that product and UTC day; the former catalog rotation remains available only as an explicit staging ops job, and production cron never dispatches it.

See [Data ingestion](data-ingestion.md) for operations and failure behavior.

## Reliability boundaries

- A malformed refresh must not overwrite the last-good feed.
- An incomplete D1 run must not become readable as the current catalog.
- An interrupted history backfill must resume from its durable cursor.
- Missing data must not be silently inferred.
- Listing prices must not be described as sales volume.
- Rows and artwork are non-navigational; marketplace actions are explicit buttons — the TCGplayer and eBay tiles under the artwork of every history popover (`HistoryPopover` `links`; the stats grid stays market data only) and the TCGplayer, PriceCharting, and eBay buttons on the detail page (`core/domain/marketplace-links.ts` builds every outbound URL; TCGplayer links use the Impact affiliate wrapper; eBay search/sold links carry direct EPN parameters and the root Smart Links script remains a catch-all; all affiliate anchors are marked `rel="sponsored"`, and both footers carry the disclosure).
- eBay figures are active-listing asks from the Browse API (`ebay_listings`), never sales; they are labelled as asks and never enter modeled fair value or signals. The lazy detail grid reviews and retains up to 100 results from its single Browse response and paginates that cached array at five per desktop page or three per mobile page, so pagination spends no additional API calls. Matching rejects graded/bulk/proxy/cross-game/wrong-language/collector-number and sealed-type conflicts, records match confidence, and preserves delivered price, Best Offer, seller, watch, location, and listing-time metadata. Users can filter and sort the cached results without an upstream call. `ebay_listing_observations` stores one 90-day active-ask aggregate per product/day for 7/30-day ask and matched-supply movement; new, missing, and price-reduction counts compare sampled listing IDs but never infer a sale. The Browse request sends the EPN campaign/reference header so eBay returns `itemAffiliateWebUrl`; if that optional field is absent, Raw Signal adds the same direct campaign/reference parameters to `itemWebUrl`. PokemonPriceTracker remains the separate source for completed-sale data pending the removal plan in `docs/pokemonpricetracker-removal-plan-2026-09.md`.
- `worker/ebay-account-deletion.ts` owns the eBay compliance boundary: GET hashes the
  challenge, verification token, and exact endpoint URL; POST decodes the signature envelope,
  caches eBay's ECC public key for one hour, verifies SHA-1/ECDSA, and only then processes the
  deletion topic. Raw Signal currently stores no eBay account identifiers, so processing is an
  explicit no-op; any future user-linked eBay storage must be deleted at that boundary.
- Per-isolate memos front the reads every detail view repeats: the early-value sibling-set list and the peer-anchor cohort summary (`db/peer-anchors.ts`, todo Q9) are kept ten minutes per database, since both change only when a run publishes.
- Images (2026-09-04 audit: every catalog row carries a TCGplayer CDN image and none of 60 sampled URLs were broken): product art is TCGplayer's; a Pokémon card whose image fails to load — or loads as the CDN's 400×570 "no photo" placeholder — falls back once to TCGdex's scan (`core/domain/card-images.ts`, index from `scripts/sets/sync-tcgdex.mjs`); Pokémon set logos come from pokemontcg.io (`scripts/sets/sync-set-logos.mjs`, English sets only), curated Riftbound wordmarks and promo art are self-hosted under `public/images/set-art/riftbound/`, and every other set shows its highest-market eligible product's art while excluding sealed cases and display multiples; curated supplemental sealed products carry the matching TCGplayer product's image where one now exists, else the publisher's official product shot (Riot, Bandai), recorded in `scripts/scalper/supplemental-products.json` and the bundled feeds.

## Tests and release gate

Daily game snapshots use immutable UTC-date rows: auction migration 0022 and
Showdown migration 0023. Shared catalog preparation lives in `db/game-catalog.ts`;
the two daily routes lazily create today's snapshot once with a conditional insert
but only read archived dates. Browser-local attempts and compact URL-fragment
results do not create player/share server records. No new cron or paid upstream
calls. See [Daily games and sharing](daily-games-and-sharing.md).

`npm run check` is the required local and CI gate. It builds the production Worker, runs all unit/contract/characterization/critical-journey tests, lints the repository, type-checks it (`tsc --noEmit`), and runs the focused Playwright journey suite against a suite-managed local server on port 4173 (stop the :3000 dev server first: vinext refuses a second dev server for the same directory). Migrations under `drizzle/` are hand-written, contiguously numbered SQL files applied by wrangler in filename order; `drizzle-kit` is retired (its journal stopped at 0004, and the generator, its config, and the devDependency were removed on 2026-09-03). `drizzle-orm` remains for the schema types in `db/schema.ts`.
