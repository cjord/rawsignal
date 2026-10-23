# Site load review — 2026-10-21

## Conclusion

The main weaknesses are cache-miss server work on Metrics and product details,
Market Scope restoration on Sets, repeated catalog loading in Price Showdown,
and direct-entry loading/layout stability across Auction House pages. Repeat
visits are substantially faster. Navigation within the Auction Hub is already
working well and should be preserved.

There is also a separate staging availability failure: today's Daily Showdown
cannot initialize because the published catalog fails its completeness gate.
This is not an image-loading delay or a reason to bypass that gate.

## What was measured

- Live staging, not a local development build. Production returned Cloudflare's
  403 “Just a moment…” challenge to the isolated test browser; no WAF changes or
  challenge bypass were attempted. These timings are **not production timings**.
- 28 representative URLs covering every public page family, plus an archived
  shared-results fixture; seven admin URLs were checked for their access gate.
  Every catalog ID was not tested. No opted-in public player profile was returned
  by staging's showcase directory, so an actual public profile remains unmeasured.
- 76 page-load samples: 56 broad-pass fresh/reload samples, 12 follow-up samples,
  six simulated-mobile samples, and two archived-results samples. Six additional
  Auction Hub transitions and three browser-only background experiments.
- Desktop: Chromium, 1440×1000, unthrottled. A fresh browser context followed by
  reload, with normal browser HTTP caching enabled. Edge/isolate/database cache
  state was uncontrolled; HIT/MISS headers were recorded where available.
- Mobile simulation: 390×844, 100 ms added latency, 1.6 Mbps download, 750 Kbps
  upload, 4× CPU slowdown. This is not a physical Safari/Chrome device test.
- Isolated guests only. No sign-in, account editing, auction entry, bid, sale,
  import submission, or answer submission. Optional eBay listing requests and
  known account write/auth-action endpoints were blocked. Product-detail timings
  exclude loading the optional eBay panel after scrolling.
- “Usable” means representative content/control readiness and account bootstrap
  resolved, not every artwork loaded. Observers continued for two seconds after
  that point. A readiness timeout was not counted as a zero-second load.
