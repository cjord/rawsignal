# Market Scope — staging reassessment, 2026-10-21

## Release

Validated source `be40c34` was pushed to `codex/accounts-and-collections` before
deploying staging version `98299ef7-23bd-4e1e-83c8-0c5bbee8eb5e`.
Production was not deployed; its active deployment was verified unchanged.
Staging accounts, shared identity, separate save databases, Collections, recovery,
audit, community protection and the disabled Auction Catalog feature flag were
preserved. Remote staging schedules remain empty. No migrations, ingestion,
catalog repair, WAF change or production write was performed.

The complete `npm run check` passed: production build, 655 unit tests (one skip),
lint/type checks and all 131 Chromium browser checks. The 21 existing complexity
warnings remain; no new warnings were introduced. Article drafts/plans and the
unrelated image were left outside the release commit.

## Confirmed behavior improvements

The **Market Scope** control is All / Pokémon / Riftbound / One Piece; **Product
Type** is Singles / Sealed. Neither is a price refresh or a second document load.

Live functional checks held the account session response while opening Cards,
Sets, Metrics and Sealed. Each showed the expected market exactly once, retained
one main-content mount after session completion and exposed public content without
waiting for that session. Settings stayed disabled while it was unresolved.
Cards/Sets/Metrics restored remembered Riftbound on bare URLs; an explicit Pokémon
Sealed URL correctly overrode that preference. All four surfaces fit 1440/390
widths in dark/light themes; representative screenshots were visually inspected.
No sign-in, private account modification, import, auction or sale was performed.

| Measured request/mount behavior | Before | After |
|---|---:|---:|
| Public market main-content mounts | 2 | 1 |
| Riftbound Cards feed requests | 4 | 2 |
| Pokémon Cards feed requests | 6 | 3 |
| Each tested Sealed market's feed requests | 10 | 3 |
| Hidden Singles catalog requests on Sealed | Present | None |

Feed counts include `/data/freshness.json`, not only catalog sections. Sealed
still requests freshness from both the parent and its Sealed view; coalescing
that small request is a possible follow-up. These are browser requests, not
database-query counts or a claim of matching billed Worker-call reductions.
Games retain owner isolation; their second mount was not removed by this fix.

## Desktop measurements

Same staging origin, representative URLs, Chromium 1440×1000, enabled browser
cache, isolated guest contexts and fresh/reload pairs as the
[baseline review](site-load-review-2026-10-21.md). Optional eBay/auth-action/write
endpoints were blocked; measurement did not wait for every image. Readiness
still waits for account resolution, conservatively retaining the old benchmark's
definition even though public content is now usable before it finishes.

Seconds to representative content/control readiness in the first post-deploy
pass, compared with the original broad pass. One pair per entry, not averages:

| Page | Fresh before → after | Reload before → after |
|---|---:|---:|
| Cards — Riftbound | 3.57 → 1.66 | 1.59 → 0.42 |
| Cards — Pokémon | 3.82 → 1.69 | 1.89 → 0.31 |
| Sealed — Riftbound | 4.32 → 0.60 | 1.54 → 0.28 |
| Sealed — Pokémon | 3.62 → 1.88 | 1.74 → 0.38 |
| Sealed — One Piece | 4.22 → 1.37 | 1.67 → 0.40 |
| Sets | 5.84 → 2.51 | 1.65 → 1.60 |
| Metrics — Singles | 7.82 → 2.50 | 1.33 → 1.72 |
| Metrics — Sealed | 6.95 → 2.46 | 1.34 → 2.20 |

Do not attribute every timing difference to this code. Server/network timing also
improved on unchanged control paths, and the deployment invalidates page caches.
Both Metrics reloads in this pass were cache MISSes, while baseline reloads were
HITs. A fresh browser is not necessarily a cold edge/isolate/database. The one-mount,
one-selection and reduced-request results are stronger direct evidence of the fix
than a percentage derived from these small timing samples.

