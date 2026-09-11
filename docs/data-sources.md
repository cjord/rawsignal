# Data sources and ownership

Raw Signal separates current catalog/listing data, dated market history, completed-sale data, active-listing asks, supplemental MSRP, and external artwork. These sources have different meanings and must not be blended into unsupported metrics. (Refreshed 2026-09-10 against the code; the eBay and PokemonPriceTracker sections are the additions since the original 2026-08-27 register.)

## TCGCSV / TCGplayer catalog pricing

TCGCSV is the primary current catalog and price source. The live walk (`db/live-ingestion.ts`) and the feed generator (`sync-tcgcsv.mjs`) read Pokémon category 3 (plus the Japanese promo groups of category 85, published as the `japanese-promos` section), Riftbound category 89, and One Piece category 68 (sealed products only). Product IDs remain the stable source identities.

Used fields include:

- product identity, name, set/group, rarity, number, and printing;
- external artwork URL;
- market price;
- listing low, median, and listing high when present.

Market price approximates recent selling value. Low, median, and high are listing-derived fields and are not daily sale counts. Listing high can be distorted by price parking and is not used as a valuation target.

## TCGplayer dated market history

The history endpoint retrieves normalized Near Mint market history for Singles and unopened-product history for Sealed. Exact printing/condition matches are preferred; fallback coverage is labeled explicitly. Dated observations support:

- 7-, 30-, and 90-day change;
- 30-day low and high;
- historic low and high;
- Buy/Sell proximity and volatility calculations.

The same endpoint reports completed-sale activity per variant/condition SKU: quantity sold and transaction counts in three-day buckets over the trailing quarter, window totals, and realized low/high sale prices with and without shipping. This is the only authorized source of per-printing TCGplayer sales volume. Volume is presented per printing/condition with its window and bucket size labeled, and is never inferred from listings or observation counts.

History availability varies by product. Missing or unmatched history remains unavailable and can prevent signal qualification.

## PokemonPriceTracker graded and raw sales

The graded rotation (`db/graded-ingestion.ts`) reads PokemonPriceTracker's smart-market prices per grade and its raw-card eBay completed-sales figure (price, sale count, and date). It is the site's only eBay *sale* price and is always labelled with its provenance ("eBay completed sales via PokemonPriceTracker"). It does not enter modeled fair value or signals.

## eBay active listings (Browse API)

The eBay on-demand resolver (`db/ebay-ingestion.ts`, clients under `core/clients/`, summary `core/ebay-summary.ts`, tables `ebay_listings` and `ebay_listing_observations`) stores one six-hour active buy-it-now snapshot for a detail page after its listing grid nears the viewport: result estimate, reviewed/accepted counts, item and delivered-ask distributions when at least three results survive validation, and up to 100 accepted listings with images and available listing metadata. The cached result page is filtered, sorted, and paginated entirely in the browser at five listings per desktop page and three per mobile page, so those interactions spend no additional eBay calls. Each refresh upserts one daily aggregate; the UI shows 7/30-day delivered-ask changes, matched-supply change, and sampled listing arrivals/disappearances/price cuts. Disappearance is not evidence of a sale. Asks are listing prices, never sales; they are labelled as asks everywhere they render and never enter modeled fair value or signals. D1 holds the shared daily call budget and per-product request leases. The former rotation remains a staging-only operator tool; without the two Browse secrets the detail page keeps its eBay search links and reports listings unavailable.

Single-card searches are language-scoped with eBay's category-specific `Language` aspect. Catalog cards default to English; Japanese promo sections/numbers resolve to Japanese, while explicitly named promo languages (for example French, Korean, or Polish) override that default. A second local validation layer checks normalized product-name coverage plus set or collector-number evidence and rejects conflicting game, language, grade, bulk/lot, proxy, and collector-number markers. Sealed matching also preserves product families such as cases, booster boxes/displays, packs, bundles, and collections. Sealed searches remain unscoped by the card-only Language aspect because they span multiple eBay categories. Every search/sold URL includes the direct EPN campaign parameters, with Smart Links retained as a site-wide backstop. Browse listing cards prefer eBay's affiliate response URL and directly tag its ordinary item URL if that field is absent.

## Sealed MSRP

Pokémon Sealed refreshes supplement TCGCSV prices with matched published MSRP records currently obtained through the maintained price-tracker dataset. MSRP provenance is stored per product when available. Riftbound, One Piece, regional, and promotional products may lack MSRP or market price; those fields remain `null` and render as `N/A`. See [MSRP sources](msrp-sources.md) for the verified and derived tables.

The normalizer enforces market ownership. A product must not appear in Pokémon because its name resembles a Pokémon product; Lorcana, One Piece, Riftbound, and other cross-market records are rejected.

## Artwork

Product artwork remains externally hosted and is loaded lazily after text and pricing. Raw Signal does not currently own an R2 image archive. Product art is TCGplayer's CDN image; a Pokémon card whose image fails to load, or loads as the CDN's 400×570 "no photo" placeholder, falls back once to TCGdex's scan (`core/domain/card-images.ts`, set index `app/data/tcgdex-sets.json` from `scripts/sets/sync-tcgdex.mjs`), and only then to the application's "Image unavailable" fallback (`app/DeferredImage.tsx`). Pokémon set logos come from pokemontcg.io (`scripts/sets/sync-set-logos.mjs`). Curated Riftbound expansion wordmarks and Riot-published Lunar Revel, Secret Garden, and T1 collection art are optimized WebP files under `public/images/set-art/riftbound/`; source references are the [UVS retailer asset library](https://uvsgames.com/retailer-portal/page-uvs-retailer-portal-marketing-assets-riftbound/) and the relevant [Riftbound announcements](https://playriftbound.com/en-us/news/announcements/). Other sets fall back to their highest-market eligible product, excluding sealed cases and display multiples. Failed images must not delay market data.

## Generated feeds

`public/data/` contains validated generated or maintained feeds. Production refresh code owns these files; do not hand-edit them to repair an individual record.

The root-level `tcg-index.json` defines current markets, rarity ordering, totals, and source freshness. Catalog manifests record schema version, counts, rejection reasons, duplicate decisions, and source timestamps. The bundled set indexes under `app/data/` (TCGdex sets, set logos) are generated the same way.

## Explicitly unavailable metrics

Raw Signal does not currently publish:

- most-frequently-sold rankings;
- TCGplayer sales rank;
- bid-side depth (eBay ask summaries are published, labelled as asks, never as sales or bids).

TCGCSV price files do not provide transaction counts; sales volume comes only from the TCGplayer history endpoint's completed-sale buckets described above. PokemonPriceTracker is the current eBay completed-sale source but is planned for removal (`pokemonpricetracker-removal-plan-2026-09.md`); Browse asks will not replace it. Price observations, listings, and the number of visible history points are still not substitutes for sales volume.

## Legacy PriceCharting research

`research.mjs` and `cards.json` captured an early one-off PriceCharting/TCGplayer investigation. They are preserved for provenance only. They are not imported by the application, refresh pipeline, database jobs, or tests and must not be presented as current market data. See [Legacy artifacts](legacy-artifacts.md).
