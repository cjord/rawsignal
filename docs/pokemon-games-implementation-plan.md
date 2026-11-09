# Pokémon games — implementation plan

Planning date: November 7, 2026 (America/New_York). Implementation began November 9
on `codex/pokemon-games`, after the article branch was integrated into main. The
first batches cover catalog foundations and Showdown practice/daily challenges,
now released on staging; auctions remain later work. See [the implementation report](pokemon-games-foundations-2026-11-09.md)
for evidence and activation boundaries. GitHub Issues remains authoritative for
task status; this document records design and decisions.

The [November 9 games review](pokemon-games-review-2026-11-09.md) records the
practice staging release, daily implementation, reader correction, simulation
findings and artwork choices. It does not activate bulk ingestion or release
Pokémon auctions.

The [bulk admission and artwork follow-up](pokemon-bulk-and-artwork-2026-11-09.md)
records the selected blue covers, separate default-off producer/reader controls,
four-set read-only impact audit and the required staging activation gate.

## Agreed direction

- **Pokémon Price Showdown** uses the current price-comparison game: choose the
  most valuable card. It is not a Pokémon-name identification quiz.
- Practice lets players select eras and sets before playing.
- **Pokémon Auction House** has separate cash, inventory, showcase, statistics,
  progress, daily reward and community rankings. Account identity/preferences are shared.
- Reuse NPC personality strategies with new Pokémon-themed collector/trainer names
  and portraits. Display names must not determine strategy behavior.
- Both games have independent Pokémon daily attempts, resetting at midnight UTC.
- Showdown: ten Normal rounds and ten Hard rounds, with two/three choices.
- Auction daily: separate $2,500 bankroll, three free then two $50 paid auctions,
  fixed 10% automatic sale fee after each auction, and 25% of positive net profit
  credited to the Pokémon wallet after all five auctions; no reward cap. Existing
  expiry, resume, unable-to-pay-entry and no-reward-for-incomplete rules carry over.
- Keep the site's established surfaces, controls, responsive behavior and motion
  preferences. Gameplay card pools remain separate from real owned Collections.

## Confirmed refinements

The user selected all of the following after the first plan review:

1. Add real bulk-card catalog support before Pokémon auctions.
2. Daily Showdown has one shared rotating era/set theme each UTC date.
3. Normal auctions allow player-selected eras/sets before entry.
4. Both games initially use English raw singles and the supported catalog printing /
   Near Mint price basis. Japanese, graded and sealed pools are excluded.
5. Showdown displays set and printing before an answer; prices remain hidden.
6. Entry tiers are **Pewter Auction House** (free) and **Celadon Auction House**
   ($50 virtual entry fee, subject to the planned economy validation).
7. Bulk-card coverage feeds games first. Preserve existing market-board coverage,
   history, metrics, signals and set statistics; do not automatically expose bulk
   sections on market pages.
8. Daily Showdown rotates mostly broad era themes, with occasional single-set
   spotlights. Every visitor receives the same assigned scope for a given UTC date.

Daily auction scope remains fixed in the shared five-auction manifest; personal
filters apply to normal auctions. This preserves the already agreed same-lineup
challenge contract. Pokémon game progress remains separate from Riftbound.

## Findings from the current code and data

The pure sampler already accepts a game argument (`priceGamePool`), but its rarity
adjacency order is Riftbound-specific. The page/data loader, practice save key and
daily wrapper also assume Riftbound. The score reducer, round rendering, artwork
checks, history, tilt, keyboard behavior and result presentation can be shared.

The auction engine is spread across cohesive domain modules and shared UI, but
classification, investigations, generation weights, priors, NPC name comparisons,
guide text, catalog cache, routes and account keys encode Riftbound assumptions.
Copying that directory would duplicate every later fix and preserve those assumptions.

A read-only production catalog query at **2026-11-08 01:38 UTC** found **14,341**
published Pokémon single records, including **798 Japanese-promos section records**.
Modern English bulk is not covered: `pokemonSection` excludes modern Common and
Uncommon rarities (and ordinary rare categories outside its supported list).
Vintage includes everyday rarities, which must not be mistaken for modern coverage.
These are catalog coverage counts, not a game-eligible count or a price forecast.

Bundled fallback coverage differs: the inspected local files contain 13,435 Pokémon
records and no `japanese-promos.json`. This is not evidence of a production failure,
but a new game must not assume every registered fallback feed exists or treat a
partial fallback as a complete catalog.

