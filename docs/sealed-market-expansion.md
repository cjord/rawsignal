# Sealed-market expansion — findings & plan (measured 2026-08-31)

Analysis for adding One Piece and MTG sealed products to the library (todo L2/L3).
Numbers were measured live against TCGCSV (the source the live walk already uses):
group counts are exact; MTG product counts are extrapolated from a stratified
31-of-455-group sample.

**Decision (user, 2026-08-31): One Piece proceeds; MTG deferred — daily usage cost
is too high for the value right now.** Plan notes preserved below and in todo §L3.

## Baseline (current daily load)

- Live walk: 254 TCGCSV groups (Pokémon 219 · Riftbound 13 · JP promos 22) →
  ~510 group requests/day, ~17k records (14,084 singles + ~2.8k sealed).
- History backfill: one TCGplayer history call per product per day ≈ 16.6k
  calls/day at 60/tick.
- Cron: `*/1` = 1,440 ticks/day since M2 (2026-08-31; was `*/2` = 720 when this plan was drafted); roughly ~500 consumed (live + history + details +
  graded + metrics).

## Measured scope

| | One Piece (cat 68) | MTG (cat 1) |
|---|---|---|
| Groups | 87 | 455 |
| Total products | 7,518 | ~178k (est.) |
| Sealed products | ~420 (5.6%) | ~2,450 (1.4%) |

## Daily cost of a full sealed-only walk

| Cost | One Piece | MTG |
|---|---|---|
| TCGCSV requests/day | +174 | +910 |
| JSON downloaded/day | ~7 MB | ~150–200 MB (99% discarded singles) |
| TCGplayer history calls/day | +~400 | +~2,300 |
| Cron ticks/day | +~15 | +~77 |
| D1 catalog rows | +420 | +2,450 |

Combined they would take the cron from ~500 to ~600 of 720 ticks/day and ~3× the
TCGCSV request volume. **MTG alone is ~6× the One Piece cost for the same feature**
— hence the deferral. A "modern-only" cutoff barely helps (303 of 455 MTG groups
are 2015+). If MTG is revived, the cost lever is a sealed-group cache: after one
full discovery walk, re-walk only groups known to contain ≥1 sealed product plus
newly published groups (~30–40% savings), or walk weekly instead of daily.

## Implementation notes (One Piece; MTG follows the same rails when revived)

1. **Normalizers** (`core/sealed-product-utils.ts`, `core/normalize/sealed.ts`):
   `isOnePieceSealedProduct` — sealed rows have no Number/Rarity extendedData —
   plus a product-type mapper (Booster Box/Case/Pack, Double Pack, Starter Deck,
   Ultra Deck, Premium/Illustration collections).
2. **MSRP honesty**: OP derived table from Bandai's published pricing (boosters
   per-pack × box size, starter decks) + `verifiedMsrp["onepiece:*"]` for
   exceptions. MTG would be null-MSRP (WotC abolished MSRP in 2019) except
   curated verified entries.
3. **No migration for OP sealed**: `catalog_products_game_check` already allows
   `'onepiece'` and `catalog_products_onepiece_sealed_check` (onepiece ⇒ sealed)
   matches a sealed-only ingest. MTG (or OP **singles**) would force a SQLite
   table rebuild — CHECK constraints can't be altered in place.
4. **Live walk** (`db/live-ingestion.ts`): add cat 68 as a `sealedOnly` work-entry
   flavor (skip `normalizeSinglesGroup`); retire the bundled-onepiece pseudo-entry
   in favor of the walk, merging curated MSRPs by productId like Riftbound does.
5. **Bundled feed**: full `sealed-onepiece.json` from a sync script (replaces the
   curated 23) so deploy fallback + history targets expand automatically.
6. **Downstream is already plumbed for OP sealed**: `SealedGame` includes
   `"onepiece"`, metrics has `index:onepiece-sealed`, the sealed page has the OP
   scope, and the Collectr import matchers (id → name → fuzzy) read from D1 — the
   new rows start matching imports (e.g. "Carrying On His Will Booster Box"
   628352) with no import-side changes.

## Japanese Pokémon (category 85) — measured 2026-08-31

Tracked before this round: singles from the 22 promo groups only (~1,184 priced
"Japanese Promos"); zero JP sealed. Available: 456 groups, 434 non-promo ≈ 18,500
products = ~15,800 priced singles but only **~254 sealed (~224 priced, 1.4%)** — each
JP set lists just box/pack (+ occasional premium trainer box) on TCGplayer.

| Option | Req/day | Ticks/day | Sealed gained |
|---|---|---|---|
| A. Full 434-group walk | +868 | +~41 | ~254 |
| **B. publishedOn ≥ 2020 (140 groups, SWSH on) — CHOSEN** | **+280** | **+~15** | **~150–180** |
| C. Sealed-group cache after one discovery walk | +~250 | +~11 | ~254 (new plumbing) |

Option B covers every Collectr §L1 miss (Eevee Heroes S6a 2021-05-28, VSTAR Universe
2022, Shiny Treasure ex 2023, 151 JP 2023 — publishedOn is era-accurate). JP sealed
stays `game:"pokemon"` — no migration, joins the English sealed catalog/feeds. Promo
groups stay singles-only. Full JP singles (~15,800 priced, +~263 history ticks) would
blow the 720-tick cron budget; curated chase rarities (~3–4k, +~80–105 ticks) is the
only viable singles shape — deliberately unscheduled.

## One Piece: sealed-only vs singles+sealed

Fetch cost is **identical** — the walk already downloads every product+price row
in all 87 groups to find the sealed; singles ride in the same payloads. The
differences are all downstream:

| | Sealed only | + all singles | + curated chase rarities |
|---|---|---|---|
| Records | ~420 | ~7,500 | ~1,500–2,500 (est.) |
| History calls/day | +~400 | +~7,100 | +~1,500–2,500 |
| Cron ticks/day | +~15 | +~210 (near the 720 cap) | +~50–80 |
| Migration | none | table rebuild (drop onepiece⇒sealed check) | same rebuild |
| Code surface | already plumbed | new singles market end-to-end: `SinglesGame` union, OP rarity taxonomy + `allowedRarities.onepiece` sections, main-page market tab, detail enrichment chunks, metrics index, signals | same |

Recommendation: ship sealed now; OP singles as their own phase, scoped to chase
rarities (Alt Art / Manga / SEC / SP / parallels) the way Pokémon singles are
section-curated, keeping the daily history budget sane.
