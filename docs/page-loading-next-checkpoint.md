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

0. **Full View Resize Containment:** live checks exposed an intermittent
   resolved-row problem, separate from the new loading frames. After a 1440 → 390px
   resize, Singles/Sealed can retain a roughly 1,158px-wide `.signal-card-wrap` and
   overflow the page. Fresh 390px loads fit the page; Sealed's small chart toolbar
   also deserves a local fit check. The resolved-row rules/wrappers were not changed
   in this checkpoint. An existing containment problem is the current inference;
   no old-version browser comparison was performed. Add a real FullViewCardWrap resize regression (the new
   skeleton fixture is not that wrapper), then test explicit zero-minimum grid
   tracks/children and compact chart toolbar wrapping. Do not hide page overflow
   to conceal inaccessible controls. This newly measured UI issue comes before
   deeper candidate/bundle changes.

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

## Live staging result

Pushed application `8e47480`; staging version
`6d543053-9d03-42c4-8987-22ece13e26be` at
<https://raw-signal-staging.raw-signal-watch.workers.dev>. All prior plaintext flags,
secret binding names, identity/save databases and limiter/storage namespaces were
preserved. Remote staging schedules remain empty; production's deployment is unchanged.
No migration, catalog refresh, account sign-in, real bid/sale or daily regeneration.

The compact catalog still reports database source, 1,583 printings and 128 null
prices with the previous parity-approved content version. Invalid/mismatched
versions still return 400/409. Nine public page families were checked at 1440/390
pixels and in both themes: HTTP 200, zero application non-GETs and zero page errors.
Most layouts fit; the recorded Full-view resize failure above means this is **not**
an all-pages responsive acceptance pass. It reproduced separately in Singles and
Sealed, and intermittently in the full matrix. Fresh phone loads were checked
separately. Play → Inventory → My Showcase → Play retained the same background
and issued zero additional catalog downloads. Existing account/recovery Chromium
fixtures passed the gate; this is not physical Safari or populated live-account proof.

The same six-case typography trace was repeated. Normal desktop bounded shift sum
was about 0.0008 versus the earlier 0.063; normal phone was about 0.0004 versus
0.0014. With fonts deliberately held until 1.8 seconds after the primary price,
desktop still shifted about 0.053 versus 0.067 before, and phone remained about
0.0014. Therefore early font delivery improves the ordinary load, but does **not**
eliminate the late sans-font swap. These one-per-case lab observations are bounded
layout-shift sums, not field Web Vitals or a guarantee for every title/font/device.

Ten unique-query HTML requests were edge MISSes. First observed Metrics build
total was 2,806ms; the next four had only the total stage at 23–31ms. Sets first
total was 904ms, then 21–24ms. The earlier release observed 1,314ms cold Metrics;
these separate samples have uncontrolled database/isolate/queue state. **No cold
latency improvement is claimed.** The exact-output 16% row-read reduction is valid
for the measured actual service; cold Metrics remains a performance priority.
Concurrent stage timings include queue time and must not be added together.

Private evidence: `outputs/next-loading-*`, `outputs/detail-layout-trace-after.*`
and `outputs/loading-followup-live-next-checkpoint.json`. Deployment settings and
diagnostic data remain ignored; do not publish private configuration evidence.

## Next iteration — Full View and cold query work

### Full View Resize Containment

The real `FullViewCardWrap` regression failed before the fix. Its grid used an
implicit minimum track size, so an offscreen `content-visibility` row could retain
its warmed desktop width. Both the shared outer grid track and wrapper now permit
zero-minimum sizing. Mobile Full-view chart toolbars/readouts/range groups may wrap
instead of pushing controls beyond the card. Sealed history/metric tiles use the
full mobile row beneath the identity, matching Singles instead of clipping large
prices in the artwork-side column. No page-level overflow hiding or
artwork cropping. Eight focused cases pass repeated 1440 → 390 → 820 → 320 →
1440 → 390 resizes, both themes/text sizes, chart clicks, favorites and null prices.

### Metrics Eligibility Reuse

Read-only paired trials found SQLite repeated Movers' eligibility joins for the
7/30/90-day branches. Materializing that request-local SQL CTE once retains the
same eligible rows, floors, window rules and ranking. Across three alternating
trials, reported reads were 274,311 → 206,015; SQL durations were roughly
261–356ms before versus 150–203ms after. These samples do not force cold D1.

The breadth query separately uses a composite printing/condition key rather than
two OR branches; explicit game/kind ordering retains its previous display order.
This is deliberately not a global join rewrite: that candidate worsened Movers'
reads in testing. An aligned-window experiment had mixed timings and no read
reduction, so it was not implemented. No index, migration, new job or write.

