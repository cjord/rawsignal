# To-do and backlog — plan of record

Open UI, platform, data, and signal-model work, grouped by area, each item carrying the
decision context it needs. **Completed items — with their build notes, dates, and
resolved decisions — live in `docs/todo-completed.md`** (split out 2026-09-03 so this
file holds only open work). When something ships, move its entry there with its build
notes; add new items to the matching section here.

Related documents: `docs/roadmap.md` (deferred infra work), `docs/model-gaps.md`
(signal-model gaps register + review calendar), `docs/cloudflare-cutover.md` (D1
runbook), `docs/todo-completed.md` (shipped items and the resolved decision log).

## Current priorities (proposed 2026-09-03 — confirm at review)

Everything through P7, waves 12–19 of the refactor program, J2 phase 1, and the R1–R4
ingestion fixes are in production (2026-09-10, Worker version `9f30fee8`). What remains
falls into three tiers:

1. **Standing commitments with dates.** The October model-verification review (Scheduled
   tasks below) is the gate for promoting v2.2; it needs the **model-version stamp in
   `signal_history`** (§P governance TODO) built *before* the promotion, so that stamp is
   the one piece of engineering the calendar forces. Delta Reign (2026-11-06) needs only
   follow-through: regenerate `RELEASE_SETTLE` cells at launch, watch the presale EVEs.
2. **Small, high-value fixes that are unblocked today:** §I.2 view-mode persistence across
   list pages; §I.3 the sealed sale-scenario rework (the panel has been hidden since
   2026-08-28 — a visible hole in scalper mode); §K1 the buy+sell collision treatment
   (needs a "very close" definition first); §L4/§M13 the retailer-exclusive classifier
   audit; §M11 the per-run work-list cache (free tidy-up).
3. **Larger phases, in recommended order:** §L2 One Piece curated chase singles (the one
   catalog expansion that fits the cron budget and unlocks OP import matching); §O2's
   Browse-API listings grid (implemented on `EnhancementTrial`; validated activation pending);
   §I.1 large-grid phone treatment; §J1 sets sort control (after usage data); §M7/§M8
   category registry + game-check widening (do together with the next new game).

Deferred by decision, revisit only on trigger: §L1 JP curated singles (priciest
expansion after MTG), §L3 MTG sealed, §M9/§M10 (pending MTG), §P8 tournament feature
and the character-level cohort rung (both at the December 3-month review), the 90-day /
1-year horizon models (queued behind the 30-day goal), F1(3) per-product summary chunks
(parked pending cold-start numbers), and the deferred research items (character priors,
pull-difficulty adjustments, execution-aware net returns).

## Scheduled tasks

The calendar of record. Dates are absolute; the model-review cadence and refit policy
are defined in `docs/model-gaps.md` → "Review calendar" and "Update policy".

| When | Task | Detail / where |
|---|---|---|
| **First week of October 2026 — THE scheduled task** | Model-verification review, month 1 | Shadow scoreboard (`npm run shadow:scoreboard` on a fresh backup) → first 30-day verdict → **v2.2 promotion decision** (harness verdict + shadow agreement; v1 becomes the reverse shadow); stamp the model version into `signal_history`; sanity-check the ≥20-sales bump and 5/30D liquidity floor on the first ~30 days of real sales data; EVE vs actual for the presale products already served; regime-mix tripwire (~10% Falling / ~41% Overextended baseline); data health (sales fill rate, cohort_stats coverage, ingestion completeness). Plus the tier-1 data refresh: append the month to the archive, rebuild the local DBs, re-validate with frozen parameters. |
| Before that review | Build the model-version stamp | §P governance TODO — prerequisite for a clean promotion; small change to the batch writer + `signal_history`. |
| Late October 2026 (Delta Reign presale → 2026-11-06 release) | Launch follow-through | Regenerate `RELEASE_SETTLE` cells for the launch; confirm ME06 era mapping still resolves; check the Pokémon 30th product line's shape against the validation blocklist when it lists (`docs/model-gaps.md` P7 caveat). |
| First week of November 2026 | Model review, month 2 | Promoted-model live metrics vs backtest bands; Delta Reign day-0/30 EVE vs actual; 90-day horizon feature study (fwd90 deciles) if capacity allows; second sales-data checkpoint; tier-1 data refresh. |
| First week of December 2026 (3-month review) | Model review, month 3 | ~90 days of sales history → empirically recalibrate the liquidity floor and sales bump; first quarterly walk-forward re-run on the extended archive (append-only, same protocol); revisit §P8 tournament feasibility and the character-level cohort rung; tier-1 data refresh. |
| Monthly thereafter (first week) | Model review + tier-1 data refresh | Evaluate always; refit quarterly at most or on triggers (live hit rate below band 4+ weeks; a baseline beating the served model; material regime-mix shift). |
| Quarterly (from March 2027) | Walk-forward re-run; threshold re-tuning only if a trigger fired | Annual: reassess 1-year model viability as independent windows accumulate. |
| Next Cloudflare billing cycle after 2026-08-31 | Confirm the D1 rows-written meter collapsed | M1 delta-only writes should cut history writes ~97%; watch `pointsWritten` in `history-backfill` runs (`docs/ingestion-scaling.md`). |

## Open items index