Daily tables currently use **date alone** as the key. Auction public profiles use
**one profile per user**, with projection triggers hard-coded to the Riftbound save.
Share payloads distinguish auction/showdown but not Pokémon/Riftbound. Catalog
memoization also assumes one market. All require explicit game isolation.

Auction draft saves may temporarily retain the whole preparation pool. Pokémon's
larger catalog can exceed the existing 1MB account document limit. Retain bounded
draft candidates/exact prepared lots, not the entire catalog, and test recovery
before offering Pokémon auctions. Do not solve this by silently raising save limits.

## Reuse versus new code

| Area | Reuse | Add or adapt |
|---|---|---|
| Showdown | scoring/reducer, choices, history, difficulty controls, artwork preflight, auto-advance | market/scope adapter, Pokémon rarity cohorts and era/set setup |
| Auction rounds | bid locking, deadlines, buyout thresholds, settlement, loss shares, reveals, audio | explicit market rules passed at domain boundaries |
| Auction screens | hub, wallet, inventory tools, showcase editor, responsive grids, popups, scrolling backdrop | game context for route roots, labels, art, catalogs and storage |
| Collection generation | seeded draws, lot themes, copy controls and artwork retry machinery | Pokémon classification, weights, theme policies and duplicate limits |
| Investigations | count/mark/identity/price effects, follow-up selection, delayed reveals | Pokémon predicates, labels, descriptions, costs and structured facts |
| NPCs | strategy behaviors, investigation schedule, noise, previous-round influence | stable role IDs, Pokémon roster/portraits, mapped investigations and priors |
| Daily games | UTC rules, deterministic snapshots, conditional insert, resume/expiry, rewards | game-aware manifest identity, storage and theme schedule |
| Accounts/community | auth, conflict/recovery handling, username, visibility controls, ranking UI/moderation | separate document keys, projections and opt-in per game |
| Sharing | dialog, clipboard fallback, emoji grid, result reconstruction | explicit market/version and legacy Riftbound decoding |

Only small route/metadata files, configuration, roster content and artwork should
be game-specific copies. Do not fork reducers, whole UI trees or database services.
Prefer explicit settings at established boundaries over a large speculative game framework.

## Proposed architecture

### Game Rules Profiles

Introduce a pure typed market identifier (`riftbound | pokemon`) and small rules
profiles for catalog eligibility, classification, generator policies, investigations,
NPC roles and route/storage identity. Keep React context in `app/` and pure rules
in `core/`. Existing Riftbound calls retain their explicit legacy behavior while
adapters are introduced incrementally; no global find-and-replace.

Pin rules/roster versions in new auctions and daily snapshots. Display names,
portraits, rarity labels and investigation wording must not change archived outcomes.
Preserve existing saved IDs, clue parsers and old share links. New investigation
effects should expose typed counts/category values/reveal facts so NPC valuation
does not have to extract facts from localized human-readable sentences.

### Games Catalog and scope

Build on the version-aware snapshot/cache work. Key memory/edge/browser caches by
market and normalized scope; include the scope and market in version identity.
Bound cache entries/payloads to prevent arbitrary set combinations accumulating in
memory. No Pokémon data may be returned from a Riftbound cache entry or vice versa.

For practice, use the existing era registry and filter components, with a searchable
set picker. Respect the intersection of selected eras/sets; show eligible-card
counts and explain insufficient/empty pools. Starting or changing scope freezes a
new session; it must not revive a score from a different pool. Keep settings stable
during hydration. Mark ambiguous cross-era promo groups explicitly rather than
assuming a group's creation year is every card's release year. Missing dates must
not silently become Scarlet & Violet in the game setup.

Use only available, positive finite prices for exact supported printings. Exclude
missing/invalid artwork and unresolved language/printing ambiguity. Preserve source
and snapshot dates, including stale-data notices. No condition/graded premiums or
missing bulk prices are guessed. Normal rounds make zero additional pricing calls.

Real bulk support is required before auctions. Extend the canonical normalizer/ingestion once;
do not invent game-only prices or start another independent upstream importer.
Keep market-board defaults unchanged and explicitly decide filter visibility.
Measure added rows, bundle size, D1 reads/writes, history-target and metrics workload
before enabling it. Do not automatically start graded, detail or full historical
enrichment for every added bulk card. Preserve last-good publication/readiness gates.

### Bulk Data Impact Gate

Current normalization chooses one preferred priced printing per product (the
highest available positive market-price subtype). The first release keeps that
existing catalog contract and labels the actual printing. New Common entries may
therefore be Reverse Holofoil rather than Normal; do not describe them as ordinary
non-foil bulk or substitute a cheaper finish's price. A complete multi-printing
catalog is a separate architecture decision, not implied by adding bulk coverage.

