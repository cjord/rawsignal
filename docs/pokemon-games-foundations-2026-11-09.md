# Pokémon games: catalog foundations and practice

Date: November 9, 2026. This report records a local implementation milestone, not
a staging or production release. The full expansion remains described in
[the implementation plan](pokemon-games-implementation-plan.md).

## Delivered in this batch

- Integrated the validated article branch into main at `3456d1b`, pushed main,
  and created local `codex/pokemon-games`. Unrelated TODO changes, article drafts
  and the local overlay image stay outside this work.
- **Pokémon Pool Selector:** shared era/set setup, defaulting to modern eras for
  new players. Explicit sets intersect with eras; missing/incompatible selections
  block entry instead of broadening the pool. Signed-in practice restores the
  last played scope. Guests do not adopt account saves or persist game progress.
- **Pokémon Price Showdown:** `/games/pokemon-price`, linked from Games. Reuses
  score/history, keyboard controls, artwork checks, tilt, difficulty and auto-next
  behavior. Set and exact catalog printing appear before answering; prices remain
  hidden. Pokémon rarity cohorts replace Riftbound-specific comparison rules.
- **Scoped Games Catalog:** `/api/games/[market]/catalog`, with small setup
  metadata and a separate verified selected-pool response. Hash identity covers
  market, scope, printings, source dates and prices. Positive available prices and
  English artwork-bearing singles only; unknown provenance remains unavailable.
- **Game-Only Bulk Stock:** opt-in canonical Common/Uncommon/ordinary Rare/Holo
  Rare normalization and checkpointed ingestion into a separate additive table.
  Existing market catalog, observations and analytics admission remain unchanged.
  Partial runs cannot be published as a complete game pool. Policy cannot change
  halfway through a resumed run.
- **Pokémon Practice Save:** a separate validated account document,
  `raw-signal-pokemon-showdown-practice-v1`. The existing Riftbound document shape
  and key remain unchanged. Account export/deletion/recovery use the shared
  account document allowlist. Auction/daily keys are reserved in the profile but
  are not yet accepted as account documents.

## Safety and performance boundaries

Migration `0030_game_catalog_stock.sql` is additive and tested locally only. No
remote migration, catalog refresh, environment flag, schedule or deployment was
performed. Existing production/staging ingestion callers leave `includeGameStock`
off. The reader ignores supplemental stock unless
`POKEMON_GAME_CATALOG_ENABLED=true`. It works without the new table while off.

Practice can use the existing published market catalog or complete bundled
fallback. It explicitly notes that some everyday rarities are unavailable until
bulk stock is activated. No new game invents missing prices. The preferred priced
printing remains the current normalizer's highest-positive-price subtype; a
Common may be Reverse Holofoil, which is displayed rather than relabeled Normal.

Server base catalogs cache for 60 seconds per database/assets binding and market.
Metadata caches with that base; only one prepared scope is retained per base,
coalescing repeated snapshot builds without accumulating arbitrary combinations.
The browser retains at most four public scopes for five minutes. No catalog is
stored inside the account save. Running rounds make zero additional pricing
requests; the browser check expects one metadata request and one selected-pool
request. Artwork requests are separate and bounded by the existing preflight.

A local bundled-data probe found 13,435 source rows, of which 13,410 passed game
eligibility. All-era snapshot JSON was 2,366,234 bytes; modern-era JSON was 788,479
bytes for 4,209 rows. Five Node 24 builds ranged roughly 249–668 ms for all eras
and 180–259 ms for modern eras while other checks ran on the desktop. These are
local diagnostic measurements, not Worker CPU, browser, network or live database
benchmarks. Larger scopes require staging measurement before rollout.

Bulk records reuse already fetched groups and consume the existing per-batch
record budget. They still add D1 writes and may add group refetches across cursor
slices. Before activation, measure full-run rows/reads/writes, snapshot size,
memory/CPU, cursor cost and exact market parity on staging. Do not infer that
sharing a source walk makes the expansion free.

The producer option is not yet wired into live job callers or deployment setup.
The staging trial must add an explicit producer gate, separate from the read flag,
so stock can be prepared and checked before it is exposed. An enabled stock write
failure currently fails the shared ingestion batch; its publication guard stays
closed, but market reads may consequently use the bundled fallback until recovery.
Review that availability coupling and rollback behavior before enabling production.

The sampler appends to rarity groups instead of copying growing arrays per card;
this preserves iteration/random-selection order while avoiding quadratic copying.
The existing live-ingestion runner gains one routing conditional (complexity
32→33); its broader decomposition remains outside this batch. New helper
functions must not introduce complexity warnings.

## Verification

`npm run check` passed on the final implementation:

- Production build, lint and TypeScript checks pass. Lint retains 21 existing
  complexity-warning locations, with the ingestion increment explained above.
- 726 unit tests: 725 passed, one existing skip, zero failures. Coverage includes
  scoped/hash identity, missing sources/prices, exact printing, English eligibility,
  opt-in bulk, market-row/price-observation parity, interrupted ingestion, missing
  migration while disabled and separate account validation.
- All 190 Chromium browser tests pass, including five new Pokémon journeys and
  unchanged Riftbound games, accounts, articles and market behavior. The Games
  stability check now pins five tiles and explicitly includes the Pokémon link;
  its guest/member mounting assertions remain intact.
- The new delayed-metadata check caught and fixed a nine-pixel mobile shift. It
  now holds the Start control within two pixels at 1440/390 widths, with both bulk
  availability states and a full source timestamp. New artwork bounds are checked
  in both themes and widths; the collage's flex styling cannot be overridden by
  the generic game-art rule.
- Reviewed Pokémon selector, play and Games-tile captures in dark/light at desktop
  and mobile widths, with automated reduced-motion checks. Representative existing
  Singles/Sealed controls, details and responsive views also pass the gate.

Browser checks use mocked market/account responses and emulated mobile Chromium;
they are not live Cloudflare, physical-device, Safari or upstream ingestion
acceptance. The older local database emits existing detail-history-column warnings
in market journeys, which exercise the feed fallback; no persistent local or remote
database was migrated to silence them. Benchmark output and test logs remain
ignored under `outputs/` and `test-results/`.

## Remaining sequence

1. Authorize and run a bounded staging bulk admission trial: backup, compatible
   deployment, additive migration, measured ingestion/parity, then opt-in reader
   activation. No staging cron or automatic production rollout.
2. Pokémon Showdown daily: market-aware immutable manifests, mostly era themes
   with occasional single-set spotlights,
   UTC expiry, independent attempts and market/version-aware result sharing.
3. Pokémon Auction House: incremental shared policy boundaries, scope-aware lot
   generation, investigation mappings, Pokémon rival names/art and simulated bids.
   Validate feasible pool sizes, exact retained drafts and bounded save sizes.
4. Auction daily/community: independent five-auction economy, idempotent rewards,
   opt-in profiles/showcases/leaderboards, account isolation/recovery/deletion and
   legacy-link compatibility.
5. Release acceptance for each cohesive batch, with explicit push/deployment/data
   authorization. Neither daily games nor Pokémon auctions are represented as
   implemented or linked as playable in this milestone.
