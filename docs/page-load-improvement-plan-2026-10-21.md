# Page-load improvement plan — 2026-10-21

Status: the prior staging-verified Market Scope changes were promoted to production
first; the new loading batches were subsequently pushed and deployed to staging
as `cfc591b` / `01a13354`. No compact-catalog activation, data repair or schedule
change was performed. [Live staging results and remaining priorities](page-loading-staging-results-2026-10-21.md).
Progress and validation are recorded in
[loading batch implementation](page-loading-batches-progress-2026-10-21.md).
Earlier measured baseline: [staging reassessment](market-scope-staging-reassessment-2026-10-21.md).

## Recommendation

Keep the deployed single-mount Market Scope fix. Next remove wrong-scope body
rendering, reduce server work on cache misses, and deduplicate public game catalog
loads. Make artwork geometry stable without making it a prerequisite for data.
Do not start with a framework rewrite, a new cache service or a larger bootstrap
response mixing public prices with private account documents.

Two distinct outcomes matter: **earlier useful content** and **less movement**.
A stable skeleton alone does not make a slow database fast. Conversely, a fast
first paint does not make a page pleasant if its content is then replaced.

## Ranked work

| Order | Feature name | Evidence / reason | Expected benefit | Relative scope |
|---|---|---|---|---|
| 1 | Scope-Stable Page Body + Leaderboard Loading Geometry | Sets mobile 6.58 s, CLS 0.512; Cards mobile CLS 0.203 | Avoid wrong content/duplicate rendering and movement | Medium |
| 2 | Publish-Version Payload Cache + Detail Data Loader | Metrics MISS 2.62 s vs reload HIT 0.37 s; detail queries vary substantially | Faster first/uncached visits, fewer repeated public reads | Medium–large |
| 3 | Shared Game Catalog Loader + Shared Freshness Read | Showdown still makes 22 feeds; Sealed repeats freshness | Remove known repeated requests/parsing with limited risk | Small–medium |
| 4 | Stable Auction Card Backdrop | Failed art shortens scrolling groups; 108 initial image nodes from 18 unique URLs | Less movement, decoding/bandwidth/DOM work | Small–medium |
| 5 | Versioned Auction Catalog rollout | Eleven feeds on direct inventory/showcase entry; implementation exists but is disabled | Smaller repeat/direct-entry catalog work | Medium; blocked on readiness/parity |
| 6 | Route-Specific Startup Budget | Roughly 0.6–0.7 MB decoded JS on representative pages | Better mobile startup after confirmed unnecessary code is split | Investigation-led |

Numbers are individual staging lab observations, not production averages or a
prediction of seconds saved. Cached and uncached requests must be compared apart.

## 1. Scope-Stable Page Body / Leaderboard Loading Geometry

1. Reuse the current URL codecs to seed validated explicit scope into Sets and
   Metrics server rendering. Seed Product Type, supported market and view-affecting
   parameters consistently; the client's first render must agree with the server.
   Do not create a second, slightly different scope parser.
2. For bare URLs whose market lives only in localStorage, render the stable shell
   and a bounded neutral body until the existing scope restore resolves. Do not
   mount all market charts/set lists and then remove most of them. Preserve a
   useful no-JavaScript/SEO fallback without exposing incorrect interactive content.
   Prefer explicit scoped navigation links once browser scope is known; do not
   introduce preference cookies/account synchronization merely for this fix.
3. Reserve responsive heading/count/as-of/filter-summary slots and match row
   skeleton anatomy to Large/Medium/Text/Full final content where supported.
   Do not reserve a whole-page blank area or wait for all rows/images.
4. Render prices/names independently of artwork; preserve existing N/A, error and
   empty states and retain focus through data replacement.

Acceptance: one correct initial scope and one mount; no All-market flash for a
scoped URL; Back/filter/view restoration unchanged; substantially lower bounded
CLS with the eventual goal ≤0.1 in representative desktop/mobile tests. Do not
claim that hiding content alone improves useful-data readiness.