Before enabling expanded ingestion, explicitly separate gameplay catalog coverage
from dashboard analytics eligibility. Existing market-board defaults, market indexes,
Hot Buy/Sell populations, set counts, pack EV and ingestion workloads must be checked
for unintended changes when thousands of low-price cards appear. Do not merely add
new sections to every all-rarities query. Prefer a deliberate catalog/analytics
inclusion boundary, reusing the canonical source and stored prices, and report the
impact before release. Keep uncurated pull-rate calculations unavailable and retain
priced/unpriced/source provenance rules. Benchmark CPU, D1 reads/writes, feed size
and game payload size before selecting the final storage/query approach.

### Pokémon Pool Selector

Reuse the same setup component in Showdown practice and normal Auction House,
with separate remembered selections for each game mode. It uses the established
filter controls: multi-select eras and searchable multi-select sets. An empty set
selection means all sets in the explicitly selected eras; explicit sets intersect
with the chosen eras. Do not silently widen the pool when a set disappears or a
filter becomes invalid. Explain missing/incompatible sets and let the user correct it.

Show eligible printing counts, availability and source freshness before starting.
Fetch small scope metadata for setup, then the selected versioned pool; do not load
all Pokémon artwork or a full catalog just to display the selector. Reserve layout
space while counts load. A fresh page starts in setup, not in an automatically
running game. Set/printing labels stay visible during Showdown, with prices hidden.

Changing practice scope starts a fresh score; changing an active auction's scope
is prohibited. Freeze the normalized selection and catalog identity into a new
auction draft **before** its introduction. Reopening/cancelling retains the same
scope, lot and prices; changing filters must not overwrite or silently reroll an
existing pending entry. At first release, retain a pending entry until played or
explicitly abandoned, with any proposed anti-reroll policy reviewed before adding
new fees or locks. Daily pages show their assigned scope without personal controls.

### Auction Scope Calibration

Collection themes operate only within the player's selected pool. A Set Builder's
Binder may focus on one selected set; a nostalgia theme must not pull an unselected
older set. Choose only themes compatible with the pool, preserving their stated
contents. If none fit, explain it rather than changing the player's filters.

Calculate feasible lot capacity from eligible printings and copy policies before
entry. Offer an honest feasible card-count range and disable entry when the pool
cannot support the tier's minimum. Do not fill missing slots with unpriced cards,
exceed copy limits or silently add another era. Check that a paid tier can actually
apply its premium weighting; a different image and a fee alone are not a higher-
quality auction. Scan options may still return no information, as agreed.

NPC priors must use the same market, exact selected scope, theme and admission
weights as generation, excluding unavailable stock. Freeze priors with the draft.
They cannot use a whole-catalog average for a single-set auction, inspect its hidden
lot total, or see current sealed bids. Catalog refreshes cannot change an active
auction's prior. Guide odds should explain conditional reweighting when categories
are unavailable in the selected pool; no SIR/other rarity can appear outside it.

Extend the simulation matrix to modern/vintage selections, one-set selections,
low-price bulk-heavy pools, expensive chase-heavy pools, rare-category gaps and the
smallest eligible pools. Review opening bids, early buyouts, loss-share farming and
expected player costs before setting final tier prices/weights. Do not introduce
scope-dependent entry fees without a further product decision.

Because normal players may select different pools, lifetime net-profit rankings
are casual/unverified and not equal-difficulty competitions. Preserve scope in run
and share details. A future competitive ranking should use fixed daily lineups;
do not quietly add a new leaderboard or claim fair competitive scoring here.

### Pokémon auction policies

Use Pokémon categories/treatments as actual metadata, not substitutions such as
“Signature = SIR” or “Epic = Double Rare.” Older and newer rarity systems need
explicit mappings; unknowns stay unknown/other. Rarity does not guarantee value.
Generation admission bands may group treatments for gameplay, while displaying the
card's original rarity and printing. They are not real booster pull rates.

Candidate themes: Shop Clear-Out, League Player's Collection, Set Builder's Binder,
Illustration Binder, Nostalgia Binder and Premium Collector's Binder. They can
adapt the existing theme mechanism; a deck-style theme must not claim to be a
verified legal deck. A nostalgia lot must contain genuinely priced older cards,
not substituted modern prices. Themes must honor the selected scope and retain understandable collection identities.

