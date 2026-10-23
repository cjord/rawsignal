# Page loading batches — implementation progress, 2026-10-21

## Production promotion first

The user's request first promoted the already-pushed, staging-verified application
from `be40c34` (documentation at `0c94038`) to production version
`cd4d0160-61c4-4b54-8ccc-c7ea170a5883`. It used the same successful full-gate build
and assets as the staging release, before any new loading implementation began.
Existing production feature flags, secrets, market/save and shared identity
bindings, custom domain and `*/1` ingestion schedule were preserved; staging's
deployment was verified unchanged. No migration, manual ingestion, WAF change,
test email or account/game write was made. Collections activation was not changed.

Read-only checks of production Cards, Sets and the session endpoint returned the
existing Cloudflare 403 challenge from this computer. Deployment/version/binding
verification passed, but custom-domain application rendering remains unverified
from this connection. The challenge is not presented as a passing browser test.

## New work: implementation batches

Subsequently pushed as `cfc591b` and deployed to staging `01a13354` on the user's
next request. The implementation notes below retain their original local-gate
context; [live staging results and remaining work](page-loading-staging-results-2026-10-21.md)
supersede the not-deployed status. Production remains on the earlier promotion.

### Batch 1 — Scope-Stable Page Body / Loading Geometry

- Split the existing Sets/Metrics codecs into pure `app/state/*-scope.ts` modules,
  retaining compatibility re-exports in the browser-hook modules. Server/client
  use the same parsing rules; duplicate query values use first-value semantics.
- Server routes seed valid explicit market/product/view scope into the initial
  view. Invalid/absent market does not guess at device-only memory.
- Known content and hydrated controls have separate readiness boundaries. Native
  disabled controls/fieldset prevent lost pre-hydration clicks while the correct
  body remains visible. Native navigation links and the no-JS market links remain
  usable; account loading is not used as this hydration gate.
- Bare/invalid URLs use a neutral in-page scope shell until browser restoration,
  without mounting All-market set lists/charts first. No-JS visitors receive
  explicit market links. No route-level loading files or preference cookies.
- Mobile leaderboard header/date/count slots and Medium/Text row skeleton heights
  reserve more appropriate space in the owning shared styles. Large/Full loading
  geometry and richer dataset-specific tuning remain candidates after visual traces.

### Batch 2 — published public reuse / data stages

- Added a bounded, DB-isolated public payload cache: four configuration/version
  entries per database, 60-second maximum entry age, in-flight coalescing,
  failed/null-result eviction, and verification before retaining a built result.
- The cache checks current publication metadata on entry. Active ingestion or
  unavailable/missing metadata bypass reuse; a publication change/ingestion start
  detected during a cached build rejects that result rather than pinning it.
  Each metadata check includes a small active-run existence check. This is not
  a persistent snapshot table or a claim that existing multi-query reads become
  globally transactional. Metadata failures bypass reuse before building.
- Sets directory and Metrics payloads use this shared utility. Pull-rate/config
  contents participate in the Metrics key. Private/account documents never do.
- Moved publication-key reading below Worker orchestration into `db/`, keeping
  existing Worker exports/behavior. No `db/` → `worker/` dependency was introduced.
- Independent Metrics requests are started together; independent detail metadata,
  graded and peer-anchor reads are coordinated together. D1 SQL still executes
  serially within a database: the intended gain is fewer client-side waterfalls,
  not an assertion of parallel SQL execution.
- Added caller-owned Metrics stage timings, Sets total/directory timings and safe
  `data-server-timing` attributes, analogous to existing product-detail diagnostics.
  A cached HTML timing describes its original render, not a later cache HIT.

No new indexes, migrations, materialized aggregate tables or source API requests.
Cold paths add bounded publication-verification reads; hits replace expensive
payload rebuilding with metadata lookup. Actual D1 rows, latency and price parity
must be compared on staging before claiming a net cost/time saving. During active
ingestion reuse is deliberately bypassed, so benefits will depend on workload.
Narrowing game-wide detail peer queries and improving the older game-row memo key
remain open; their semantic impact needs dedicated related-card fixtures.

