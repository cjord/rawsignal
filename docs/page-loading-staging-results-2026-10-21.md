# Page loading batches — staging results, 2026-10-21

## Release

Validated application `cfc591b` was pushed to `codex/accounts-and-collections`, then
deployed to staging version `01a13354-d93e-43b3-a336-45a5473e5286` at
<https://raw-signal-staging.raw-signal-watch.workers.dev>.

The prior complete gate passed: production build, 662 unit tests (one existing
skip), lint/type checks and 134 browser tests. No application/test source changed
between that gate and this deployment. Existing 21 complexity warnings remain.
Unrelated article work, the mixed to-do edits and the user's image were not pushed.

All existing plaintext settings and secret binding names were checked after deploy;
save/identity database bindings, accounts, Collections and protection flags were
preserved. Staging's remote schedule is empty. Compact Auction Catalog remains OFF.
Production's deployed version was verified unchanged. No migration, data repair,
ingestion, snapshot regeneration, sign-in, auction entry, sale or WAF change occurred.

## Measurement conditions

Collected a new baseline immediately before deployment, then repeated the same
measurements afterward on the same staging origin:

- Eight page families, five isolated fresh-browser/reload pairs each: 80 desktop
  observations before and 80 after, at 1440×1000.
- Four problem pages, five isolated mobile loads each: 20 before and 20 after,
  at 390×844, 100 ms latency, 1.6 Mbps down / 750 Kbps up and 4× CPU slowdown.
- Five sequential unique-query HTML requests per Sets/Metrics route before and
  after; every one was an actual edge MISS. This does not force cold isolates/D1.
- Browser cache enabled, normal motion, anonymous visitors, remembered Riftbound;
  tested Sealed URL explicitly selects Pokémon. No wait for all artwork/networkidle.
- Readiness retains the prior conservative definition, including account resolution,
  so public data can become readable earlier than the reported time.
- Layout-shift observation ends two seconds after readiness. These are bounded lab
  measurements, not full-session field Core Web Vitals or physical-phone results.
- Optional eBay and known auth/write endpoints were blocked. All 200 readiness
  observations succeeded, with no page errors, horizontal overflow or app non-GETs.

Tables show medians of five observations per entry. No percentile or universal
percentage speed claim is justified by these small samples. Browser/network and
edge state vary; a fresh browser is not a cold server.

## Desktop readiness

Seconds to representative usable content/controls:

| Page | Fresh before → after | Reload before → after |
|---|---:|---:|
| Cards — Riftbound | 1.02 → 0.84 | 0.31 → 0.38 |
| Sealed — Pokémon | 0.79 → 0.97 | 0.29 → 0.31 |
| Sets — Riftbound | 1.07 → 0.90 | 0.44 → 0.26 |
| Metrics — Riftbound Singles | 0.94 → 0.85 | 0.24 → 0.27 |
| Price Showdown | 1.00 → 0.70 | 0.58 → 0.48 |
| Auction Play | 1.07 → 1.10 | 0.57 → 0.66 |
| Card detail | 0.82 → 1.06 | 0.31 → 0.28 |
| Sealed detail | 1.00 → 0.61 | 0.27 → 0.25 |

These are mixed results, not an across-the-board speedup. Baseline Sets/Metrics/card
detail fresh responses were all HITs; afterward each had three HITs and two MISSes.
Sealed detail changed from four HITs/one MISS to three HITs/two MISSes. All these
reload responses were HITs. Server-cache differences limit causal latency comparison.

## Direct request and layout improvements

| Measurement | Before | After |
|---|---:|---:|
| Showdown feed requests, fresh and reload | 22 | 11 |
| Sealed catalog + freshness requests, fresh and reload | 3 | 2 |
| Sets desktop fresh bounded CLS | 0.491 | 0.002 |
| Metrics desktop fresh bounded CLS | 0.078 | 0.002 |
| Auction Play desktop fresh bounded CLS | 0.162 | 0.002 |

The removed requests are redundant reads, not removed content. Showdown retains
owner-specific progress. Sealed retains one shared freshness read. HTTP counts
are not billed Worker/D1 counts. Auction still needs eleven legacy feeds in a new
document; fixed image slots do not make its catalog transport smaller.

## Mobile simulation

| Page | Readiness before → after | Bounded CLS before → after |
|---|---:|---:|
| Cards — Riftbound | 3.89 → 3.54 s | 0.203 → 0.184 |
| Sets — Riftbound | 6.64 → 2.97 s | 0.512 → 0.001 |
| Metrics — Riftbound Singles | 3.93 → 3.66 s | 0.147 → 0.003 |
| Auction Play | 6.61 → 6.55 s | 0.085 → 0.048 |

Sets has the clearest combined readiness/stability gain. Its median observed
long-task time fell from 1,405 ms to 181 ms, consistent with not first rendering
the All-market directory. Its same-origin encoded resource bytes stayed about
377–378 KB: this was not achieved by removing the dataset or waiting for images.