§I queued visual-pass items · §J sets view · §K signal display · §L catalog coverage
gaps · §M ingestion scaling (M7–M13 open; M1–M6 shipped) · §O monetization · §P
signal-model program (P8 + governance TODOs; P1–P7 shipped — see the completed doc) · §Q
code-review follow-ups (Q1–Q5 and Q8 open; Q6/Q7/Q9 shipped in part) · §R production
ingestion (R4 fix 3 and R5 open; R1–R3 shipped — see the completed doc) · §S crawler and
bot traffic (S2 measurement due).

## I. Queued from the staging visual pass (2026-08-28)

Deferred to a later phase at the user's direction:

1. **Large image view on mobile** — the large-card grid needs a real phone treatment, and
   the tap model currently conflicts: tapping a tile is expected to both reveal the history
   popup and navigate to the single card/sealed detail page. Decide one tap model (e.g.
   first tap = popup, explicit control = navigate) and apply it consistently.
   **Tap model decided 2026-09-01 → planned as §N1** (tap = popup toggle, explicit
   "View card" button in the popup navigates); the large-grid phone treatment itself
   stays queued here.
2. **View mode persists across list pages** — switching between Leaderboard / Hot Buys /
   Hot Sells and Singles/Sealed should keep the selected view mode (large/medium/text/full)
   instead of resetting per surface. Likely a localStorage device preference layered under
   the URL param (an explicit URL view still wins on shared links).
3. **Sealed-detail sale scenario rework** (panel hidden 2026-08-28 pending this): move the
   Sale Scenario section down to sit directly above the "Product overview" (Product
   Details) section; render it **only in scalper mode**; and let a **purchase price be
   entered manually** to replace the MSRP-derived total cost in the profit math.

## J. Sets view backlog (added 2026-08-29)

**J1. Sort control on `/sets` (user-deferred at planning, 2026-08-29).** A control on the
sets browse page reordering set tiles WITHIN their era/category groups by release date
(default), 30D momentum, or tracked value — groups keep their order, tiles re-rank
inside them, so "which Scarlet & Violet set is moving" is answerable without scanning.
Excluded from the initial build; revisit after the browse page has real usage.

**J2. "Where the value sits" — per-rarity pack value breakdown (phase 1 shipped 2026-09-05, `d7de3b9`; phase 2 open).**
2026-09-17 local implementation: source-backed profiles for 198 catalog sets, 24 set-specific
odds overlays, corrected replacement/Signature math, ordinary-printing aggregate versioning,
and the shared set/sealed breakdown panel. See `docs/pack-profiles-2026-09.md` for activation
and research gaps. Deployment, the MSRP slider and custom rates remain outstanding.
Replace the single Pack EV number with a per-rarity breakdown for every market: per-pack
value and share bar per rarity, CHASE badges, "chase prints are X% of EV", a purchase-price
slider from MSRP to market, and the bulk tiers valued from a new `set_rarity_stats`
aggregate the live ingestion can write from the TCGCSV group files it already downloads
(commons/uncommons need no catalog rows). Pack composition (`perPack`) joins `packsPerHit`
in `pull-rates.json`, curated only. Plan, model, costs, and phases:
`docs/set-value-breakdown-plan-2026-09.md`. Phase 1 — the `set_rarity_stats` aggregate
(migration 0017), the breakdown model, and `perPack` tables with Pokémon era defaults — is in
production; no page renders it yet. Phase 2 (panel, MSRP↔market slider, optional custom rates)
needs a packs-per-product table and per-pack MSRP where the pack product has none.

## K. Signal display (added 2026-08-30)