Read-only staging EXPLAIN inspection of seven statements captured from the actual
detail repository confirmed existing primary-key/index searches for product,
game, set, metric, enrichment, graded and observation access. The set-metric lookup
also uses a correlated subquery/temp sort; peer-anchor aggregation uses a temp
grouping structure. An index search can still retrieve a large whole-game range;
these plans do not provide execution durations or rows scanned. No blanket new
index is justified by this evidence. Prefer measuring/narrowing those ranges and
reusing aggregates. Evidence: `outputs/page-loading-query-plans-2026-10-21.json`.

### Batch 3 — public game catalog / freshness / backdrop

- Practice Showdown reuses the existing public Riftbound legacy catalog store,
  including its bounded age, timeout, retry and last-good behavior. Account
  progress still remounts by owner; a consumer unmount does not cancel another
  consumer's shared load. No new fetch-cache dependency or persistent storage.
- Freshness reads share one bounded in-flight/public date store. Invalid dates
  and failures cannot replace last-good source dates or invent today's date.
  Last-good refresh checks happen on the next subscribed mount after expiry,
  not through a new background polling schedule.
- Auction Backdrop reserves eighteen stable slots per repeat group before load
  and after artwork rejection. Replacement candidates come from a bounded
  thirty-six-image decorative sample, not hidden lots. Keys and image boxes stay
  stable; replacement images must decode before fading in. Three lanes and the
  existing reduced-motion behavior remain.

The target is one eleven-feed practice batch and one shared freshness request,
not a claim that HTTP count equals billed Worker calls. The legacy feed arrays
are still independent responses, not relabeled as an atomic versioned snapshot.
Smaller verified thumbnails/offscreen decode reduction, empty-inventory early
states and persistent public cache remain follow-ups, not silently completed work.

## Gated work not activated

The compact/versioned Auction Catalog flag remains off. Staging's incomplete
published catalog still requires a separately authorized, backed-up repair and
same-source parity comparison before activation. Production activation is also
separate. No readiness/completeness guard was weakened, no daily snapshot was
regenerated, and active/daily/retained-draft prices were not changed.

Route-specific JS splitting remains trace-led future work; visible pricing/charts
were not hidden to manipulate paint metrics. No full framework/cache rewrite.

## Validation record

The final `npm run check` passed: production build, 662 unit tests (one existing
skip), lint, type check and all 134 Chromium browser tests. Lint retains 21 existing
complexity warnings, with no new warnings. Focused scope/cache/freshness/auction
tests and catalog/metrics/sets parity tests also passed.

Earlier runs corrected two test assumptions (React server-text separators and
the intentional fixed backdrop slot count) and exposed a genuine pre-hydration
click race. Separating visible content from enabled controls fixed that race;
the unchanged Heatmap interaction test passes in the final complete run. A mobile
NPC-history test timed out once in the first run, then passed unchanged in focused
and subsequent full runs. No interaction assertion was weakened to force a pass.

New browser coverage checks actual server-rendered component markup for
explicit/bare URLs, initially disabled controls and stable backdrop loop dimensions
when artwork returns the TCGplayer placeholder shape. Desktop/mobile and
dark/light screenshots were inspected for scoped Sets/Metrics fixtures and the
backdrop; these fixture captures are geometry evidence, not live typography or
speed certification. Representative Singles/Sealed screenshots were also checked.
Existing journeys cover themes, mobile, owner isolation, economic/frozen-price
behavior and shared navigation. The local fixture still emits its pre-existing
missing-history-column diagnostics and Smart Links hydration warnings; the
passing suite is not evidence that those separate issues are resolved.

The original local gate made no live before/after timing claim. The subsequent
staging measurement and ingestion-lifecycle limitation are recorded in the linked
release report rather than extrapolated from tests.
Ignored evidence: `outputs/page-loading-batches-check-verified-2026-10-21.log`,
`outputs/page-loading-*` and normal Playwright test artifacts. Production promotion
of these batches remains a separate release decision.