Use the existing four one-minute rounds, buyout thresholds, 10% fee and reveal
mechanics initially. Existing 25–90/free and 50–130/paid sizes, $2,500 normal start
cash and $50 paid entry are **starting proposals for simulation**, not calibrated
Pokémon commitments. Prices remain uncapped; rare high-value admission needs a
separate weighting policy, not a hidden valuation cap. Copy limits need Pokémon-
appropriate gameplay settings and a collector-theme exception, rather than blindly
retaining Riftbound's three-copy playset assumption.

Investigations should share effects but have market-specific categories:

- Small/Large Price Scan; random rarity markers; identity-only peek.
- Common/Uncommon counts and Everyday Valuation, if those cards are in the pool.
- Illustration/Gallery markers or peeks, using explicit supported classifications.
- Premium/chase scans with a disclosed Pokémon eligibility definition.
- A grouped Rarity Census that does not itemize every premium subtype too cheaply.
- Top-card rarity/location, Top-Three Price Peek, Follow-Up Inspection, set/duplicate
  information and Delayed Gratification using existing effects.

Offer random choices even when they return zero information, as in the current
rules. One paid investigation per round; public information is separate. Do not
silently grant NPCs automatic hidden samples. Price proposed investigations by
their measured information benefit, not by renaming a Riftbound option.

### Pokémon rivals and balance

Separate stable strategy IDs from display names. Current special behavior checks
names such as The Closer and The Trust Fund Kid; cosmetic renaming alone would break it.
Map investigation preferences to semantic roles available in each market.

Possible display roster: Card Shop Owner (Dealer), Binder Curator (Collector),
Trade-Night Regular (Opportunist), Market Researcher (Analyst), Pack Chaser (Gambler),
Bargain Hunter, Hype Follower, Set Archivist, League Regular (Playset Builder),
Careful Buyer (Skeptic), Late Bidder (Closer), and a rare Big Spender guest.
These are naming suggestions; artwork should be a consistent new set of original
trainer/collector portraits, with reusable per-strategy behavior.

Derive catalog priors from Pokémon's actual eligible pool and generation weights.
Keep speculation declining across rounds, evidence-driven personal valuations,
earlier public-bid influence, personality variation and occasional overpayment.
Never use unrevealed lot totals or current sealed rival bids. Do not copy a $100/$300
opening target from Riftbound without testing the resulting Pokémon economy.

Run a fixed, reproducible simulation suite (proposed 5,000 free and 5,000 paid lots),
reporting by NPC and collection theme:

- opening bid mean/median and percentile spread;
- bid versus gross collection value and after-fee value, separately;
- early-buyout rates by round, passes, NPC overpayment/loss shares;
- final winning-bid/value distribution and investigation usefulness/empty rates;
- outcomes for simple player policies restricted to their actual disclosed clues.

Agree targets after the baseline, then adjust and rerun the same seeds. Do not tune
on a few selected lots or guarantee a player profit. Rare-guest sample counts and
tail risk should be included, not hidden by an overall average.

### Daily Snapshot Namespaces

Proposed identity: market + challenge kind + UTC date, plus a pinned schema/rules
version and frozen catalog/source scope inside the manifest. Select one shared
Showdown era/set theme per date. Pokémon normal/hard attempts remain independent of all
Riftbound attempts; practice filters never customize a public daily snapshot.

Use an additive shared v2 manifest table and a repository adapter for Pokémon first,
leaving current Riftbound archive tables untouched. This avoids rebuilding old
date-primary-key tables during launch. Future games can use the same v2 table;
legacy routing is centralized, not duplicated throughout pages. A later consolidation
would require a separate hash/parity-verified migration.

First use freezes one verified lineup and returns the winner of a concurrent insert.
Historical reads never regenerate from current prices. Verify selected artwork with
bounded/deduplicated checks; measure cold initialization CPU/fetch budgets for the
larger pool. If necessary, checkpoint preparation and publish only when complete.
Do not add a staging cron or an always-running producer just to make daily challenges.

Pokémon daily Showdown requires at least 60 eligible cards in its assigned theme
and chooses 50 distinct cards across both modes. Normal and Hard therefore do not
spoil each other's exact prices. Artwork replacements stay within that scope;
failure leaves the attempt unstarted. Existing Riftbound archives and selection
rules are unchanged.

### Pokémon Save and Community Namespaces

Use separate typed Pokémon keys for auction progress, Showdown practice, Showdown
daily and market-specific appearance/scope settings. Shared account preferences
remain shared where intended. Validate game identity and bound document sizes.
Extend recovery, export, deletion, sync-conflict handling and admin health views.
Do not import existing guest progress or migrate Riftbound money into Pokémon.

