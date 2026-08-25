# Hot Buy and Hot Sell eligibility

Hot Buy and Hot Sell are qualification views, not alternate catalog feeds. A card can be present on the Leaderboard and absent from a signal view for either a coverage reason or a qualification reason.

## Transitional coverage

Until the durable `history-signals` backfill is complete, the browser requests history for at most 400 candidates. The fallback now allocates that budget proportionally across selected rarities or product types and samples evenly through each group's existing price order. This prevents an earlier source file or only the highest-priced cards from consuming the budget.

For the default Pokémon Singles selection (499 Illustration Rares and 222 Special Illustration Rares), the 400-card fallback evaluates 277 Illustration Rares and 123 Special Illustration Rares. Selecting Special Illustration Rares alone evaluates all 222 because the category is below the limit. Once the persisted backfill readiness marker is published, the site stops sampling and uses complete stored coverage.

Catalog sizes above the fallback ceiling as of the current feed are:

| Pokémon rarity | Cards | Not evaluated by a 400-card single-rarity fallback |
| --- | ---: | ---: |
| Illustration Rares | 499 | 99 |
| Special Illustration Rares | 222 | 0 |
| Promos | 3,419 | 3,019 |
| Ultra Rares | 2,527 | 2,127 |
| Double Rares | 496 | 96 |
| Secret / Hyper Rares | 721 | 321 |
| Shiny / Radiant Rares | 452 | 52 |
| Vintage | 5,101 | 4,701 |

All current Riftbound single-rarity feeds are below 400 (Rares 259, Epics 152, Alt Arts 103, Overnumbered 91, Signatures 45), so a single selected Riftbound rarity is completely evaluated during fallback.

## Qualification reasons

An evaluated item is omitted when any of these checks fails:

1. **Current price unavailable.** Signals require a positive current market value.
2. **History unavailable or insufficient.** At least two usable positive daily observations are needed to identify a low or high. A failed or unmatched TCGplayer history request has the same effect during fallback.
3. **Outside the adaptive cutoff.** The current price is too far from the nearest 30-day, 90-day, or historic low for Hot Buys, or high for Hot Sells. The cutoff expands for volatile cards and is capped by the selected strictness.
4. **Score below the strictness minimum.** Proximity, the swing from the opposite extreme, and history confidence form the signal score. Conservative requires a stronger score than Balanced; Aggressive admits weaker signals.
5. **Normal user filters.** Market, rarity, set, price, and movement filters apply before signal qualification.

Low-confidence history is not automatically excluded. It receives less confidence weight but can still qualify when proximity and price swing meet the selected preset.

## Important interpretation

The 400-card fallback is a temporary operational ceiling, not a statement that excluded cards are poor buys or sells. Likewise, a card that fails qualification is not a recommendation in the opposite direction; it only means the available data does not meet the current side and strictness rules.