Source: `app/sets/page.tsx`, `app/metrics/page.tsx`, `app/SetsView.tsx`,
`app/MetricsView.tsx`, `app/state/`, `app/leaderboard/`, owning CSS sheets.
Reserving responsive space follows [layout-shift guidance](https://web.dev/articles/optimize-cls).

## 2. Publish-Version Payload Cache / Detail Data Loader

1. Add stage timings and safe query metadata: series, sets/EV, movers, peers,
   enrichment, serialization and cache lookup. Log duration/counts, never user
   documents, credentials or arbitrary SQL values. Browser timing alone cannot
   identify the slowest SQL statement or rows read.
2. Inspect expensive reads with EXPLAIN QUERY PLAN and existing indexes. Narrow
   product detail's game-wide peer reads to the candidates/aggregates actually
   required, using behavioral fixtures to prove related/chase/peer results stay
   identical. Assess any index through measured read/write/storage trade-offs.
3. Reduce repeated trips and work. Batch compatible read-only statements where
   appropriate; overlap independent request/processing stages where beneficial.
   Sets already uses Promise.all for its main queries. D1 executes one database's
   queries serially, so more Promise.all calls are not equivalent to parallel SQL.
4. Add bounded public service-level memoization and in-flight coalescing keyed by
   the full relevant publication identity, schema/config/pull-rate version, and
   actual scope dependencies. Reuse unfiltered aggregate payloads across equivalent
   page/query variants, then apply the correct view scope.
5. Preserve existing HTML/RSC negotiation and URL keys. A public payload cache is
   not permission to collapse different rendered pages into one HTML cache entry.
   Retain invalidation at relevant publish/deploy boundaries and the current
   bounded signature freshness; evict failed builds and bound memory to recent
   versions. Failed reads must not permanently poison a cached promise.
6. Handle publication changes during building: do not label a mixed result as a
   newly complete snapshot. Preserve readiness checks and existing unavailable
   behavior. Cache public market payloads only; never sessions/favorites/holdings.

Keep layering: shared pure key helpers may live in `core/`; D1 readers/cache
utilities live in `db/`. Do not import `worker/page-signature.ts` upward into
`db/`. Reuse/extract the publication reader through the allowed dependency direction.

Acceptance: identical figures/N/A/model and peer-selection semantics; fewer
duplicate reads for concurrent same-version requests; bounded invalidation/retry;
measured MISS improvement as well as HIT improvement. Add indexes only through
the normal hand-written migration/backup/release process if justified. Materialized
aggregate tables are a later option, not required for the first iteration.

Sources: `db/metrics-service.ts`, `db/sets-service.ts`,
`db/catalog-repository.ts`, `app/data/load-detail.ts`, `worker/edge-cache.ts`.
[D1 concurrency](https://developers.cloudflare.com/d1/platform/limits/) and
[index verification](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
support reducing work/trips rather than assuming unlimited query parallelism.

## 3. Shared Game Catalog Loader / Shared Freshness Read

Reuse/extract the existing public in-memory loader instead of adding another
fetch cache. Share one in-flight eleven-section load between public Riftbound
catalog consumers across account-owner remounts; continue to reset all personal
progress by owner. A subscriber leaving must not abort a load still needed by
another consumer. Keep the last valid catalog, explicit retry, bounded age and
existing section/null/printing semantics. Do not relabel independent legacy feed
arrays as an atomic versioned snapshot.

Coalesce `/data/freshness.json` similarly so Home and Sealed do not request it
independently. Its timestamp is not a catalog content version. Empty inventory/
showcase pages should display useful owner-resolved empty states before requiring
the whole catalog, while keeping any catalog-dependent edit/sale actions gated.

Acceptance: Showdown one batch of eleven instead of two; Sealed two feed requests
(catalog + freshness) instead of three; account switch/conflict tests still pass;
no per-round catalog calls. Measure parsing and transfers, not just request count.
HTTP-request reductions are not automatically identical billed Worker/D1 savings.

## 4. Stable Auction Card Backdrop

Allocate stable per-slot and per-loop-group geometry. Replace failed art in place
with a valid alternate/fallback; do not filter it out and shorten the conveyor.
Use stable slot keys. Keep three rows, varied artwork, seamless repeat groups,
fade-in, reduced motion and natural artwork proportions.

Evaluate smaller verified artwork variants and correct placeholder detection.
Only then reduce redundant offscreen eager image/decode work, maintaining enough
content for a seamless wide-screen loop. Repeated URLs already coalesce/cache;
108 image elements do not imply 108 unique downloads. Do not require every
decorative image to load before revealing the page or starting an auction.

Acceptance: stable group/slot rectangles with delayed/failed/placeholder art;
no blank loop gaps across wide/mobile layouts; lower bounded backdrop shift and
decoded bytes, with shared-shell navigation/background retention preserved.

## 5. Versioned Auction Catalog rollout

Do not rebuild the existing manifest/body/digest implementation. First resolve
staging's published-catalog readiness mismatch through an explicitly authorized,
backed-up data repair. Then verify exact catalog parity, including printings,
null prices and regular-rarity artwork; compare cache-off/on using the same complete
source. Do not bypass completeness checks or silently downgrade to a feed.

Activate only the existing staging flag after parity passes. Test publication
races, corrupt payloads, stale/offline failure, last-good display, changed sale
quotes and frozen active/daily/retained-draft prices. Browser memory reuse first;
bounded IndexedDB persistence is a separate later step with schema/quota/corruption
handling. No account data enters this cache. Production activation needs a
separate rollout decision; the current flag intentionally refuses production.

Expected transport shape: one manifest plus one payload on a fresh version;
no payload on an unchanged in-memory version when a check is due. A full reload
cannot reuse in-memory payloads until persistent storage is deliberately added.
Do not promise one-request reloads from the existing memory-only implementation.

## 6. Route-Specific Startup Budget

Use bundle/network/CPU traces to find code actually loaded before useful content.
Split optional inspectors, editors, inactive views and below-fold charts only
when the trace shows a material cost. Reuse loaders/skeleton dimensions and avoid
new request waterfalls. Keep primary prices/names and visible charts responsive;
do not manipulate LCP by hiding meaningful content or stripping features.

Avoid a large rewrite, framework upgrade or new client-cache dependency until
the smaller fixes are measured. Preserve the current ban on route-level
`loading.tsx`; use supported in-page loading states.

## Implementation batches and verification

1. **Public-page pass:** scope-stable bodies and loading geometry, each with tests.
2. **Data-work pass:** stage/query instrumentation, then targeted service/detail
   optimizations in separate changes. Do not mix an unmeasured schema rewrite in.
3. **Game-loading pass:** shared public catalog/freshness and stable backdrop slots.
4. **Gated follow-up:** repaired staging data/parity, compact catalog activation,
   then optional persistence and trace-justified bundle splitting.

At each step: narrow unit/browser tests, then full release gate before any
requested push/deployment. Compare at least five visits per representative case
with browser-fresh, repeat and internal navigation reported separately; distinguish
edge HIT/MISS and never invent a cold server or percentile from a tiny sample.
Retain prior readiness measurements for comparison and additionally separate
public-read-ready, account-write-ready, market-ready and artwork-ready times.

Check desktop/mobile and both themes, explicit/bare URLs, Back, delayed auth,
account switches, unavailable APIs, stalled images and empty/populated datasets.
Private Collections/account/admin workload and physical Safari remain coverage
gaps; synthetic guests cannot establish their performance. Production browser
access is a separate Cloudflare-policy issue, not a reason to extrapolate staging
numbers as production results.

No initial optimization needs a new ingestion schedule or upstream price calls.
Do not wait for all artwork, publicly cache account data, relax catalog safety,
or preload every route. Data repair is availability work, not a speed improvement.
