# Cold Metrics Performance and Layout Stability — 2026-10-22

## Scope, goals and deferred work

Improve an uncached Metrics build and prevent late typography changes from moving
content. Keep primary prices/text visible independently of artwork, preserve exact
market results and verify shared UI rather than assuming a smaller query is faster.
Staging-only release; production requires separate approval.

Optional Module Budget, Populated Account Acceptance and Physical Recovery Testing
are deferred by the user in [the backlog](todo.md). Existing account/privacy/save
tests still apply. No browser simulation establishes physical Safari acceptance.
No deferred work is implemented or reminder scheduled in this batch.

## Metrics Grouped Medians

Set price medians previously used multiple window aggregates. Sealed category
movement joined and ranked the same population three times for 7D/30D/90D.
The new reader builds ordered numeric groups inside SQLite and selects the same
two middle positions for their mean. Null prices stay outside price cohorts;
each movement window filters its own nulls and an empty group remains null.
Sealed movements retain exact Sealed/Unopened matching; set momentum's existing
variant-only population is intentionally unchanged. No ranking/eligibility change.

Arrays are internal SQL intermediates, not larger API/database records. This still
sorts complete groups; it is not an approximate median. Recheck memory/query costs
as category/set sizes grow rather than assuming unlimited savings. Odd/even,
single-member, duplicate, zero, null, negative movement, colliding game names,
wrong printing/condition and a 1,001-member cohort are covered by fixtures.

Independent sealed-set momentum, pack prices and pull-rate tier reads now start
together after the set list is known. This removes sequential waiting, not queries.
Without curated pull rates the tier query remains skipped. No added ingestion,
upstream calls, migration, account access, cache lifetime or cache-key changes.
Publication changes, busy ingestion and failures retain the existing cache guards.

Three alternating read-only staging trials returned exact ordered query results:

| Query | Rows before → after | Observed SQL execution, before → after |
|---|---:|---|
| Set summary | 241,465 → 176,590 | 160–162ms → 131–135ms, excluding a 1,238ms initial outlier |
| Sealed categories | 74,030 → 22,734 | 52–61ms → 15–16ms |

The actual full service retained its complete output (excluding `generatedAt`):
12 statements, 669,458 → 553,287 rows read, approximately **17.4% fewer** than the
previous checkpoint. Zero rows written. These are same-dataset operator-adapter
measurements, not forced-cold D1, production speed, memory or total site-cost claims.
Do not add concurrent stage durations together; they include queueing/waiting.
A later full-service repeat still observed a 1,116ms set query despite the lower
read count; this reinforces that the latency tail is not eliminated or controlled
by these query changes. The live release must report observed timings separately.

## Stable Sans Delivery

The local sans fallback used one regular face across label weights. Measurements
showed identical fallback widths at 400/600/750/850 while Geist advances varied.
Weight-specific regular/bold fallbacks substantially improved a representative
single detail. Broader tests still found a sealed title changing line count:
fallback metrics alone cannot match every string at every wrapping threshold.

Sans faces therefore use `font-display: optional`. Prompt/cached Geist remains
preferred; if it misses the brief initial font window, already visible text keeps
its readable fallback for that visit instead of rewrapping later. Slow first visits
can look slightly different from cached visits. This is an intentional typography
tradeoff, recorded in [the design baseline](design-baseline.md), not invisible-text
loading. There are no additional downloads/preloads or image/font readiness gates.
Mono retains swap with its already matched fixed-width fallback. Other platform
fonts can differ; this is not a promise of pixel-identical fallback typography.

Delayed-font regressions cover Singles/Sealed detail and leaderboard surfaces at
1440/390px, then both themes with large text, visible settings and overflow checks.
They require small bounded shift and stable primary-content position. Actual
font delivery and cached use must also be checked on staging before acceptance.

## Implementation and release risks

- **Wrong numbers:** compare full service output; retain median/null, exact printing,
  top-set membership, ties, pack EV and all-game era contracts. Do not narrow data
  to make the query look cheaper. No signal/price model changes.
- **Stale/mixed/public-private data:** publication/database/configuration cache keys,
  completion guards, retry behavior and account isolation stay unchanged.
- **Shared layout:** inspect detail titles/actions, Cards/Sealed filters and Full
  views, Metrics/Sets headers, navigation and Auction Hub. Check dark/light,
  desktop/phone, large text, direct navigation and retained internal navigation.
- **Failure behavior:** missing artwork/prices and delayed/failed fonts must not
  block primary content. No clipping, hidden page overflow or fixed-height prose.
- **Performance claims:** compare cold/reused requests separately; report cache
  state and uncontrolled D1/isolate effects. Measure load and interaction, not only
  bytes/row counts. Small lab samples are not field Web Vitals.
- **Deployment:** full release gate, exact-source push, staging settings/binding
  preservation, no cron and production unchanged. No database writes/migrations.
  Keep the previous deployment as the code rollback option; do not reset data.

## Validation and live release

The complete release gate passed: production build, 672 unit passes (one existing
skip), lint/type check and all 160 Chromium journeys. The 21 existing complexity
warnings remain; none was added. Focused query/cache/style checks and delayed-font
tests passed, including the sealed-title regression that failed during fallback-only
experiments. Local legacy-D1 fallback diagnostics remain separate from actual
database-backed staging parity; no local schema repair is included in this batch.
Live staging outcomes will be recorded after deployment. Production is not in scope.

Private evidence stays ignored: `outputs/metrics-grouped-trial.json`,
`outputs/next-loading-metrics-grouped.json`, `outputs/font-weight-trials.json`
and `outputs/font-stability-focused.log`.