The actual combined Metrics service matches the previous full payload, excluding
only its generated timestamp: 12 statements remain, with 756,190 → 669,458 rows
read (about 11.5% fewer than the previous checkpoint; about 26% fewer than the
901,651 original baseline). Every measured statement wrote zero rows. Cold live
latency still needs observation; row savings are not a total site cost percentage.

### Detail Candidate Projection

Singles retain all game candidates, all comparison prices, identities, printings,
artwork and original candidate ordering. The projection omits source URLs, sealed
MSRP and sealed type; the target's existing point read supplies its output fields.
Sealed keeps its original full reader. There is no additional query, global-peer
narrowing, top-eight heuristic or weakened publication/database cache boundary.

Regression parity covers similarity ties and fallback candidates, nulls, target
links, exact printings, all-game versus set peers, Riftbound global pair averages,
sealed data, database isolation and publication invalidation. The actual reader
matched complete original output for three representative staging details:

| Detail | Statements | D1 rows before → after | Decoded SQL-result JSON before → after |
|---|---:|---:|---:|
| Pokémon single | 9 → 9 | 49,650 → 35,082 | 8,011,366 → 5,763,905 bytes |
| Riftbound single | 9 → 9 | 24,827 → 23,244 | 1,183,047 → 884,310 bytes |
| Pokémon sealed | 7 → 7 | 9,895 → 9,895 | 1,774,330 → 1,774,330 bytes |

These are operator-process service reads against the unchanged staging dataset,
not HTTP page bytes, heap measurements, production traffic or field speed claims.
No account records, daily lineups, market refresh or upstream paid service was used.

### Release gates / remaining priorities

The final complete gate passed on 2026-10-22: production build, 670 unit passes
(one existing skip), lint/type check and all 152 Chromium journeys. The 21 existing
complexity warnings remain, with none added. Visual review and focused tests include
readable large Sealed prices, real wrappers/charts and matching loading frames.
Live release results will be recorded below. Staging-only deployment must preserve the already-enabled compact catalog,
identity/save/limiter bindings and empty cron; production stays unchanged.

Next: Optional Module Budget with real built-chunk evidence and retryable loading,
then populated owner fixtures and the physical recovery runbook. Deliberately late
sans fonts and cold Metrics latency remain open measurements, not solved by these
query changes. Physical Safari/second-device acceptance requires human participation.

**Deferred at the user's request, 2026-10-22:** no iPhone/iPad with Safari is
currently available. Retain the physical recovery runbook for a later device
session; this does not block the current staging checkpoint. Automated Chromium
coverage does not complete this acceptance item.

Private trial evidence is ignored under `outputs/metrics-*-trial.json`,
`outputs/detail-projection-trial.json` and `outputs/next-loading-metrics-tuned.json`.

### Live release observation — 2026-10-22

Validated application `da672ba` was pushed and deployed to staging version
`dc2949f8-c488-4eff-beb5-bac7eff20841` at
<https://raw-signal-staging.raw-signal-watch.workers.dev>. Remote verification
confirmed the existing bindings and compact-catalog setting were preserved,
staging cron remains empty and production's deployment is unchanged. No migration,
ingestion refresh, account mutation, daily regeneration or production deployment.

The first unique-query Metrics HTML request after release observed a 1,760ms
server build (2,617ms end-to-end); the next four reported 19–22ms server totals.
Sets observed 699ms first build, then 19–20ms. All ten were HTML edge MISSes;
underlying payload/database/isolate caches were not forcibly reset. The previous
checkpoint's first observed Metrics total was 2,806ms, but these uncontrolled
samples cannot establish a repeatable cold-load speedup. Concurrent stage timings
include queueing and must not be summed. Exact-result row-read savings remain the
controlled evidence for the query changes.

Private release evidence: `outputs/resize-projection-server-probe.json` and
`outputs/resize-projection-staging-release-*.json`. Configuration evidence stays
ignored and must not be published.

Strict live layout acceptance passed for nine public page families at 1440/390px
and in dark/light themes (36 captures), including desktop-to-phone resizing of
resolved Singles and Sealed Full views. All returned HTTP 200, with zero page
errors, horizontal-overflow failures or application non-GET requests. The former
Full-view resize failure did not recur. This covers the measured matrix, not every
catalog record or browser. Focused real-wrapper fixtures also exercise 320px,
large text and actual chart/favorite controls.

Compact catalog verification retained database provenance, 1,583 printings,
128 null prices and the prior parity-approved content version; malformed/stale
versions still returned 400/409. Play → Inventory → My Showcase → Play retained
the same background element and downloaded no additional catalog data. No auction
was started and no real account was signed in. Live browser evidence is
`outputs/loading-followup-live-resize-projection.json` and matching screenshots.