- LCP and session-window CLS were observed within that bounded interval. These
  are small laboratory samples, not field p75/p95 or a complete interaction test.
  No INP claim is made. Typical Web Vitals good thresholds are LCP ≤2.5 seconds
  and CLS ≤0.1 at the 75th percentile of real visits; use these as warning signs,
  not a field pass/fail certification ([Web Vitals](https://web.dev/articles/vitals)).

The currently pending local Market Scope changes were **not deployed** and were
not included in the live timing results. No application code, hosting settings,
database records, pushes, or deployments were changed for this review.

## Desktop page coverage

Seconds from navigation start to the readiness marker in the initial broad pass.
One fresh/reload pair per row: not averages. Fresh browser does not necessarily
mean a cold server. Rows marked with a gate or empty state do not represent the
signed-in/full-data workload.

| Page / state | Fresh browser | Reload | Main finding |
|---|---:|---:|---|
| Cards — Riftbound | 3.57 | 1.59 | Account/Market Scope bootstrap, repeated catalog requests |
| Cards — Pokémon | 3.82 | 1.89 | Same bootstrap; larger selected catalog batch |
| Sealed — Riftbound | 4.32 | 1.54 | Ten feed requests, including unnecessary Singles work |
| Sealed — Pokémon | 3.62 | 1.74 | Same duplicated/cross-mode loading pattern |
| Sealed — One Piece | 4.22 | 1.67 | Same shared-shell issue |
| Sets directory | 5.84 | 1.65 | Server MISS plus severe Market Scope layout changes |
| Riftbound set — Origins | 4.28 | 1.30 | Server aggregate work on cache miss |
| Pokémon set — discovered directory link | 4.19 | 1.41 | Same set-detail path |
| Metrics — Singles | 7.82 | 1.33 | Slow server MISS; Market Scope changes |
| Metrics — Sealed | 6.95 | 1.34 | Slow server MISS |
| Card detail — representative product | 7.06 | 1.53 | 3.39 s measured detail data work on MISS |
| Sealed detail — representative product | 6.07 | 1.59 | 2.51 s measured detail data work on MISS |
| Buy List — empty guest | 2.94 | 1.39 | Mostly shared client/account bootstrap; populated list untested |
| Collectr Import — empty guest | 3.59 | 1.31 | Bootstrap; actual import matching/upload untested |
| Collections — guest sign-in gate | 2.97 | 1.26 | Only access gate tested, not holdings/metrics |
| Account — login page | 2.70 | 1.38 | Shared client/session startup; signed-in profile untested |
| Games directory | 3.02 | 1.28 | Shared client/session startup |
| Price Showdown — practice | 4.29 | 1.63 | 22 feed requests: two batches of eleven |
| Daily Showdown | Unavailable | Unavailable | Daily API 503; no playable round |
| Auction Play | 4.66 | 2.06 | Eleven feeds; decorative artwork and wallet settling |
| Auction Inventory — empty guest | 3.95 | 2.10 | Loads full catalog even with empty inventory |
| My Showcase — empty guest | 3.93 | 1.89 | Catalog load plus moving backdrop geometry |
| Profile Preview — guest | 4.21 | 2.40 | Same dependencies; signed-in profile untested |
| Auction Guide | 3.01 | 1.37 | Little data work; backdrop layout changes |
| Auction Leaderboard | 3.66 | 1.93 | Public API follows account bootstrap; backdrop shifts |
| Public Showcases directory | 4.13 | 2.20 | Empty public directory; backdrop shifts |
| Daily Auction lobby | 3.07 | 1.35 | Lobby only; challenge entry was not clicked |
| Shared Results — invalid-link message | 3.06 | 1.35 | Error-state rendering only, not a valid-results benchmark |

An archived, synthetically encoded Showdown result for the existing October 16
manifest was separately viewed without submitting a score: **1.68 s fresh /
0.76 s reload**. Its reload still recorded 0.142 bounded CLS as result content
replaced the initial state. Auction shared-result variants remain unmeasured.

The seven `/admin` routes returned the expected 303 redirect to `/account` for
guests. Actual audit, account, job, quality, data and moderation tables need an
authenticated benchmark. They have not been declared fast based on redirects.

### Follow-up: what browser versus server cache changes

With fresh browser contexts but already visited server URLs, Sets fell to 3.69 s,
Metrics Singles to 3.41 s, and the Riftbound set to 2.89 s. The initial slow runs
therefore are not a universal visit time, but expose real cache-miss costs.
Auction Play varied 4.66–5.04 s fresh; empty My Showcase varied 2.74–3.93 s.
Repeated visits generally landed around 1.3–2.4 s. More samples and real-user
telemetry are needed before setting percentile budgets from these numbers.

## Causes and proposed improvements

### 1. Public Page Bootstrap / Market Scope restoration

The deployed account wrapper changes its React key from `initial` to guest/owner,
remounting the entire page. Cards, Sets and Metrics each recorded two header
mounts. An account-session request generally started after the client modules
loaded, then took roughly another 0.95–1.05 s; public controls remained inert
while it resolved. A repeat visit still pays that session wait.

Sets had bounded CLS **0.489–0.491 desktop / 0.511 mobile**. Shift sources were
whole `.sets-game` sections, not just a slider. Metrics Singles recorded
**0.077–0.154 desktop / 0.146 mobile**, from its market-card grid/sections.
Mobile Cards also shifted substantially (**0.405**) as headings and controls
changed during restoration.

The pending local Market Scope fix already stabilizes the public wrapper,
resolves URL/device precedence once, avoids hidden Singles loading on Sealed,
and protects account write controls separately. It should remove important
duplicate work, but live improvements have not yet been measured.

**Remaining gap:** Sets/Metrics server routes currently render default All-market
content and do not seed the view from explicit query parameters. Even a neutral
selector cannot prevent the body from changing from All to Riftbound. Pass a
validated explicit URL scope into server rendering. For a bare URL requiring
device-only memory, use a bounded neutral content shell rather than rendering a
large incorrect market first. Preserve indexing, shared links and Back behavior.
Do not move private saves into a public cache or remove owner isolation from games.

Source: `app/account/AccountProvider.tsx`, `app/sets/page.tsx`,
`app/metrics/page.tsx`, `app/SetsView.tsx`, `app/MetricsView.tsx`,
`docs/market-scope-loading.md`.

### 2. Publish-Version Payload Cache for Metrics and Sets

Initial Metrics document first-byte waits were **5.57 s Singles / 4.77 s Sealed**;
reload HIT waits were **0.26–0.27 s**. The Sets directory was **3.47 s MISS /
0.27 s HIT**. The largest delay is before browser rendering, so image changes
alone cannot solve it.

`loadMetricsPayload` awaits metric-series loading and then overview, sets,
sealed categories, eras, momentum and movers serially. Several independent
stages could run together. Sets already parallelizes its seven major queries;
simply applying Promise.all there again is not a useful proposal. Its remaining
work includes catalog-wide aggregation and median window functions.

The Worker caches complete public pages by full URL, negotiation headers,
published-run signature and deployment. That is effective on HIT, but related
query URLs can each rebuild essentially the same aggregate payload on MISS.

Proposed order:

1. Instrument individual query stages and rows scanned/read-only query plans.
2. Parallelize genuinely independent Metrics stages; deduplicate shared set EV work.
3. Coalesce/cache public service payloads by their authoritative publish signature,
   retaining required configuration versions and evicting failed promises.
4. Consider ingestion-time aggregate snapshots only for confirmed expensive work,
   with existing publication/readiness rules and freshness labels preserved.

Do not strip query parameters indiscriminately from HTML cache keys: server-seeded
scope and RSC negotiation must remain correct. Do not add staging ingestion cron
just to improve its benchmark.

Source: `db/metrics-service.ts`, `db/sets-service.ts`, `worker/edge-cache.ts`,
`worker/page-signature.ts`.

### 3. Detail Data Loader

Card/Sealed detail MISS first-byte waits were **4.73 / 3.69 s**. The existing
server timing attributes isolate **3,386 / 2,511 ms** inside detail data loading,
plus about **225–229 ms** for repository setup. These attributes are part of
cached HTML, so the same durations on reload describe the original render,
not a new database execution.

The detail repository loads the product's entire same-kind game catalog for peer
comparisons, plus set-scoped products/metrics, then additional enrichment,
graded/peer-anchor and optional rarity/early-value reads. Some of those reads
are sequential. The samples prove the aggregate data stage is slow; they do not
assign an exact share to each SQL query without further stage instrumentation.

Narrow peer candidate queries, cache reusable game/set aggregates by publish
version, and parallelize independent metadata/graded/anchor reads. Preserve
the exact shared history snapshot, unavailable-data behavior, fair-value model,
same-set/chase selection rules, and natural image ratios. Keep primary price/name
server-rendered; defer only nonessential related sections if necessary.

Source: `app/data/load-detail.ts`, `db/catalog-repository.ts`.

### 4. Shared Catalog Snapshot Loader for games

Practice Showdown starts its catalog hook before account resolution. The owner
remount aborts/restarts it: **22 requests for eleven section feeds**, including
aborted first-batch requests. The current public-market fix intentionally does
not remove owner resets from games, so this needs a separate public catalog
cache/coalescing change, not relaxing account/save isolation.

Auction direct entries make **eleven feed requests**, even for empty inventory
and showcase pages. Its shared in-memory loader already coalesces within one
document for five minutes. It is lost on a full reload; browser caching reduces
bytes but not all request/parse/bootstrap work.

The compact/versioned Auction Catalog path exists but is disabled in staging
after earlier parity problems. Repair and prove parity before enabling it;
then compare controlled cache-on/off measurements. A version-aware public
snapshot cache and small version check could reduce reload costs. Keep private
wallets/progress outside it, preserve valid last-known-price/freshness rules,
and do not change frozen active-auction or daily-challenge prices silently.
Empty inventory/showcase views should not need the entire catalog before showing
their useful empty state.

Source: `app/RiftboundPriceGame.tsx`, `app/data/useCatalogPage.ts`,
`app/data/auction-legacy-catalog.ts`, `app/data/auction-catalog-cache.ts`,
`app/data/useAuctionCatalog.ts`, `core/domain/auction-catalog-snapshot.ts`.

### 5. Auction Card Backdrop stability and artwork cost

Most desktop Auction shift entries came from `.auction-entry-art-group`.
The backdrop creates three lanes with two repeated groups each, initially up to
108 image elements from 18 unique URLs. Repeated URLs are not 108 separate
downloads. All elements are eager; low priority is requested, but originals can
be 1000×1000 for much smaller decorative slots.

A browser-only diagnostic observed groups changing **18 → 17 → 15 cards** and
width **3,924 → 3,706 → 3,270 px** when rejected artwork was removed. That moves
the next group/changes animation geometry. Fading loaded images is already
implemented; opacity alone does not keep the strip's geometry stable.

One controlled exploratory guide-page run measured unexpected shift sums:
baseline **0.139**, fixed group widths **0.020**, hidden backdrop **0.020**.
These sums are not field CLS or repeated performance proof; random art differed
between variants. They support the trace-based diagnosis, not a finished fix.

Keep stable slot/group geometry when a URL fails; replace in place rather than
shrinking the conveyor. Use verified smaller decorative artwork variants,
bound offscreen eager work, and retain reduced-motion behavior and the user's
desired three-lane effect. Failed thumbnail placeholders must still be detected.
Also reserve wallet/statistics/skeleton dimensions: mobile Auction showed
additional movement from the wallet/actions, independent of its backdrop.

Source: `app/games/AuctionBackdrop.tsx`,
`app/games/AuctionPageBackground.tsx`, `app/games.css`.

### 6. Shared client startup and mobile rendering

Representative public pages loaded about **0.6–0.7 MB decoded JavaScript**. This
is not compressed transfer size. Login, Games and empty utility pages all pay
roughly 2.7–3.6 s fresh startup despite modest page-specific data work.
Hashed JS already has immutable browser caching; “enable browser caching” alone
is not the missing solution.

The simulated mobile Sets load recorded about **4.18 s of long-task time across
50 tasks**. Trace the route's initial hydration/rendering and duplicate mounts;
first reduce incorrect All-market rendering and repeated work, then investigate
route splitting, progressive section rendering and noncritical chart/modal
loading. Do not hide initial useful text/prices until all artwork succeeds.
Do not publicly cache session responses to avoid the account round trip.

## Mobile simulation summary

| Page | Usable | Bounded LCP | Bounded CLS |
|---|---:|---:|---:|
| Cards — Riftbound | 4.76 s | 3.12 s | 0.405 |
| Sets directory | 10.43 s | 3.81 s | 0.511 |
| Metrics — Singles | 7.04 s | 4.47 s | 0.146 |
| Practice Showdown | 5.13 s | 2.20 s | <0.001 |
| Auction Play | 6.98 s | 4.49 s | 0.086 |
| Card detail — cached server URL | 4.81 s | 3.32 s | 0.001 |

An early LCP is not proof that controls are ready or the page has stopped moving;
Sets and Showdown demonstrate that distinction particularly clearly.

## What is already going well

- Cache HITs dramatically reduce expensive server render time.
- Desktop card/sealed rows generally had little bounded layout shift in this pass.
- Data becomes available independently of every artwork download; missing images
  did not prevent market rows from becoming usable.
- Auction Hub client navigation retained the document and made **zero additional
  catalog requests**: Play 74–79 ms, Inventory 238–889 ms, Showcase 261–356 ms
  across two transition cycles. Keep this shared-shell architecture.
- Private and admin surfaces remain gated; performance work must preserve those
  boundaries rather than weakening them.

## Staging Daily Game Readiness failure

Read-only staging metadata checks found both manifest tables present, containing
only the October 16 snapshot and no October 21 snapshot. The daily-market marker
names a succeeded run with **19,276 expected** records, but only **6,878 present**
records still carry that run. `readyCatalogRun` therefore returns null.
`loadDailyGameCatalog` throws before artwork checks, and Daily Showdown returns
the generic 503. Ordinary stale-but-complete staging data would not itself cause
this mismatch; the publication/completeness invariant is the immediate failure.
The history of why records were re-stamped was not established in this review.

Daily Auction uses the same catalog loader, so generating a new daily auction
snapshot is also blocked by this state even though its lobby renders. Entry
was not attempted and no daily run was created. Archived stored manifests can
still be served, as the archived results check demonstrated.

Repair the staging publication state through an explicitly authorized, backed-up
data workflow; add a visible/admin readiness diagnostic and structured failure
reason. Do not lower the completeness requirement or fabricate prices to hide it.
Production readiness was not queried and must not be inferred from staging.

## Suggested priority / acceptance evidence

1. **Availability:** separately authorize staging catalog readiness repair and
   verify both daily APIs; no bypass of publication safety.
2. **Public Page Bootstrap:** validate/deploy the pending Market Scope work when
   requested, extend server/body scope handling, then rerun this same benchmark.
   Require one public mount, no cross-mode catalog requests, no false initial scope.
3. **Metrics + Detail Data Loader:** stage timings, then parallel/coalesced/versioned
   reads. Compare actual MISS and HIT results, not warm-only screenshots.
4. **Auction Card Backdrop:** fixed slots/replacement, smaller verified artwork;
   require stable strip geometry and no broken looping in either theme/viewport.
5. **Shared Catalog Snapshot Loader:** fix parity, eliminate Showdown double batch,
   prove direct visits/reloads faster without stale-price or owner-data regressions.
6. **Coverage/telemetry:** authenticated Collections with small/large holdings,
   populated Buy List/imports, account recovery, public profiles and admin tables;
   then physical Safari/Chrome and consent/privacy-conscious real-user timings.

Use LCP ≤2.5 s / CLS ≤0.1 as eventual field goals. For controlled regression
checks, propose ≤2.5 s desktop useful-content readiness on a warm server with
a fresh browser and ≤1 s cached Auction Hub navigation. These are proposed
budgets, not guarantees or results already achieved across every route.

## Diagnostic artifacts

Ignored local artifacts (not source or deployment handoffs):

- `outputs/site-load-broad-2026-10-21.json`
- `outputs/site-load-focus-2026-10-21.json`
- `outputs/site-load-mobile-slow-2026-10-21.json`
- `outputs/site-load-extras-2026-10-21.json`
- `outputs/site-load-hub-navigation-2026-10-21.json`
- `outputs/site-load-background-check-2026-10-21.json`
- `outputs/site-load-daily-diagnosis-2026-10-21.json`
- `outputs/site-load-admin-access-2026-10-21.json`

The preliminary aborted pass used an incorrect Sealed readiness selector; it is
preserved separately but excluded from all results above. Diagnostic scripts
live under ignored `work/site-load-*.mjs`. The browser-only fixed-width experiment
was not applied to application styles. No release gate was run for this analysis;
there is no application implementation or deployment in this task.