Mobile Cards is not solved. Its largest remaining shift events affect the
**Leaderboard Header** title/count/date area and the controls below it, around
scope/data completion. The larger minimum space only partially helped. Trace
which content/layout change initiates those shifts before adding more broad
height overrides or leaving excessive blank space.

Auction Play's residual mobile shifts affect the **Auction Wallet Summary**
net-worth text and actions near catalog readiness. Shift-source nodes identify
affected elements, not by themselves the original cause. Its ~6.5 s readiness and
roughly 677 KB of decoded same-origin JS remain opportunities; that JS total
includes the framework/shared code, not exclusively removable auction code.

## Server work and the ingestion-lifecycle blocker

Unique-query edge-MISS HTML response medians:

| Page | Total response before → after |
|---|---:|
| Sets | 773 → 576 ms |
| Metrics | 1,451 → 1,161 ms |

These small sequential samples are compatible with some improvement, but are not
proof of cold-server gains or reduced database cost. New Metrics stage timings
show the set/valuation stage taking roughly 0.93–1.24 s in representative requests.
Durations of concurrently submitted D1 reads include shared waiting/queue time;
do not add them or infer SQL parallelism.

Read-only ingestion inspection before and after found four records still marked
running: two bundled-feed runs and one history run from August, plus the existing
October 20 live run. No record was modified. The new public payload cache correctly
bypasses reuse when any run is marked running; full stage timings confirm builds
were still performed. **No live payload-cache HIT/coalescing benefit is claimed.**

This exposes unfinished work in the ingestion lifecycle/safety contract. Distinguish
truly active work from paused/abandoned runs using durable job/lease evidence,
then decide an explicit repair/resume plan. Do not merely ignore running rows,
guess from age alone, or weaken publication/completeness guards for a benchmark.
Remote cleanup or ingestion needs separate authorization and applicable backups.

## Live functional checks

- Cards, Sets, Metrics and Sealed retained one main-content mount and the expected
  market selection while the session response was held. Public data did not wait
  for it; Settings remained gated. Explicit Sealed scope overrode device memory.
- Four server-rendering cases checked explicit/bare Sets and Metrics URLs: scoped
  content or neutral placeholder as appropriate, with controls disabled until
  hydration. Sets Heatmap/Tiles clicks worked. Native scoped set links and bare
  no-JavaScript market links remained visible/usable.
- Dark/light, desktop/mobile screenshots for all four market surfaces were checked;
  no horizontal overflow was found. Staging's real UI, not only local fixtures,
  was inspected.
- Fifteen Play → Inventory → My Showcase transitions retained the document and the
  same background element, with zero catalog re-downloads and zero measured
  unexpected layout shift in the transition window.
- Two destination router fetches reported `net::ERR_ABORTED` even though their
  destination content rendered and readiness passed. These are retained separately
  as router-stream cancellation diagnostics, not reported as zero raw failures.
  No other navigation request failure was observed. This is not proof that every
  framework cancellation is harmless; investigate if users see stalled navigation.

No signed-in private Collections, populated account datasets, physical Safari,
cross-device recovery or production custom-domain performance was measured here.

## Remaining work, in recommended order

1. **Leaderboard Header Geometry / Auction Wallet Summary:** trace the specific
   mobile heading/stat/wallet transitions and stabilize their slots. Finish
   Large/Full skeleton geometry with representative populated/empty fixtures.
2. **Ingestion Lifecycle / Public Payload Reuse:** diagnose abandoned/paused running
   states without relaxing safety, then measure equivalent MISS/HIT/concurrent cases
   and actual database costs. Inspect production lifecycle before any promotion.
3. **Detail Data Loader / Metrics Set Valuation:** narrow whole-game peer candidates,
   improve the older game-row memo's DB/publication key, and profile set/EV reads.
   Preserve related/chase/peer semantics through fixtures; no blanket new indexes.
4. **Versioned Auction Catalog rollout:** separately approved backed-up staging
   repair/resume, exact completeness/price/null/printing parity, then flag activation
   and frozen-auction/offline/owner checks. It remains OFF, not secretly bypassed.
5. **Auction Startup Budget:** evaluate verified smaller decorative images, less
   offscreen decode, early owner-resolved empty states and trace-led optional-JS
   splitting. Data must not wait for every image. Persistence is a separate choice.
6. **Broader acceptance:** populated signed-in collections/profiles, real two-device
   recovery and physical Safari; keep guest lab results distinct from those gates.

## Evidence

Ignored local artifacts, never publish their private deployment/config contents:

- `outputs/site-load-loading-batches-{before,after}-{loading-batches,mobile-slow}-2026-10-21.json`
- `outputs/page-loading-staging-comparison-2026-10-21.json`
- `outputs/page-loading-server-{before,after}-2026-10-21.json`
- `outputs/page-loading-staging-cache-state-{before,after}.json`
- `outputs/page-loading-staging-{functional,ssr,hub}-2026-10-21.json`
- `outputs/page-loading-staging-*-{390,1440}-{dark,light}.png`
- Private `outputs/page-loading-staging-release-2026-10-21-*` evidence

Implementation details and original gate record:
[loading batch progress](page-loading-batches-progress-2026-10-21.md).