**K1. Handle a card/sealed product that carries a Hot Buy and a Hot Sell signal at once
(added 2026-08-30).** When a product qualifies for *both* boards at the same strictness —
its price sits close to both its 30-day low and its 30-day high, i.e. a tight recent range
with conflicting momentum — the current UI would show whichever side the surface asked for
(e.g. the import table's Hold lens shows the buy, the Hot Sells lens shows the sell) and the
two never reconcile. Decide and build a distinct treatment for this collision: e.g. a
combined "Conflicted / range-bound" badge, showing both sides side by side, or a tie-break
rule (stronger score wins, with the loser noted). Applies anywhere signals render — the
Collectr import table, the Hot Buy/Hot Sell boards, and single-card / sealed detail pages.
Needs a definition of "very close together" (score delta and/or distance-to-cutoff
threshold) before implementation.

## L. Catalog coverage gaps (surfaced by the Collectr import, 2026-08-31)

2026-09-18 local implementation: Riftbound `metal-promos` includes priced and unpriced
Metal / Best Of / Prize Wall printings. Null prices stay unavailable; eBay access and
affiliate links remain active with strict promo-treatment matching. Scoped fallback
refresh: 717 Riftbound cards, including 68 metal promos (47 without market prices).
No production deployment yet; after release the next live walk adds the D1 records.
Follow-up local expansion: 1,333 Riftbound cards after the user's explicit exclusions,
including English commons/uncommons, collectible promos, alt-art runes and Lunar
Irelia (Simplified Chinese). 169 catalog cards excluded by policy; details and source
limitations in `docs/riftbound-coverage-2026-09.md`. Still not deployed.

Diagnosed from the @srikaskrr test import: several unmatched items are real products we
simply don't ingest. Matching is a TCGplayer product-id join, and a **name fallback now
runs on the showcase path too** (commit adding sealed/singles name-fallback), which catches
items we hold under a different id — but it can only match against catalogs we actually
ingest. These are ingestion-scope gaps to close (each is a TCGCSV category we don't pull):

**L1. Japanese sealed Pokémon — MEASURED 2026-08-31, option B IMPLEMENTED.** We tracked
**zero** JP sealed (all ~2,692 Pokémon sealed rows were English ids); JP *singles* are
tracked only as the 22 promo groups of category 85 (~1,184 priced "Japanese Promos").
Collectr lists JP boxes under its own synthetic ids (10,000,000+), but they DO exist on
TCGplayer category 85 — e.g. **Eevee Heroes Booster Box = TCGplayer 565351** (S6a,
publishedOn 2021-05-28); VSTAR Universe (S12a 2022), Shiny Treasure ex (SV4a 2023),
Pokémon 151 JP (SV2a 2023). Measured: category 85 has 456 groups (434 non-promo ≈
18,500 products) but only **~254 sealed products (~224 priced, 1.4% yield)** — each JP
set carries just booster box/pack + occasional premium trainer box. Tick cost scales
with group count, not products, so the options were: A) full 434-group walk = +868
req/day, +~41 cron ticks for ~254 keeps; **B) modern cutoff publishedOn ≥ 2020 (140
groups, SWSH era on — covers every Collectr miss) = +280 req/day, +~15 ticks, ~150–180
sealed — CHOSEN**; C) sealed-group cache (~+11 ticks, full coverage, new plumbing) —
available later if completeness matters. JP sealed stays `game:"pokemon"` (no
migration) and joins the English Pokémon sealed catalog/feed. JP promo groups remain
singles-only (their ~6 sealed-shaped items stay out, unchanged). Full JP singles
(~15,800 priced) would exceed the entire current singles catalog and blow the cron
budget (+~263 history ticks — infeasible); curated JP chase rarities (AR/SAR/SR/UR,
~3–4k records, +~80–105 ticks/day) is the only viable singles shape — unscheduled, and
the priciest expansion on the board after MTG.

**L2. One Piece — full sealed + singles. Sealed APPROVED 2026-08-31; singles deferred
to its own phase.** OP sealed is only ~23 curated products today; the main English OP
**booster boxes** are missing (e.g. "Carrying On His Will Booster Box" = TCGplayer 628352).
Measured (see `docs/sealed-market-expansion.md`): cat 68 = 87 groups, 7,518 products,
~420 sealed → +174 TCGCSV requests/day, +~400 history calls/day, +~15 cron ticks, **no
migration** (the game check and onepiece⇒sealed check already fit). Plan: `sealedOnly`
work entries in the live walk + `isOnePieceSealedProduct` normalizer + Bandai-derived
MSRP table + full `sealed-onepiece.json` sync; downstream (SealedGame union, metrics
index, sealed-page scope, Collectr import matching) is already plumbed.
OP **singles** are still untracked (0 rows) — promos/parallels like Monkey.D.Luffy
OP05-060 (557296), Boa Hancock OP07-038 (623618), Otama OP07-022 (545804) can never
match. Fetch cost of singles is zero (same group payloads), but all singles = +7,100
records and +~210 cron ticks/day (near the 720 cap) plus a catalog_products table
rebuild (drop the onepiece⇒sealed check) and a full new singles market surface (rarity
taxonomy, sections, market tab, enrichment, metrics, signals).
**Singles plan of record (decided 2026-08-31): curated chase-rarity sections** — Alt
Art / Manga / SEC / SP / parallels only (~1.5–2.5k records, +~50–80 ticks/day), the same
section model Pokémon singles use. Scheduled as its own phase; not started.
*Sealed IMPLEMENTED 2026-08-31:* category-68 `tcgcsv-sealed` walk entries in
`db/live-ingestion.ts` (sealed-only, singles never normalized), `isOnePieceSealedProduct`
+ `normalizeOnePieceProductType`/`normalizeOnePieceSealedProduct`, curated Bandai MSRPs
migrated to `verifiedMsrp["onepiece:*"]`, full generated `sealed-onepiece.json` via
`npm run data:sync:sealed:onepiece` (420 products, 348 priced, replaces the curated 23).

**L3. Magic: The Gathering sealed — DEFERRED 2026-08-31 (usage cost).** No MTG game is
tracked. Collectr users hold MTG sealed — e.g. "Universes Beyond: FINAL FANTASY – Gift
Bundle" (618899). Measured plan (full numbers in `docs/sealed-market-expansion.md`):
cat 1 = 455 groups, ~178k products, only ~2,450 sealed (1.4% yield) → a daily
sealed-only walk costs +910 TCGCSV requests, ~150–200 MB JSON downloaded (99% discarded
singles), +~2,300 TCGplayer history calls, +~77 cron ticks — ~6× the One Piece cost.
User call: too much usage for now. If revived: (a) migration required — the
`catalog_products_game_check` blocks 'mtg', SQLite CHECK change = table rebuild, add an
mtg⇒sealed check; (b) MSRP stays null (WotC abolished MSRP in 2019) except curated
verified entries (Secret Lair, pre-2019); (c) cost levers — sealed-group cache (after
one discovery walk, re-walk only groups holding ≥1 sealed + newly published groups,
~30–40% savings) or a weekly walk; a modern-only cutoff barely helps (303/455 groups
are 2015+); (d) everything else rides the OP `sealedOnly` rails.

