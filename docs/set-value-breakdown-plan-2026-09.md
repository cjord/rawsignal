# "Where the value sits" — per-rarity pack value breakdown (plan, 2026-09-04)

**Status 2026-09-04: Phase 1 implemented (working tree).** Migration 0017 `set_rarity_stats`;
the live walk aggregates every singles group tier by tier (`core/normalize/rarity-stats.ts`,
`db/rarity-stats.ts`, written once per group per run); `packValueBreakdown` and
`buildValueBreakdown` (`core/domain/pack-ev.ts`, `core/domain/value-breakdown.ts`) with the
curated tier order and CHASE set; `pull-rates.json` gains `perPack` (Riftbound 7 / 3 / 2 from
Riot's published composition, sourced in the file); `SetDetailPayload.valueBreakdown` is
populated (null until the next live run writes the set's rows). Against the reference set the
model reproduces the mock: tier values 1.33 / 1.53 / 2.82 / 2.92 / 1.71 / 2.14 / 1.88, chase
prints 40.0% of EV, implied pack size 12.35. Phase 2 (panel, slider) is next; the Pokémon
composition research below is what it needs confirmed.

## Pack composition research (2026-09-04)

**Riftbound (adopted).** Riot, "Collectability in Riftbound: Origins": every booster has
7 common slots, 3 uncommon slots, 2 rare-or-better slots, 1 foil slot (any rarity), and 1
token/rune slot; Epics appear in about 1 of 4 packs and replace a rare slot (two Epics in one
pack is possible); alt-art champions about 2 per 24-pack box (1 in 12 packs); Overnumbered
about 1 per 3 boxes (1 in 72); about 1 in 10 Overnumbers is a Signature (1 in 720). Riot has
not published changes for Spiritforged, Unleashed, or Radiance; the game default applies until
it does. Simplifications, stated in the panel footnote: the rare slot is valued at 2 per pack
(the Epic replacement is not netted out, as in the reference), and the foil slot is not valued
because its per-rarity odds are unpublished.

**Pokémon (researched, not yet adopted — confirm before Phase 2).**

| Era (TCGCSV sets) | Cards per pack | Published split | Source and confidence |
|---|---|---|---|
| WotC: Base through Neo Destiny, Legendary Collection (1999–2002) | 11 | community-reported 7 common, 3 uncommon, 1 rare (holo about 1 in 3 packs) | Bulbapedia gives the 11-card count; the split is community lore, not a publisher statement |
| e-Card and EX series (2002–2007) | 9 | not published in a form I could source | Bulbapedia (count only) |
| Diamond & Pearl → XY (2007–2016) | 10 | community-reported 5 common, 3 uncommon, 1 reverse holo, 1 rare | Bulbapedia (count); split from community pack breakdowns |
| Sun & Moon (2017–2019) | 10 + 1 basic energy | as above | Bulbapedia ("one Basic Energy card in addition to the 10") |
| Sword & Shield (2020–2022) | 10 + energy + code card; Brilliant Stars–Crown Zenith may swap the energy for a VSTAR marker | community-reported 5 / 3 / 1 reverse / 1 rare | Bulbapedia |
| Scarlet & Violet and Mega Evolution (2023–) | 10 game cards + energy + code card | **two published descriptions disagree**: Pokémon Center support says 4 commons, 3 uncommons, 3 foils with at least one rare or higher; Bulbapedia's table says 4 commons, 3 uncommons, 1 reverse holo, 1 rare/ultra slot | official support article vs. Bulbapedia — adopt the official one (4 / 3 / 3 foil slots) and value the three foil slots as one reverse-holo slot (any rarity) plus two rare-or-better slots, or ask the user which reading to encode |
| Japanese sets (S-, SV-, M-series) | 5 (special sets 7, 10, or 11, e.g. VMAX Climax) | no common/uncommon guarantee published | Bulbapedia; Japanese "1 in N boxes" community pull rates differ from English and are not in our config |

**Decision 2026-09-04 (user): expected/average compositions are the defaults; custom rates
are an optional layer.** Implemented the same day: the pull-rate tables gained an `eras`
level (set override → era default → game default, resolved with the set's era key from
`core/domain/eras.ts`), and `pull-rates.json` carries Pokémon `perPack` era defaults — WotC
7 / 3 / rare slot, EX 5 / 2 / rare slot, Diamond & Pearl through Sword & Shield 5 / 3 / rare
slot, Scarlet & Violet and Mega Evolution 4 / 3 / 1 rare (the official 3-foil description,
with the higher rarities entering at their own packs-per-hit). The rare slot is split Rare
0.67 / Holo Rare 0.33 through Sword & Shield (the long-standing ~1-in-3 holo rate). Reverse-
holo and extra foil slots hold mixed rarities and stay unrated, stated in the footnote, so the
implied pack size reads below the printed size by exactly those slots.

Custom rates, two layers:
- **Config**: per-set overrides under `sets` (already supported) for sets whose published
  composition differs from the era, e.g. a special set with 7- or 10-card Japanese packs.
- **UI (Phase 2)**: an optional "Custom rates" section under the panel — one input per tier for
  cards per pack or packs per hit, prefilled with the curated defaults — re-running
  `packValueBreakdown` in the browser against the tier stats the payload already carries
  (counts, sums, averages). Client state only, like the purchase slider; the defaults remain
  what the page shows until the reader edits them, and a "reset to defaults" chip restores them.

Scope: replace the single-number pack EV tile with a per-rarity breakdown of where a
set's value comes from, for every market (Pokémon, Riftbound, One Piece), with a
purchase-price slider spanning MSRP to market and with the bulk tiers (commons, uncommons,
and the rares the catalog does not track) valued rather than ignored. Reference: the
Riftbound "Where the value sits" mock — one row per rarity with its per-pack value, a share
bar, average card price, slots per pack or hit odds, priced coverage, top card price, CHASE
badges, a "chase prints are 40.0% of EV" header, and the footnote about averages dividing by
every card with implied pack size.

## What exists today

- `core/domain/pack-ev.ts`: **chase EV** = Σ over curated tiers of (tier average market ÷ packs
  per hit). Bulk is excluded, so the number is a floor, labelled as such.
- `public/data/pull-rates.json`: packs-per-hit per rarity or section, per game with per-set
  overrides; curated only (AGENTS rule: never inferred from prices or card counts; uncurated
  tiers render as unavailable).
- Three surfaces: the set page's "Pack EV" tile, the sealed page's "Pull Rates" section
  (per-tier table + chase EV, pack price, EV ratio), the sealed hover tile "Set pack EV ·
  0.44×", and the metrics set leaderboard's "Pack EV" column. All read `loadSetEvData`, which
  scans every priced single (~48.7 k rows per uncached view, review §15) — it is one of the
  whole-catalog queries todo Q8 wants precomputed.
- The catalog tracks curated rarity sections only: Riftbound rares, epics, and showcase
  tiers; Pokémon chase rarities (double rares upward) plus vintage commons/uncommons and
  promos. Modern commons, uncommons, and plain rares are not catalog rows, and One Piece has
  no singles at all.

## Can commons and uncommons be valued? Yes, without tracking them.

The live ingestion already downloads every group's full product and price files from
TCGCSV (`db/live-ingestion.ts`, one products + one prices fetch per group) and then keeps
only the allowed rarities. The bulk cards pass through that job every day; what is missing
is an aggregate, not a fetch. The plan adds one small table written in that same pass:

```
set_rarity_stats (game, set_name, rarity, card_count, priced_count, sum_cents, top_cents,
                  top_product_id, updated_at, ingestion_run_id)  primary key (game, set_name, rarity)
```

- One row per set × rarity for **every** rarity in the group, tracked or not (Pokémon
  ~308 sets × ~8 rarities, Riftbound 12 × 7, One Piece 84 × ~7 once its groups are walked):
  about 3 k upserts a day, three orders of magnitude inside the write allowance.
- `sum_cents` over priced cards and `card_count` over all cards, so the UI can show the
  reference's honest average ("divides by every card; unpriced counts as zero") **and** the
  coverage ("88/88 priced"). `top_cents` and `top_product_id` give the "top US$3.33" line
  and a link when the top card is a tracked product.
- Optional history: a `set_rarity_stats_daily` row per day (same 3 k rows) would let the
  breakdown show 30-day movement per tier later; not needed for the first release.
- One Piece: the live job only loads bundled sealed for that market today. Walking its
  ~84 singles groups for stats only is ~170 extra fetches a day — inside the cron budget —
  and is the way its sets get a breakdown at all (Phase 3).
- Tracked tiers use the same TCGCSV prices, so one source feeds the whole panel and the
  numbers agree with the leaderboards.

## Pack composition: the second curated input

Per-pack value needs two kinds of odds, and the config gains the second:

| Tier kind | Curated field | Per-pack value |
|---|---|---|
| Guaranteed slot (common, uncommon, rare) | `perPack` (e.g. Riftbound 7 / 3 / 2) | average × perPack |
| Chase slot (epic, alt art, overnumbered, signature, illustration rares…) | `packsPerHit` (today's field) | average ÷ packsPerHit |

`pull-rates.json` keeps its shape and adds `perPack` alongside `packsPerHit` per game with
per-set overrides. Both stay curated from published pack breakdowns (Riot publishes
Riftbound's; Pokémon's differ by era — SV/ME booster packs, WotC 11-card packs, Japanese
5-card packs — so era defaults plus set overrides). **Implied pack size** = Σ perPack +
Σ 1/packsPerHit, shown in the footnote exactly as the reference does (12.35 cards); when it
drifts from the printed pack size the config is wrong, which makes it a useful check. Tiers
with neither field render as unavailable and are excluded from the total, per the AGENTS
rule; the header then says "n tiers unrated".

## The model (pure, tested)

`core/domain/pack-ev.ts` gains `packValueBreakdown(tiers, options)`:

```ts
type BreakdownTier = { key; label; rarity; kind: "slot" | "chase"; perPack?; packsPerHit?;
  cardCount; pricedCount; sumMarket; topMarket; topProductId?; chase: boolean };
type ValueBreakdown = {
  tiers: (BreakdownTier & { average; evPerPack; share })[];   // share = evPerPack / total
  totalEv; chaseEv; chaseShare; impliedPackSize; unratedTiers: string[];
};
```

- `average = sumMarket / cardCount` (every card counts; unpriced is zero) — the reference's
  rule, stated in the footnote. `chase` marks the tiers that carry a CHASE badge: every
  `packsPerHit` tier, or a curated `chase: true` flag for guaranteed slots that still matter
  (none today).
- `packChaseEv` stays as the chase subtotal so existing tests and the "floor" wording keep
  meaning; `totalEv` is the new headline. `evRatio(totalEv, price)` is unchanged.
- Rows sort by evPerPack descending in the panel? No — the reference keeps rarity order
  (common → signature) so the bars read as a ladder; sort by the curated tier order.

## Purchase-price slider (user request)

The EV ratio today uses the cheapest live single-pack price. The panel gains a pack-cost
control:

- A range input bounded by **MSRP per pack** and **market per pack**, with the two endpoints
  as one-click chips ("MSRP $4.49", "Market $8.90"), defaulting to market. The readout shows
  "EV ratio at $6.20: 0.63×" with the up/down tone and the break-even price (the pack cost at
  which the ratio is 1.0, i.e. `totalEv`).
- MSRP per pack: the booster pack product's `sealed_details.msrp_cents` when the set has one;
  else a box MSRP ÷ packs per box. Packs per product is a third curated table
  (`packsPerProduct` by game × product type: Pokémon booster box 36, ETB 9, Riftbound box 24,
  One Piece box 24 …) with per-product overrides; a product without an entry offers the
  single-pack price only and says so.
- Market per pack for a box-shaped product: product market ÷ packs per product — which also
  lets the sealed page compare "ripping this box" against its own price, not only the loose
  pack's.
- Scalper mode: the slider's value is prefilled from the manual purchase price todo I.3
  introduces, so the two features share one input; the slider is client state only (no URL
  param, no storage) — an inspection control, not a preference.
- No database cost: MSRP and pack count ride the existing payloads.

## Surfaces

- **Set page**: a "Where the value sits" section under the tiles, laid out as the
  reference: rarity label + CHASE badge, per-pack value right-aligned, share bar (chase tiers
  green, bulk grey), the detail line (avg · slots or odds · priced coverage · top), the
  header chip "chase prints are 40.0% of EV", the slider row, and the footnote with the
  averaging rule and implied pack size. The "Pack EV" tile becomes the headline `totalEv`
  with "bulk included" and links to the section.
- **Sealed page**: the "Pull Rates" section becomes this panel (its table columns fold into
  the detail lines), with the slider bounded by that product's MSRP and market per pack.
- **Hover tile and metrics column**: keep the compact "Pack EV $x · 0.44×" but on `totalEv`;
  label note changes from "chase slots only" to "bulk included".
- **Markets**: identical component for Pokémon, Riftbound, and One Piece; only the curated
  inputs differ. A set whose game has stats but no composition shows the share bars by
  tracked value with "per-pack odds unrated" instead of the EV column.

## Read and write costs

| Path | Today | After |
|---|---|---|
| Set page breakdown | — | +≤10 rows (one PK-range read on `set_rarity_stats`) |
| `loadSetEvData` (set page, sealed hover feed, metrics) | ~48.7 k rows per uncached view | ~3 k rows (the stats table) — a net reduction, and Q8's precompute for this query |
| Live ingestion | — | +~3 k upserts a day; +~170 One Piece group fetches a day in Phase 3 |

## Phases

| Phase | Work | Needs from the user |
|---|---|---|
| 1 | Migration 0017 `set_rarity_stats`; the live job's per-group aggregate (all rarities); `packValueBreakdown` + tests; `pull-rates.json` gains `perPack` for Riftbound (the reference set) | Riot's published Riftbound pack composition confirmed |
| 2 | Set-page and sealed-page panel, slider, hover/metrics relabel; set EV loader switched to the stats table; Playwright journey (slider moves the ratio) | Pokémon compositions by era (SV/ME, SWSH, SM, XY, WotC, Japanese) with sources; `packsPerProduct` table; MSRP per pack where the pack product has none |
| 3 | One Piece: walk its singles groups for stats only; composition and packs per product | One Piece pack composition (12 cards; DON!! slot) |
| 4 | Optional: daily stats history → 30-day tier movement; a "value by rarity" ring on the sets directory tiles | — |

Gate for every phase: `npm run check`; the breakdown's totals must equal the existing chase
EV for a set whose config has no `perPack` entries (regression), and the implied pack size
must match the printed pack size for every curated composition (a fixture test per game).
