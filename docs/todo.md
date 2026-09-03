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

Everything through P7 is in production (2026-09-03, Worker version `c00fd0fb`). What
remains falls into three tiers:

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
   catalog expansion that fits the cron budget and unlocks OP import matching); §O1/§O2
   affiliate + eBay link tier (cheap once the program credentials exist — user action);
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
code-review follow-ups (Q1–Q7, decisions pending) · §R production ingestion cadence bug (R1, urgent).

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
| M4/M5 | **IMPLEMENTED 2026-08-31** — see `docs/ingestion-scaling.md` for the measured tier split, the dropped signal rule, and the production sales-null discovery | — | staging-verified; activates on next production deploy |
| M6 | **EXECUTED 2026-09-01** — 279,945 archive observations for 574 OP/JP sealed loaded to production; `index:onepiece-sealed` now draws 191 days; details in `docs/ingestion-scaling.md` | — | archive cache kept for a cat-3/89 extension |
| M3 | **RELEASED 2026-08-31 — Sealed-only groupFetchCap 12 → 40** | XS | sealed groups yield ~1 record; ~3× sealed-walk speed at ~80 of 1,000 allowed subrequests |
| M4 | **RELEASED 2026-09-01 — Tiered history cadence** — hot/liquid daily, long tail every 3–7 days; the cron self-starts the daily run | M | catalog can ~3× without the history tax tripling; our own daily observations already capture the close |
| M5 | **RELEASED 2026-09-01 — History targets from D1** instead of deploy-time bundled feeds | M | expansions stop requiring sync-script regen; coverage tracks the walk automatically |
| M6 | **Archive sealed-history backfill (one-shot)** — TCGCSV daily price archives (4 MB, back to 2024-02-08) rebuilt locally for categories 68/85 | M | 2.5 years of daily history for the 587 new OP/JP sealed; TCGplayer's API is thin on sealed |
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

**O1. eBay and TCGplayer affiliate links.** Convert the outbound product links into
affiliate/partner-tagged URLs: the existing TCGplayer buttons (detail-page hero,
leaderboard "View on TCGplayer") via the TCGplayer affiliate/impact program, and the
eBay links from O2 via the eBay Partner Network (EPN campaign id on the URL). Needs:
program signups + credentials (user), a small shared link-builder helper so tags apply
consistently everywhere links render, and a disclosure line (footer/methodology) per
program requirements. Scope and plan at review before implementation.

**O2. eBay product links and integration.** Surface eBay alongside TCGplayer on
product detail pages (and possibly rows): at minimum a search-style outbound link like
the existing PriceCharting button (no API needed); deeper integration could use the
eBay Browse/Finding APIs for live listings or sold-comps pricing next to the TCGplayer
market price (API keys, rate limits, and a caching/ingestion path to size at review —
sold-comps would be a genuinely differentiating data source but is the expensive half).
Plan the link tier first; the API tier is its own phase.

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
- **Q6 — `/sets` directory latency (measured 2026-09-03).** Time to first byte is 1.8–3.5 s
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
- **Q7 — D1 rows read: 366 M/day (measured 2026-09-03 via `wrangler d1 insights`).** Attribution
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

## R. Production ingestion cadence bug (found 2026-09-03 during the D1 audit)

- **R1 — the daily metrics rollup and the tiered history refresh have never run in production.**
  `refresh_state` shows `metrics-rollup:2026-08-28` (the manual backfill) and
  `history-backfill:2026-08-28` as the last runs; there is no `history-daily:*` run at all, and
  `signal_history`, `shadow_signal_history`, and `cohort_stats` are empty. Cause: the guard-cron
  policy (`worker/scheduled-decision.ts`) gates metrics and history on
  `livePublishedRunId === live-daily:<today>`, but the live run is keyed by the TCGCSV publish
  date and finishes after midnight UTC (20:05Z start → ~04:56Z finish), so on day D the published
  id is `live-daily:D-1` and "today's live run" is never complete when the tick looks.
  Consequences: no signal track record (P1b/P3 scoreboard inputs), regime cohort breadth always
  neutral (P4), liquidity `sales_7/30` frozen at the 2026-08-28 backfill values, and the October
  model-verification review has no shadow data. Fix: key the rollup and the daily history run to
  the live run they follow (`metrics-rollup:<liveRunDate>`, due when the live run for that date is
  published and the rollup for that date is not), and pin it in `tests/cloudflare-cutover.test.mjs`
  with a live run that completes the next UTC day. Then run one manual `metrics` job to backfill
  today's snapshot. **Priority: above everything in §Q — the model program's evidence depends on it.**
