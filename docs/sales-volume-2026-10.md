# Detail-page sales volume — 2026-10-09

Implemented but paused on `feature/set-rarity-heatmap`; not deployed. The
`SALES_SUMMARIES_ENABLED` switch in `core/domain/sales-summary.ts` is off: detail pages
do not request or show the new summaries; `/api/history` performs no summary lookup;
ingestion performs no summary upsert; and the client does not calculate the new summary.
Do not apply migration `0020_sales_summaries.sql` while this feature is paused. Existing
price-history calls, sales activity, and signal liquidity logic are unchanged. The
design below describes the dormant feature for later activation. Scope: individual card and
sealed-product pages. Full/hover/leaderboard views are unchanged. This is windowed
TCGplayer unit volume, **not daily bars**, dollar turnover, or eBay listing activity.

## Definition and provenance

- Show 7D, 30D, prior 30D, and recent-vs-prior percentage change. Prior means the
  non-overlapping 30-day period immediately before the recent 30-day period.
- New summaries use source bucket-start age relative to the latest bucket: `[0,7)`,
  `[0,30)`, `[30,60)` days. Counts sum whole three-day buckets; displayed windows are
  explicitly approximate, with no interpolation into fictional daily sales.
- Require contiguous three-day buckets and enough covered span for each window.
  Missing/invalid quantities invalidate sales activity rather than becoming zero;
  missing windows remain null. A zero prior count has no percent comparison.
- Match the history response's exact selected printing/condition. Singles are English
  Near Mint (fallback printing remains labeled by the history section); sealed is
  Sealed/Unopened. One sealed unit is one product, not its contained pack count.
- New `sales_summaries` rows have independent latest-bucket and fetch dates. Price-only
  ingestion never updates these rows. Snapshot older than seven days is labeled stale.
  Legacy `market_metrics` counts remain visible with **freshness unknown** and an explicit
  warning that they are not verified current totals; existing legacy window semantics
  are not silently rewritten. No date is inferred from a price/metrics update timestamp.
- The September 28 audit found scheduled history failures since September 19 and last
  success September 18. This implementation does not fix that upstream access failure
  and does not claim it has recovered. New timestamped summaries accumulate only after
  successful existing history fetches. No forced backfill is part of this work.

## Incremental calls and cost

| Path | Incremental work |
| --- | --- |
| Detail history response with `sales=1` | One indexed summary lookup; if absent, one additional indexed legacy-metrics lookup |
| Browser detail page | Zero new HTTP requests; reuse its existing history request and cache tier |
| Board/Full/hover history and history batch | No added stored-summary queries |
| Valid existing history refresh | One summary upsert (including PK/index maintenance) per product/printing/condition |
| Daily price-only ingestion | Zero sales-summary writes or reads |
| TCGplayer, TCGCSV, eBay, PokemonPriceTracker | Zero added upstream calls or paid credits; quarter/annual history cadence unchanged |

For H successful qualifying history refreshes per day, this adds H SQL upserts/day
(30H/month), not H new Worker invocations. D1 billed row writes include index work.
For V uncached detail-history requests, this adds V to 2V indexed lookups. Exact bill
depends on existing account allowances, traffic, schema/index metering and cache hits;
no dollar or under-limit promise is made. `/api/history` cache misses already fetch and
persist history; they now pass the sales payload previously omitted by that write path.
The extra summary write is outside the existing atomic metrics/signals batch so an
unmigrated table does not stop the existing ingestion path.

## Activation and validation

- Migration: `drizzle/0020_sales_summaries.sql`, matching `db/schema.ts`. Deploy first,
  then apply the migration under the existing environment policy when authorized.
  Missing table falls back to legacy summaries; only that schema-absence error is
  suppressed on writes. No migration was applied remotely during implementation.
- Unit coverage: disjoint windows, short coverage, zero denominator, freshness,
  missing quantities, variant/condition isolation, query/write counts, and no
  sales-date advancement during price-only passes.
- Browser coverage: card and sealed pages, dark/light, phone/desktop, unknown freshness,
  percentages and one existing history request. Shared metric classes avoid new styling.
- Validation: `npm run check` completed its build, 371 passing node tests (one skipped),
  lint (zero errors; 22 existing complexity warnings), type check, and all 22 browser
  journeys. The runner hung after the browser results during teardown and was stopped;
  therefore the overall command did not exit successfully. Resolve/recheck that cleanup
  issue before deployment. No deployment requested in this task.

## Daily sales and marketplace supply research (2026-10-09)

The desired detail-page comparison is **units sold over time** beside **currently
available supply**, separately for TCGplayer and eBay. A listing is one offer, which may
contain several copies; listing count, available-unit count, and sold-unit count must
remain distinct. Scope every number to the selected product, printing/treatment,
language, condition, marketplace, and observation time when the source permits.

| Measure | Verified source and present limitation |
| --- | --- |
| TCGplayer daily sold units | The quarterly detailed history response supplies `quantitySold` and `transactionCount` in three-day buckets per language/variant/condition series. Show the source's three-day totals, or a clearly labelled three-day daily *average* if useful; never depict either as observed daily bars. The existing endpoint returned 403 in the 2026-09-28 audit; a read-only production check on 2026-10-09 found the last successful history run and last TCGplayer observation on September 18, and subsequent daily runs failing `History quarter unavailable`. Restore authorized access before promising current sales. |
| eBay daily sold units | Browse search is for active offers, not completed transactions. The current eBay integration cannot supply this. Require a licensed/authorized completed-sales source with dates and quantities; listing disappearance, reduced stock, or price changes are not proof of a sale. |
| eBay available listings | The existing Browse search returns a broad `total` result count and Raw Signal stores a validated sample of up to 100 returned listings (`reviewedCount`, `acceptedCount`, `highConfidenceCount`) in a six-hour cache. `total` is a query result estimate before local card/variant matching; `acceptedCount` is only the inspected page, not a marketplace-wide exact count. Show these as separate, qualified values with fetch time; the existing cached response needs no extra Browse search call. |
| eBay available copies | One offer can list multiple units. Browse item detail may expose remaining/estimated quantity, but looking up every matched item adds item-detail calls, may omit quantities, and still would not establish marketplace-wide stock beyond the validated search sample. Do not sum listing counts as copies. |
| TCGplayer available listings/copies | TCGCSV supplies catalog and prices, not marketplace stock or listing totals. TCGplayer's documented inventory quantity/SKU endpoints cover the **authenticated seller's own store**, not all sellers. The official API currently says new developer access is not being granted. Do not repurpose a store's inventory as marketplace supply. |

Cost boundary: exposing the already-stored eBay search/sample counts needs no new eBay
call; measuring individual eBay item quantities would add up to one detail call per
inspected listing (up to 100 per current page) unless a lower-cost licensed aggregate is
available. Exact daily sales for either marketplace and aggregate TCGplayer supply require
new, permitted data access. No call/credit budget or UI implementation was approved by
this research alone. Keep missing measures `N/A`, and keep the source date visible.

Primary references: [eBay Browse search](https://developer.ebay.com/develop/api/buy),
[eBay Browse item quantity release note](https://developer.ebay.com/api-docs/buy/browse/static/release-notes.html),
[TCGplayer API access](https://docs.tcgplayer.com/docs/getting-started),
[TCGplayer seller inventory quantities](https://docs.tcgplayer.com/reference/stores_getinventoryproductquantity-1),
[TCGplayer market-price fields](https://docs.tcgplayer.com/reference/pricing_getproductprices-1).