Retain exact prepared draft lots and bounded replacement candidates. Cancelling or
reloading cannot reroll for a more profitable lot, even if market prices refresh or
another device resumes. Do not persist a full Pokémon catalog in game progress.

Use additive, market-aware community projection/moderation tables for Pokémon,
through the shared services. Preserve existing Riftbound profile IDs, ranking
triggers, visibility and moderation. Public username comes from the same account;
showcase and leaderboard opt-ins remain separate and private by default per game.
Keep public inventory/wallet details private; show only selected showcase cards and
approved statistics. Enforce route/game matching, account ownership and moderation.
Shared write/read abuse budgets must not be bypassable by switching games.

Rank Pokémon community standings by net auction profit and public showcases by
showcase value, matching the existing UI. Continue to label client-calculated
standings/results unverified. This release is NPC play, not multiplayer auctions
or server-verified competitive scoring.

### Share Result Versions

Add explicit market identity to a new compact share version. Decode existing v1
links as Riftbound without changing their archived results. Match link market,
snapshot date and rules before reconstructing cards, opponents or rewards. Preserve
copyable emoji text, rich result links, spoiler warnings and unavailable-archive
behavior. Viewing a result never credits a reward or mutates progress.

Apply the same separation to frozen showcase links and account public-profile URLs.
Never embed the rest of an inventory, private notes or wallet into a link.

## Routes and visual direction

- `/games/pokemon-price` and `/games/pokemon-price/daily`.
- `/games/pokemon-auction`, with matching daily, inventory, showcase, profile,
  guide, leaderboard, showcases and public-player routes.
- Keep existing Riftbound routes and legacy public API aliases working.
- Share route handlers/services under an explicit validated game parameter;
  thin entry pages provide metadata and configuration.
- Add game-specific normal/daily tiles to Games. Prefix daily titles with the
  game so the four challenges are not ambiguous. Avoid redesigning the whole
  directory just to add these entries.
- Reuse the stable auction shell, three-row backdrop, loading reservations,
  navigation, notifications and color tokens. New Pokémon cards, card backs,
  entry art, daily art and rival portraits provide the game identity; no global
  palette replacement or extra image/layout loading jumps.

## Implementation batches and gates

0. **Close the current branch boundary.** Article work is on `codex/article-editor`.
   Before new game feature code, review/merge the stable article work and branch
   from current main (`codex/pokemon-games`). Merge/remote operations need the
   user's explicit instruction; preserve unrelated TODO edits, drafts and image.
   The unavailable live article admin check remains recorded, not silently passed.
1. **Catalog eligibility and safety.** Audit English sets/printings,
   add real bulk support, measure payload/ingestion costs and preserve market
   defaults. Introduce scoped catalog contracts and bounded preparation saves.
2. **Pokémon Showdown practice.** Share presentation/reducer, implement era/set
   setup, Pokémon matching rules, printing clarity and isolated practice progress.
   Validate this smaller surface before touching auction balance.
3. **Pokémon Showdown daily/sharing.** Add v2 manifest storage, shared theme schedule,
   immutable artwork-verified lineups, separate attempts and v2 share decoding.
4. **Pokémon Auction House.** Introduce market policy boundaries incrementally;
   add generation, investigations, new roster/assets and simulation-reviewed balance.
   Reuse settlement, timers, inventory/showcase tools and the existing shell.
5. **Auction daily and community parity.** Add five-auction runs, exact one-time
   rewards, exports/recovery/deletion, opt-in profiles, leaderboards, showcases,
   moderation and rich result sharing with explicit Pokémon identity.
6. **Release acceptance.** Run the full gate and stage each useful cohesive batch
   when deployment is separately authorized. Back up before remote migrations;
   deploy compatible readers before applying additive schema changes, then activate
   the new routes only when the required storage/data is ready. Production needs
   its own explicit release authorization.

Acceptance includes legacy Riftbound saves and v1 links, concurrent first visitors,
UTC midnight, broken art, catalogue refresh during play, cancelled/resumed drafts,
new market isolation, missing prices, empty selected sets, duplicate/reverse-holo
ambiguity, save-size bounds, account switching/conflicts/deletion, one-time rewards,
private/hidden profiles and no per-round catalog requests. Check both games at
desktop/mobile widths in dark/light and reduced motion. Preserve benchmark evidence
for catalog requests, payload size, layout movement and cold daily generation.

## Out of scope for this first expansion

Real-money trading, multiplayer, graded/condition simulation, fictional bulk prices,
real pack-odds claims, automatic article schedules, cross-game wallet transfers,
verified competitive leaderboards and a wholesale rewrite of the existing games.