A separate follow-up found Sets at **1.60 s fresh / 0.76 s reload**, both HITs,
and Metrics Singles at **2.62 s fresh MISS / 0.37 s reload HIT**. This confirms
the cache distinction; it does not remove the remaining initial-body layout shifts.

Control paths confirm that broader work is not magically completed: Showdown still
requests two eleven-feed batches, Auction Play still requests eleven feeds and its
backdrop shifts, and product-detail read implementations are unchanged. The first
post-deploy Sealed-detail reload was slower than its fresh load (2.66 vs 2.31 s),
with both responses MISSes. Warm/cache-miss behavior needs separate comparison.

## Mobile simulation

Same six routes and simulation as baseline: 390×844, 100 ms latency, 1.6 Mbps
download, 750 Kbps upload and 4× CPU slowdown. These are not physical-device or
field percentile results. Bounded CLS is observed through two seconds after
readiness, not a claim about an entire real session.

| Page | Usable before → after | Bounded CLS before → after |
|---|---:|---:|
| Riftbound Cards | 4.76 → 3.98 s | 0.405 → 0.203 |
| Sets | 10.43 → 6.58 s | 0.511 → 0.512 |
| Metrics Singles | 7.04 → 3.21 s | 0.146 → 0.147 |
| Price Showdown | 5.13 → 5.06 s | <0.001 → <0.001 |
| Auction Play | 6.98 → 6.35 s | 0.086 → 0.144 |
| Card detail | 4.81 → 4.98 s | 0.001 → 0.001 |

Sets' measured long-task time fell from approximately 4.18 s / 50 tasks to 0.74 s
in this sample, consistent with less duplicate client work. It still takes too
long and visibly shifts; it should not be called solved. Auction's random artwork
changes between visits, so its higher CLS is not evidence that Market Scope code
introduced a new backdrop defect. The existing backdrop defect remains.

## What remains / next priorities

1. **Scope-Stable Page Body:** Sets/Metrics still initially render All-market body
   content before applying the URL/device scope. Sets desktop CLS remains about
   0.49; mobile remains about 0.51. Seed valid explicit URL scope server-side;
   for remembered-only bare URLs reserve a neutral, appropriately sized body
   instead of displaying the wrong market. Keep text independent of artwork.
2. **Leaderboard Loading Geometry:** mobile Cards still shifts as the heading,
   summary, controls and rows settle (CLS 0.203). Match skeleton/final dimensions
   and reserve header/summary space without delaying useful data.
3. **Publish-Version Payload Cache / Detail Data Loader:** server query and
   aggregate implementations were not changed. Measure MISS/HIT separately,
   parallelize independent work and coalesce reusable published payloads.
4. **Shared Game Catalog Loader / Auction Card Backdrop:** Showdown's 22-request
   double batch and the backdrop's shrinking failed-image rows remain separate
   fixes. Do not remove game owner isolation to reduce requests.
5. **Staging Daily Game Readiness:** the baseline's incomplete published catalog
   needs a separately authorized backed-up repair. This release neither repairs
   the database nor bypasses completeness checks. No daily attempt was started.

No production promotion was requested. Further server/body/background fixes were
not bundled into this already-validated release during reassessment.

## Evidence

Ignored local reports and screenshots, deliberately not committed:

- `outputs/market-scope-release-check-2026-10-21.log`
- `outputs/market-scope-staging-functional-2026-10-21.json`
- `outputs/market-scope-staging-{cards,sealed,sets,metrics}-*.png`
- `outputs/site-load-after-market-scope-market-release-2026-10-21.json`
- `outputs/site-load-after-market-scope-mobile-slow-2026-10-21.json`
- `outputs/site-load-after-market-scope-focus-2026-10-21.json`
- Private binding/version preservation evidence under the
  `outputs/market-scope-staging-release-*` prefix; never publish those files.