**L4. Retailer-exclusive Pokémon sealed gaps.** Some real TCGplayer SKUs aren't in our
catalog even for English — e.g. "Costco Prismatic Evolutions 8-Pack Mini Tins" (653892).
Audit whether our sealed ingestion is dropping retailer exclusives (Costco/Sam's/Dollar
General variants) or just missing recent additions.

## M. Ingestion scaling & cost fixes (researched 2026-08-31)

Full research in `docs/ingestion-scaling.md` (capacity model, Cloudflare billing
analysis, TCGCSV bulk-archive evaluation). Constraints in one line: the cron has
~200 spare ticks/day (fits ONE more expansion), the daily history job is a permanent
per-product tax, and D1 **rows written** is the only billing meter near its included
limit (~61M projected vs 50M — ~$11/cycle) because history re-upserts ~90–150
unchanged points per product nightly. Each item below is a proposal awaiting a call unless its row carries a RELEASED/LIVE/EXECUTED status (M1–M6 shipped 2026-08-31 → 09-01).

| # | Fix | Effort | Why |
|---|---|---|---|
| M1 | **RELEASED 2026-08-31 — Delta-only history writes** — persist only points newer than the stored max observed_date | S–M | cuts D1 writes ~97%; removes the only projected overage; bill stays $5 at any catalog size |
| M2 | **LIVE since the 2026-08-31 release — Cron `*/2` → `*/1`** | XS | doubles tick budget to 1,440/day; verified $0 (requests/reads/CPU all ≪ included) |
| M6 | **EXECUTED 2026-09-01** — 279,945 archive observations for 574 OP/JP sealed loaded to production; `index:onepiece-sealed` now draws 191 days; details in `docs/ingestion-scaling.md` | — | archive cache kept for a cat-3/89 extension |
| M3 | **RELEASED 2026-08-31 — Sealed-only groupFetchCap 12 → 40** | XS | sealed groups yield ~1 record; ~3× sealed-walk speed at ~80 of 1,000 allowed subrequests |
| M4 | **RELEASED 2026-09-01 — Tiered history cadence** — hot/liquid daily, long tail every 3–7 days; the cron self-starts the daily run | M | catalog can ~3× without the history tax tripling; our own daily observations already capture the close |
| M5 | **RELEASED 2026-09-01 — History targets from D1** instead of deploy-time bundled feeds | M | expansions stop requiring sync-script regen; coverage tracks the walk automatically |
| M7 | **Category registry** shared by walk + sync scripts + tests | M | next game becomes a config entry + normalizer instead of a five-file change |
| M8 | **Widen the `catalog_products` game CHECK once** (mtg/yugioh/lorcana) | S | batches the per-game SQLite table-rebuild migration tax |
| M9 | **Sealed-group cache** — re-walk only groups containing sealed + new groups | M | ~30–40% off sealed walks; build only if MTG revives |
| M10 | **Archive-based daily bulk ingestion** (external job → D1/R2) | L | only at MTG-singles scale; archive is prices-only and can't decompress in a Worker |
| M11 | **Cache buildWorkList per run** — group indexes currently re-fetched every tick | XS | drops ~1,250 pointless requests/day (free, but tidy) |
| M12 | **Rejected-stats review report** — surface the walk's per-run rejection reasons | S | catches taxonomy drift; data already recorded, nobody reads it |
| M13 | **§L4 classifier audit** — why Costco PE 8-Pack Mini Tins (653892) misses while the Costco 151 bundle lands | S | likely a name-pattern miss, not an ingestion-scope gap |

**Recommended order:** M1 → M2+M3 (after which OP curated singles AND MTG sealed
both fit) → M4+M5 before the next singles expansion → M7+M8 with the next new game
→ M6 when sealed chart depth matters → M9/M10 parked pending MTG.

## O. Monetization & marketplace integration (added 2026-09-01, unplanned)

**O2. eBay product links and integration.** Surface eBay alongside TCGplayer on
product detail pages (and possibly rows): at minimum a search-style outbound link like
the existing PriceCharting button (no API needed); deeper integration could use the
eBay Browse/Finding APIs for live listings or sold-comps pricing next to the TCGplayer
market price (API keys, rate limits, and a caching/ingestion path to size at review —
sold-comps would be a genuinely differentiating data source but is the expensive half).
Plan the link tier first; the API tier is its own phase.
*Planned 2026-09-04 — `docs/ebay-integration-plan-2026-09.md`: tier A links (no API, 0 D1
reads), tier B affiliate tags, tier C Browse-API active-listing rotation (`ebay_listings`,
≤ 1,500 calls/day, +1 row per detail view and per first hover reveal), tier D sold comps via
the PokemonPriceTracker tier. eBay sold data itself is closed to us (Marketplace Insights is
a limited release; the public sold search went behind a login in late August 2026).*
*Implemented 2026-09-05 (`d7de3b9`, production `ea6fdbaf`): the initial `ebay_listings`
snapshot table, Browse client, detail panel, manual ops rotation, hero/search/sold links,
and the separate PokemonPriceTracker raw-sale display. Tier B affiliate tagging shipped
2026-09-09 under O1 (completed doc). The original daily catalog rotation is superseded: a
multi-day sweep does not satisfy eBay's six-hour freshness rule.*

