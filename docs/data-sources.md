# Data sources and ownership

Raw Signal separates current catalog/listing data, dated market history, supplemental MSRP, and external artwork. These sources have different meanings and must not be blended into unsupported metrics.

## TCGCSV / TCGplayer catalog pricing

TCGCSV is the primary current catalog and price source. The active sync reads Pokémon category 3 and Riftbound category 89. Product IDs remain the stable source identities.

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

History availability varies by product. Missing or unmatched history remains unavailable and can prevent signal qualification.

## Sealed MSRP

Pokémon Sealed refreshes supplement TCGCSV prices with matched published MSRP records currently obtained through the maintained price-tracker dataset. MSRP provenance is stored per product when available. Riftbound, One Piece, regional, and promotional products may lack MSRP or market price; those fields remain `null` and render as `N/A`.

The normalizer enforces market ownership. A product must not appear in Pokémon because its name resembles a Pokémon product; Lorcana, One Piece, Riftbound, and other cross-market records are rejected.

## Artwork

Artwork remains externally hosted and is loaded lazily after text and pricing. Raw Signal does not currently own an R2 image archive. Failed images use the application fallback and must not delay market data.

## Generated feeds

`public/data/` contains validated generated or maintained feeds. Production refresh code owns these files; do not hand-edit them to repair an individual record.

`tcg-index.json` defines current markets, rarity ordering, totals, and source freshness. Catalog manifests record schema version, counts, rejection reasons, duplicate decisions, and source timestamps.

## Explicitly unavailable metrics

Raw Signal does not currently publish:

- verified transaction volume;
- most-frequently-sold rankings;
- TCGplayer sales rank;
- bid/ask depth;
- shipping-inclusive realized price.

TCGCSV price files do not provide complete transaction counts. Price observations, listings, and the number of visible history points are not substitutes for sales volume. A future volume feature requires an authorized transaction source, a defined observation window, product/printing matching, coverage confidence, and explicit handling of missing days.

## Legacy PriceCharting research

`research.mjs` and `cards.json` captured an early one-off PriceCharting/TCGplayer investigation. They are preserved for provenance only. They are not imported by the application, refresh pipeline, database jobs, or tests and must not be presented as current market data. See [Legacy artifacts](legacy-artifacts.md).
