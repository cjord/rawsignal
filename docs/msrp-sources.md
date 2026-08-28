# MSRP sources

Provenance for every MSRP the site shows (audit Phase C, user decision 2026-08-28:
**verified + derived, badged**). Precedence per product: published feed → hand-curated
verified table (`scripts/msrp/verified-msrp.mjs`) → standard-pricing derivation
(`scripts/msrp/derived-msrp.mjs`). The `msrp_source` string stored with each product is
the badge the UI shows; derived values always read "Standard pricing (derived)".

## Derived standard pricing (Pokémon, 2020+)

Estimates by construction — applied only to name patterns with near-universal standard
pricing, never to collections, tins, box sets, imports, or Pokémon Center exclusives.
Era boundary: Scarlet & Violet (March 2023) moved packs $3.99 → $4.49 and ETBs
$39.99 → $49.99; pricing held through the Mega era (the rumored 2025 increase was
Japan-only). Sources: TPCi price-change coverage (PokeBeach/Game Informer, Dec 2022),
PokeBeach product lineups for Phantasmal Flames (2025) and 30th Celebration (2026),
cross-checked against bujusjujus.com's MSRP reference.

| Product type | SWSH era (2020–2022) | SV/ME era (2023–) |
|---|---|---|
| Booster Pack (plain) | $3.99 | $4.49 |
| Booster Bundle (6 packs) | $23.94 | $26.94 |
| Booster Box / Display (36) | $143.64 | $161.64 |
| Elite Trainer Box | $39.99 | $49.99 |
| Ultra-Premium Collection | $119.99 | $119.99 |

Known exceptions the derivation refuses (stay null until hand-curated): Pokémon Center
ETBs (~$59.99), sleeved/checklane boosters, blisters, tins, collections and box sets,
Japanese imports, pre-2020 products.

## Verified sources on file

| Products | MSRP | Source |
|---|---|---|
| One Piece — all 23 tracked sealed products | per-product values in `public/data/sealed-onepiece.json` ($4.99 packs · $12.99–15 double-pack sets · $19.99–24.99 decks/illustration boxes) | Bandai official product pages (en.onepiece-cardgame.com/products/) via the curated feed |
| Riftbound — 33 curated products | per-product values in `public/data/sealed-riftbound.json` ($4.49-class packs · $19.99 champion decks · $120 booster displays &c.) | "Asmodee/Riftbound MSRP" — Riot merch + distributor sheets, curated 2026 |
| Pokémon — ~110 products | per-product values via the community published-MSRP feed | tcg-price-tracker (shizukaziye) matched feed, "Published product MSRP" |

## Riftbound expansion (44 newly-imported products — compiled 2026-08-28)

Sources: PHD Games distributor announcements per wave (Origins 2025-03, Spiritforged
2025-08, Unleashed 2025-12, Vendetta 2026-03, Radiance 2026-06 — independently confirmed
by Coqui Hobby, Legacy 2026-08), UVS Games' official Spiritforged retailer PDF, and
Riot's own merch/announcement pages. **none** = deliberately unpriced: distributor-only
cases, organized-play kits/prize packs with no retail MSRP, TCGplayer art-bundle
groupings that are not official SKUs, and not-yet-published waves. Soft secondary-only
values are excluded from the verified table until a distributor publishes them.

