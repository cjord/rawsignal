# Detail-page sales volume — 2026-10-09

Implemented on `feature/set-rarity-heatmap`; not deployed. Scope: individual card and
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