*Implementation begun 2026-09-10 on `EnhancementTrial`: plan option A now uses a lazy
`/api/ebay/listings` request on card and sealed detail pages, a six-hour D1 snapshot, an
atomic 4,000-call daily interactive budget, a per-product request lease, and a responsive
image grid. The same first Browse page reviews and retains up to 100 cards and paginates locally at five
per desktop page or three per mobile page; changing pages spends no eBay calls. Production
cron no longer dispatches eBay. Migration 0018 and the Worker secrets are live in production.
The hover asks tile
remains a later enhancement; `ebay-listings` does not belong in the page publish signature
because the no-store client island is independent of the cached page.*
*Account-deletion compliance implemented and activated the same day:
`/api/ebay/account-deletion` handles the endpoint challenge and validates signed deletion
notifications against eBay's one-hour-cached ECC public key. The production verification-token
secret, exact-path Cloudflare managed-challenge exception, endpoint registration, and eBay test
notification were completed successfully.*

*Expanded 2026-09-10 on `EnhancementTrial`: stronger local identity matching rejects
graded/bulk/proxy/cross-game/wrong-language/collector-number and sealed-type conflicts;
the cached cards expose delivered totals, Best Offer, seller trust, watcher/listing-age and
match-confidence metadata with local filters and sorts. Migration 0019 adds one compact
active-ask history row per product/day and the detail panel shows 7/30-day delivered-ask
movement, matched-supply movement, and sampled arrivals/disappearances/price cuts. These are
active-market observations, not completed sales.*

**O4. Remove PokemonPriceTracker.** Do not upgrade the provider tier. Retire its graded and
raw completed-sale path in rollback-safe phases: remove presentation/reads, stop scheduled
collection and its secret, then remove the bundled fallback and finally drop the D1 table
after a production soak. Active eBay Browse asks are not a replacement for completed sales.
Plan and acceptance gate: `docs/pokemonpricetracker-removal-plan-2026-09.md`.

**O5. eBay completed-sales market (future; blocked on licensed data access).** Revisit only
if eBay grants Marketplace Insights access or Raw Signal adopts another licensed source of
item-level eBay completed sales. The ordinary Browse API returns active listings and cannot
power this feature. Marketplace Insights is currently restricted and closed to new users;
its documented history window is up to 90 days.

First release: add a clearly separate "eBay Sold Market" panel with 30-day median sold
price, most recent sold price/date, matched sold-listing count, 30-day low/high, 7/30/90-day
median changes, weekly sales cadence, days since last matched sale, and a robust price spread
(25th–75th percentile or median absolute deviation). Join that data to the existing active
listing snapshot for an explicitly labelled active-ask-to-sold-median gap and a TCGplayer-
market-to-eBay-sold-median gap. Below the metrics, show recent matched sales five per desktop
page and three per mobile page with image, title, sold price, date, condition, buying format,
and seller feedback when the licensed response supplies them.

Keep raw, graded, language, printing, product variant, and sealed case/unit markets separate;
reuse the category/language/condition matching rules and record match confidence, source
timestamp, window, and sample size. Do not label deduplicated sold records as unit volume,
derive a sell-through rate or days-of-supply figure, claim an accepted Best Offer discount,
include shipping in sold price unless supplied, blend raw with graded, or estimate sales from
active asks. This feature must not enter modeled fair value or signals without a separate,
explicit model decision and backtest.

**O6. eBay active-market next release (recommended).** Let the daily history accumulate and
measure real payload/storage/quota behavior before widening the surface. Recommended order:

1. Add a compact 30/90-day active-ask chart to detail pages, using only the stored daily
   aggregates and clearly separating item ask, shown delivered ask, and matched supply.
2. Add cache-only eBay availability/ask badges to board rows or history popovers through one
   batch read endpoint. Those surfaces must never trigger Browse refreshes.
3. Add operator diagnostics for accepted/rejected match reasons, confidence distribution,
   API-budget consumption, refresh coverage, response size, and history-write failures; use
   the evidence to tune matching and decide whether 100 should remain the cap.
4. Add scheduled retention cleanup for observations older than the published history window,
   and document the measured D1 footprint before increasing retention or sampling.
5. Consider ending-soon and country filters after measuring how often eBay supplies those
   fields. Do not infer sell-through, days of supply, or sales from active asks.

## P. Signal-model evolution (planned 2026-09-01; from docs/buy-sell-estimation-research.md §15)

Source research: `docs/buy-sell-estimation-research.md` (baseline-revised 2026-09-01;
original lives in `Documents\Test Project\docs`). Decisions taken at planning: **harness
first**; **full regime labels** (boards + detail, with board filters); **production gate:
every scoring change must beat the current model and the simple baselines out of sample
on the harness** (staging previews allowed earlier); the detail panel keeps the
**"Modeled Fair Value"** name (doc terminology rule amended).

**Gated middle model (adopted 2026-09-01 follow-up).** The archive spans one market
regime (Feb 2024→now, broadly rising), which cannot calibrate the research's ~6
continuous weights per side without overfitting; weighted terms also renormalize
messily when inputs are missing and churn every score on day one. So new intelligence
lands as **gates and one-tier confidence modifiers** (~4 thresholds, each 1-D-sweepable
on the harness and independently measurable), the current score core (proximity + swing
+ confidence) stays, and the §5 weighted blend is demoted to a **contingent v3** —
adopted term-by-term only if the harness shows the gated model leaving measurable
precision on the table.