| productId | Product | MSRP | Source |
|---|---|---|---|
| 658333 | Riftbound: Worlds Bundle 2025 | $99.99 | Riot merch product page |
| 635369 | Origins - Booster Display Case | none | distributor case (6 displays) |
| 635458 | Origins - Champion Deck (Lee Sin) Display | $79.96 | PHD sheet 2025-03 (4×$19.99) |
| 675404 | Origins - Nexus Night Promo Pack | none | OP prize pack, no retail MSRP |
| 690173 | Origins - Sleeved Booster Art Bundle [3] | none | TCGplayer grouping, not an official SKU |
| 663920 | Origins - Proving Grounds Box Set Case | none | distributor case (unit $29.99, raised to $40 Jan 2026) |
| 661937 | Spiritforged - Booster Display Case | none | distributor case |
| 678690 | Spiritforged - Pre-Rift Event Kit | $480 | UVS "Spiritforged Dates & Details" PDF |
| 679041 | Spiritforged - Pre-Rift Kit | none | OP player kit (~$30/kit per UVS PDF, no standalone MSRP) |
| 680454 | Spiritforged - Nexus Night Promo Pack | none | OP prize pack |
| 690174 | Spiritforged - Sleeved Booster Art Bundle [3] | none | TCGplayer grouping |
| 678152 | Unleashed - Booster Display Case | none | distributor case |
| 678159 | Unleashed - Pre-Rift Event Kit | $480 | PHD sheet 2025-12 |
| 678162 | Unleashed - Vault Bundle | $34.99 | PHD sheet 2025-12 |
| 678898 | Unleashed - Pre-Rift Kit | none | OP player kit |
| 690175 | Unleashed - Sleeved Booster Art Bundle [3] | none | TCGplayer grouping |
| 695122 | Unleashed - Nexus Night Promo Pack | none | OP prize pack |
| 711445 | Unleashed - Vault Bundle Case | none | distributor case |
| 693382 | Vendetta - Booster Display Case | none | distributor case |
| 697969 | Vendetta - Pre-Rift Kit | none | OP player kit |
| 697970 | Vendetta - Vault Bundle | $34.99 | PHD sheet 2026-03 |
| 697971 | Vendetta - Showdown Decks: Zed vs Shen | $34.99 | PHD 2026-03 (display $139.96 ÷ 4) + UVS coverage |
| 706237 | Vendetta - Showdown Decks Display | $139.96 | PHD sheet 2026-03 |
| 707963 | Vendetta - Pre-Rift Event Kit | $480 | PHD sheet 2026-03 |
| 710856 | Vendetta - Sleeved Booster Art Bundle [3] | none | TCGplayer grouping |
| 711001 | Vendetta - Nexus Night Promo Pack | none | OP prize pack |
| 711444 | Vendetta - Vault Bundle Case | none | distributor case |
| 710238 | Secret Garden Box | $70 | Riot official (event-exclusive at-event price) |
| 711362 | Radiance - Booster Pack | none | secondary-only ($4.99 soft; display math $5.00) — excluded |
| 711363 | Radiance - Sleeved Booster Pack | none | not yet published (prior waves $9.98) |
| 711364 | Radiance - Sleeved Booster Art Bundle [3] | none | TCGplayer grouping |
| 711365 | Radiance - Booster Display | $120 | PHD sheet 2026-06 + Coqui Hobby |
| 711366 | Radiance - Booster Display Case | none | distributor case |
| 711368 | Radiance - Showdown Decks: Evelynn vs Seraphine | $34.99 | PHD 2026-06 (display ÷ 4) |
| 711369 | Radiance - Showdown Decks Display | $139.96 | PHD sheet 2026-06 |
| 711372 | Radiance - Vault Bundle | $34.99 | PHD sheet 2026-06 + Coqui Hobby |
| 711446 | Radiance - Vault Bundle Case | none | distributor case |
| 712806 | Legacy - Booster Display | $120 | PHD sheet 2026-08 |
| 712807 | Legacy - Booster Pack | none | not yet published (~$5 by display math) |
| 712808 | Legacy - Booster Display Case | none | distributor case |
| 712809 | Legacy - Pre-Rift Event Kit | none | GTS lists 18-kit case with no SRP (format differs from earlier $480 waves — do not carry over) |
| 712810 | Legacy - Pre-Rift Kit | none | OP player kit |
| 712812 | Legacy - Vault Bundle Case | none | distributor case |
| 712813 | Legacy - Vault Bundle | $34.99 | PHD sheet 2026-08 |

Key links: phdgames.com wave announcements (2025-03-31 Origins · 2025-08-12 Spiritforged ·
2025-12-30 Unleashed · 2026-03-12 Vendetta · 2026-06-15 Radiance · 2026-08-11 Legacy);
uvsgames.com Spiritforged Dates-and-Details PDF; merch.riotgames.com (Worlds Bundle);
playriftbound.com products-into-2027 + January-2026 merch update (Proving Grounds
$29.99 → $40); coquihobby.com Radiance announcement; gtsdistribution.com Legacy Event
Kit listing. Context flag: the curated feed's Proving Grounds Box Set carries the
original $29.99 — Riot's Jan 2026 increase to $40 is noted here for a future refresh
decision.
