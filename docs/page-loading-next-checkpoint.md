# Page loading — next staging checkpoint

## Scope and order

The approved sequence is detail-layout tracing and Large/Full placeholders, cold
Metrics/detail data costs, decorative rendering/optional code, then populated-account
and real-device recovery acceptance. This checkpoint implements the independently
verifiable changes below. It does not finish every item or authorize production.

### Detail Typography Stability

Controlled public staging traces separated normal loading, deliberately held fonts
and deliberately held account sessions at 1440/390 pixels. Desktop bounded layout
shift sums were about 0.060–0.067; the large shifts followed font release, whereas
account resolution contributed about 0.00026. These are short lab observations, not
field Core Web Vitals or evidence that every shift has the same cause.

The old proportional Arial fallback enlarged a ten-digit mono sample from 240 to
299 pixels at 40px. Courier New measured 240.039 versus Geist Mono's 240. This
checkpoint uses a locally available fixed-width fallback with matched vertical
metrics and preloads only the two primary Latin web fonts. Other subsets stay
on demand. Text/data still render before fonts or images; no hidden-content gate.
Delayed-font tests verify width retention rather than relying only on preloading.

### Market Card Loading Frames

Large and Full loading states now use card-shaped artwork, title, metric and chart
slots. Singles and Sealed share the same FullMarketCard frame as resolved data;
Large inherits its parent columns. Medium/Text keep their existing row footprints.
Placeholders contain no fictional price or available-artwork claim and expose an
accessible loading status. Animation stops under reduced motion. Tests cover phone
and desktop widths, both themes, large text, and delayed/unavailable artwork.
Variable product names and optional data can still change a finished card's height;
this is not a promise of pixel-identical content for every record.

### Shared Metrics Set Summaries

Read-only profiling found repeated price/momentum work in the Sets and Eras stages.
One request-local summary now feeds both, without changing the publication cache,
median calculations, top-50-per-game table, all-set era membership or null behavior.
Era folding retains binary set-name order, including non-leading sets. There is no
schema migration, ingestion work or new daily job.

The actual service over the same repaired staging dataset returned an exact payload
match (excluding the independently generated timestamp): 13 → 12 SQL statements,
901,651 → 756,190 reported D1 rows read, zero rows written. This is about 16% fewer
rows read for this cold service build, not a 16% reduction in total site costs.
One API-adapter run is not a reliable latency benchmark; edge/isolate caches and
database queueing must be reported separately in live verification.

### Auction Decorative Loop Budget

Three lanes remain, each with two identical groups. Group slots cover the viewport
plus two incoming cards: 9/group at 1440px (54 total), 5/group at 390px (30 total),
versus 18/group (108) before. Wider windows receive enough slots to stay covered.
The lane moves exactly one group width, avoiding the former partial-loop jump.
Repeated slots retain the existing ceiling of 18 distinct artworks; the rest of
the sampled pool remains replacement candidates rather than extra downloads.
Offscreen images are lazy, low priority and asynchronously decoded; fixed geometry,
fade-in, thumbnail/original/replacement fallback and reduced motion remain intact.
Artwork sampling remains independent of hidden auction contents. Resizing may
recompose decorative art but cannot resize foreground content.

## Validation and deployment record

Focused tests: delayed fonts, view-specific placeholders, market-scope restoration,
set/era parity including more than 50 sets, responsive loop coverage and artwork
failure handling. Visual review caught inherited transparent artwork in light-mode
Large view and overly broad chart-placeholder sizing; both were corrected and
covered by explicit contrast/height checks before the final gate. The complete
release gate passed: production build, 668 unit passes (one existing skip), lint,
type check and 144 Chromium journeys. The 21 existing complexity warnings remain;
none was added. Live checkpoint results will be recorded after deployment.
Staging must preserve its existing compact-catalog flag,
identity/save bindings, feature flags and empty remote schedule. No new catalog
refresh, account mutation, daily regeneration, migration or production deployment.

## Still open, in order

1. **Detail Candidate Projection:** similarity scores every game item, including
   low-score fallbacks, while global peer quartiles depend on the complete rarity
   cohort. Do not simply filter by name/rarity. Characterize exact top-eight IDs,
   tie ordering, Riftbound printing pairs, set ranks and nulls; then consider a
   lightweight game projection plus hydration of selected records. Retain the
   current publication/database-isolated cache until exact parity and read/byte
   measurements justify replacement.
2. **Optional Module Budget:** trace built route chunks and interaction timing,
   then split genuinely optional editor/share/marketplace code. Reserve loading
   space and include an accessible failure/retry path. Do not defer primary market
   values or use banned route-level loading files. No speculative broad rewrite.
3. **Populated Account Acceptance:** extend isolated fixtures with many private
   holdings/imports/favorites and pending saves. Measure DOM/pagination and owner
   changes without reading or modifying a person's real holdings. A fixture does
   not establish live cross-device correctness.
4. **Physical Recovery Acceptance:** use a disposable account on desktop Chrome
   or Firefox and phone Safari. Follow the existing recovery runbook: offline edit,
   stale revision on device B, response lost after accepted write, reopen, wrong
   owner, expired session and export. Confirm no duplicated money/inventory and
   retained drafts. Human device participation is required; Chromium simulations
   and local unit tests must not be labeled physical Safari verification.

The implementation approach is incremental: first measure the cause, change one
shared boundary, retain exact output/control contracts, and compare under the same
conditions. A larger rewrite could consolidate more code but would combine cache,
ranking, routing and account-recovery risks before those boundaries are pinned.