**Lifecycle weighting findings (research §§6–10, follow-up analysis).** For the
established, board-eligible cards signals actually score (liquidity floor ⇒ mature
history), pull rates/pack costs, sealed prices, same-character comparisons, and the
cohort *level/center* all get **~0 score weight** — their information is already in the
card's own price, and adding them re-counts it (§6.5 endogeneity loop: chase demand →
sealed price → pull cost → card price). They live on as display/context (buy-vs-open
pull-cost comparison, Cohort Position, Rarity Market Index) and as **new-card priors**
for the Early Value Estimate (shipped as P7; cohort median as the anchor — the
Overnumbered cohort clusters near $100 regardless of pull rates, i.e. within-cohort
pull-difficulty β ≈ 0, which the harness can confirm; character premium starts 20–25%
and tapers to ~0–3% by 60 observations; a character/icon field does not exist in the
catalog and is a Phase-4 data-foundation task). One earned v3 candidate: extreme cohort
band deviation (below the cohort's ~10th percentile AND stabilizing) as an extra Hot
Buy evidence line — price-only, backtestable.

Architecture note: `evaluateMarketSignal` is the single scoring path for the batch
writer (`db/daily-ingestion.ts` → `market_signals`), the detail signal panel, and row
badges. P2 introduces an optional `SignalContext` parameter (liquidity, cohort return,
set/game index return, breadth, sales trend — all optional, absence = neutral) so every
surface shares one implementation (landed in P2, which also fixed the detail panel
evaluating without liquidity — see `docs/todo-completed.md` §P).

**P8 (future, separate feature). Riftbound tournament-driven predictions.** Riftbound's
market is player-driven where Pokémon's is collector-driven — tournament results
(decklist appearance/win-rate deltas, new-archetype jumps) become a Riftbound-only
descriptive-then-validated signal layer. Needs a structured results source; explicitly
not applied to Pokémon. Revisit at the 3-month review (`docs/model-gaps.md`).

**Model governance (2026-09-02):** gaps register + accepted limits (strategic buyouts
are unpredictable from price data — accepted) + monthly-evaluate/trigger-refit review
calendar live in `docs/model-gaps.md`. 90-day and 1-year model steps documented there;
30-day market stays the strategic priority. At the next promotion: stamp a model
version into `signal_history` (track-record integrity).

Deferred (unchanged from research §15.7): character priors,
pull-difficulty score adjustments, execution-aware net returns. (Early Value Estimate
graduated to P7.)

## Q. Code-review follow-ups (from the 2026-09-03 refactor program)

Open findings the September review (`docs/codebase-review-2026-09-03.md`) recorded but did
not act on; each needs a product or design decision before code changes.

- **Q1 — `/api/history` GET writes to D1.** On a stored-history miss the route fetches
  TCGplayer and re-derives that product's metrics and signals (`persistDerivedHistory`), so an
  unauthenticated read is a write path, and the local max-profile database drifts under the
  Playwright gate (review §8.12–8.13). Options: keep (cache warm is the intended design;
  document and rate-limit), or move the derive step to the next cron tick and leave GET
  read-only. Decision owner: user.
- **Q2 — Collectr `matchCards` feed fallback** sees only the top 50 rows per market and runs
  two catalog queries per call (review §8.5, §8.10). Dev-only path today (production matches
  against D1); tighten or delete once the feed fallback is retired.
- **Q3 — vinext link prefetch console error.** `[vinext] RSC prefetch setup error: d is not
  a function` (vinext 1.0.0-beta.2, `dist/shims/link.js`) fires once per top-bar link on
  `/import` and after scrolling `/sets`, on staging's older build too. Framework-internal; no
  user-visible effect. Re-check on the next vinext release before filing upstream.
- **Q4 — Component-level smoke tests** for the leaderboard view modes (render each with
  fixture rows). The four Playwright journeys cover state, not every view (review §11).
- **Q5 — Feed payload size.** The largest section feeds are 1–2 MB uncompressed; trim fields
  the leaderboard never renders, or page the largest sections through `/api/catalog`. A
  product decision (review §11).
- **Q6 — `/sets` directory latency (measured 2026-09-03).** *Wave 12: fixes (a) and (b) shipped — one round trip; since wave 15 the directory is served from the Worker's colo cache keyed by the publish signature (ISR was removed in wave 13); (c) precompute remains optional.* Time to first byte is 1.8–3.5 s
  on production, versus ~0.45 s for the home page or a static asset and 0.7–1.5 s for a
  one-query API route; staging's older build shows the same, so it predates the refactor.
  The cron was idle during measurement, so it is not ingestion contention. Cause, from
  `db/sets-service.ts` `loadSetsDirectory` and `EXPLAIN` on the local max-profile copy:
  1. **Six sequential D1 round trips** — `publishedIngestion` → singles group-by → sealed
     group-by → the two momentum windows (these two already run in parallel) → releases →
     signals. Each trip from the edge to the ENAM database costs roughly 200–300 ms, so the
     serial chain alone is ~1–1.5 s. All five data queries depend only on the published run
     and could run in one `Promise.all` (or one `db.batch`).
  2. **The two momentum-window queries scan `market_metrics`** (16.5k rows) with two temp
     B-trees each (`SCAN mm` → window `ORDER BY` → `GROUP BY`); the release query scans
     `product_details` (16.9k). Locally all six queries total ~150 ms warm; D1 adds its own
     per-query execution overhead on top of the round trip.
  3. **No caching.** The route is a server component with no `Cache-Control`, so every visit
     recomputes a payload that changes once a day (after the metrics rollup). `worker/index.ts`
     or the route can set `public, s-maxage=…, stale-while-revalidate` the way `app/api/cache.ts`
     tiers do for the API routes.
  Fix order by payoff/risk: (a) parallelize the five reads — behavior-identical, expected
  ~1 s saved; (b) cache the directory HTML at the edge for an hour — payload is daily; (c)
  precompute a `set_directory` table in the metrics rollup so the page is one indexed read.
  Related cost note: D1 reports ~335 M rows read per day (≈ $10/month at list price); the
  rollup and history passes, not this page, are the likely bulk — worth a rows-read audit under §M.
- **Q7 — D1 rows read: 366 M/day (measured 2026-09-03 via `wrangler d1 insights`).** *Wave 12: F1, F2, F4, F5, F6, F7 shipped; F3 deferred (see review §14). Re-measure with `wrangler d1 insights --timePeriod 1d` a day after deploy.* Attribution
  and fixes are in `docs/codebase-review-2026-09-03.md` §14. Headline: 45% is the detail page
  loading the whole game catalog twice per view (`getDetail` → `productRows("single"|"sealed")`,
  ~43k rows each), 40% was the set-detail observation scan that migration 0013 turned into an
  index seek today (2.7 M → 19 k rows per call), 6% is the early-value first-observation scan
  per detail view, 2% the peer-anchor 180-day scan per detail view. Ingestion itself is under 1%.
  Fix order: F1 peers by set instead of whole-game loads (+ per-game in-isolate cache); F2
  early value from a precomputed first-observation column; F3 peer anchors from the daily
  rollup; F4 = Q6; F5 index `catalog_products(ingestion_run_id)` for the readiness count; F6
  one join instead of four correlated subqueries in `/api/signals`; F7 edge cache for detail
  and set pages. Expected: ~366 M → under 30 M rows/day, and reads that scale with the set
  size rather than the catalog size.
  *2026-09-04 re-measure (per-query `rows_read`, review §15): the audit's projection missed the
  early-value sibling-set list (14 k rows on every detail view), the sets directory's true cost
  (~400 k rows per uncached view) and the metrics page (~600 k, never cached), so the post-wave-12
  floor was ~105 M/day, not 30 M; and the tiered history refresh would have added ~180 M/day the
  first night it ran (1.6 M rows per tick to build its target list). Wave 14 removed the
  detail-table and mover history fan-out, memoized the set list, bounded the target read,
  edge-cached `/metrics`, and fixed R2; the estimate was ~65 M/day at that traffic; Q9 carries the measured figures
  since (66 M on a clean day, 273 M on the 2026-09-09 crawler day). Remaining levers are Q8.*
- **Q8 — precompute the daily aggregates the whole-catalog pages recompute per view (from review
  §15).** The sets directory (six group-bys and two window queries, ~400 k rows), set EV (49 k,
  read by set detail, `/api/set-ev`, and metrics), and the metrics payload (~600 k) all derive from
  the day's rows and change only when a run publishes. Computing them in the metrics rollup into a
  small table (or KV) turns each view into a few hundred rows and stops depending on the colo
  cache hit rate; the set-detail observation aggregation (Ps × days, growing ~365 rows per member
  per year) belongs in the same rollup as a per-set daily index. Order: set EV → directory →
  set index → metrics payload.

**Q9. Peer anchor is now the largest read (2026-09-05 insights, first clean day after wave
14: 66.0 M rows/day, from 337 M).** `db/peer-anchors.ts` — the detail page's 180-day cohort
average — read 40.1 M rows in 24 h (61% of all reads): 13.9 k rows per call averaged over
~2,900 detail views, far above the 3.7 k the review measured on one cohort, because large
cohorts (promo sets, hundreds of cards × 180 days) dominate. Every card of one set+rarity
shares a cohort, so a per-isolate memo keyed by (game, set, rarity) with a ten-minute TTL
(the early-value set-list pattern) removes most repeats from crawlers walking a set; the
durable fix is a per-cohort daily average table written by the rollup (Q8). *Memo implemented
2026-09-09 (`readPeerAnchor` keeps each cohort summary per isolate for ten minutes; failed reads
are not kept) after the query reached 142 M rows a day on 16 k detail views.* Remaining lines
that day: whole-game isolate loads 6.1 M (278 cold isolates), `/api/signals` 2.9 M, set EV
2.3 M; 6.9 M were the operator's own R3 verification queries (full observation scans) and
will not recur.

## S. Crawler and bot traffic (Cloudflare analytics, 2026-09-04)

- **S1 — most visits are automated.** Analytics showed ~3.8 requests and ~30 KB per visit against
  ~34 per visit in the prior period, 4xx errors up 907%, 2% unencrypted requests, and datacenter
  geographies (Russia, China, Finland, Netherlands, France, Germany). *Shipped 2026-09-04 (wave 15):
  the page edge cache is keyed by the publish signature and held 36 h; `public/robots.txt`
  disallows `/api/`, `/data/`, `/_vinext/`, `/__ops/` with a crawl delay; `/sitemap.xml` lists the
  core pages and every set page.* Operator steps still open, in order: read Security → Bots for the
  verified/unverified split; enable Bot Fight Mode and Block AI bots (and AI Labyrinth); WAF rule
  challenging non-verified datacenter-ASN traffic on `/cards/*`, `/sealed/*`, `/sets/*`; a WAF rule
  blocking `/api/*` and `/data/*` requests without `Sec-Fetch-Site: same-origin` (verified bots
  excepted); one rate limit on the detail paths (~30/min per IP); Turnstile on the Collectr import;
  re-read the D1 24 h counter and the Bots panel a day later.
- **S2 — managed challenge observed live (2026-09-09 ~23:40Z).** Between the 23:09Z status
  check (curl 200) and the Q9 deploy verification, `rawsignal.cards` began answering
  `Cf-Mitigated: challenge` (403 "Just a moment…") to non-browser clients: plain curl, a
  spoofed Googlebot user agent from a residential IP, and `/api/signals` were all challenged;
  a browser user agent, the in-app browser, and `/sitemap.xml` got 200; workers.dev staging is
  untouched. Consequences and checks: (1) every external API consumer — including any future
  public signals endpoint (§O plan) — is challenged unless a WAF exception covers `/api/*` for
  the intended clients; (2) confirm Security → Bots shows verified bots (Googlebot, Bingbot)
  allowed through, since Cloudflare verifies them by IP, not user agent — the spoofed test from
  here proves nothing about the real crawlers; (3) production checks from tooling must send a
  browser user agent. Measure the effect together with Q9: on 2026-09-09 the day read 273 M rows
  on ~16 k detail views (peer anchor 142 M); re-read `wrangler d1 info` and the top insights
  after 2026-09-10 23:00Z to split the drop between the challenge (fewer views) and the memo
  (fewer rows per view).

## R. Production ingestion (R1–R3 shipped — see the completed doc; R4 fix 3 and R5 open)

**R4. Overlapping guard-cron ticks halve the live walk, then the minimum-records guard
resets it (found 2026-09-05 03:50Z).** The `live-daily:2026-09-04` run took 7.2 h
(20:07→03:19Z) against 4.4 h the day before, wrote
9,123 records with 9,591 duplicate decisions (1,320 the day before), and stamped rows at a
flat 2,400/h — 40 a minute against an 80-record tick every minute. No minute wrote more than
80 observations, so ticks are not writing concurrently; the pattern fits a trailing tick that
starts while the previous one is still mid-slice, reads the same cursor, finds every record
already stamped (all duplicates, no writes), and checkpoints the same cursor — one wasted
minute in two. Ticks are ~12 D1 ops per record × 80 records, i.e. right at the 60 s cron
period, so any D1 latency increase tips them over. Second-order effect, observed 03:54Z: each
tick checkpoints `recordsWritten` from the stats it read at start plus its own writes, so the
trailing tick's checkpoint clobbers the leader's count; by the end of the pass the stat read
9,123 while 18,284 rows carried the run id, the `minimumRecords` (10,000) guard judged the
day truncated and reset the cursor to 0:0, and the re-walk (cursor 1:133 at 03:54Z) finds
every row stamped, so it will write nothing, fail the guard again, and loop until the run id
changes with the next publish — the 2026-09-04 publish never lands, and the rollup and
history for it never run. Fixes, in order: (1) a tick lease in `refresh_state`
(`key='cron-lease'`, `lease_until`) claimed with one conditional UPDATE at tick start and
released at the end — a tick that cannot claim it exits idle; (2) the guard counts stamped rows
in D1 (`count(*) where ingestion_run_id=?`) instead of the racy stat, and a reset re-walk that
finds rows already stamped counts them as written; (3) halve the live slice to 40 records so a
tick finishes well inside its minute (the chain has hours of headroom).
*Fixes 1 and 2 shipped 2026-09-05 (`d7de3b9`, production `ea6fdbaf`): `db/tick-lease.ts` claims a 170 s
lease in `refresh_state` (`cron-lease`) with one conditional upsert and the tick exits idle
when it cannot; the live walk's truncation guard and its published count use the rows the
database holds for the run, so a reset re-walk publishes. The stuck 2026-09-04 re-walk completed under the new
guard and published at 07:48Z on 2026-09-05; the chain has run daily since. Fix (3), the
40-record live slice, is not implemented (`LIVE_BATCH_SIZE` stays 80) — open, low priority
while ticks finish inside the lease.*

**R5. Observations dated by wall clock, not by the run.** `observed_date` is the tick's UTC
date, so a live walk that straddles midnight splits one TCGCSV publish across two dates
(2026-09-04: 8,742 observations dated the 4th, ~9.5 k dated the 5th; the 3rd's run put 1,607
onto the 4th). The set index and metrics treat each date as a day of coverage, so straddled
days undercount members and can fall under the 60% coverage floor. Fix: date observations
and `as_of_date` by the run's source date (`sourceUpdatedAt`), one date per publish; decide
how to treat the existing split days (leave, or re-date the post-midnight rows of a run).
