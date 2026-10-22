# Page loading follow-up

## Goals and feature names

- **Leaderboard Header Geometry:** prevent the server's default Pokémon heading,
  changing text alignment and count/date wrapping from moving mobile controls when
  the remembered market and catalog arrive.
- **Auction Wallet Summary:** reuse the same loading/resolved value slots. An empty
  inventory is worth zero without waiting for unrelated market prices; unknown
  ownership or missing prices must never become invented zero balances.
- **Metrics Set Valuation Scope:** compute pack prices, EV tiers and sealed momentum
  for the selected leading sets, not every set in the catalog. Match exact game/set
  pairs; a name collision must not merge games. The all-set EV endpoint stays intact.
- **Detail Publication Cache:** isolate the game-row memo by database, configuration
  and all relevant publication markers, including unpinned detail reads. Active
  ingestion bypasses reuse; failed promises are evicted.
- **Checkpoint Supersession:** atomically retire a running predecessor only when its
  sole durable checkpoint is replaced. Other references prohibit automatic cleanup.
  This adds one bounded update statement to each checkpoint batch, not a new cron.
- **Decorative Artwork Budget:** request verified 200-pixel TCGplayer thumbnails for
  scrolling backgrounds, with original-image and existing replacement fallbacks.
  Keep fixed slots, three lanes and reduced-motion behavior. Product artwork is
  unchanged and data readiness never waits for every decorative image.

## Staging repair and activation contract

The user explicitly approved a private full staging backup, a fresh protected live
catalog walk, retirement of verified superseded runs, exact parity checks and only
then staging activation of the Versioned Auction Catalog. Production, identity/save
bindings, account documents, frozen daily lineups and the no-cron policy are outside
the mutation scope.

The original partial walk left 6,878 of the published run's expected 19,276 catalog
rows tagged to it. Four old running records also prevented safe public payload
reuse. Neither readiness nor active-ingestion guards are weakened to make the
benchmark pass. Repair uses sequential protected batches capped at 80 records,
with checkpoint evidence and a stop if the upstream publication changes.

The private export is `backups/raw-signal-staging-loading-followup-20261021.sql`
(636,450,520 bytes); it can contain authentication/account data and must not be
published. Private protected-state hashes cover daily auction/showdown manifests
and account-document revisions/timestamps/lengths. They are checked before cleanup
and after repair; a difference requires investigation, never overwriting saves.

Candidate retirement is preflighted before the first status update. Same-source
successful replacement proves ordinary supersession. The obsolete bundled-feed
checkpoint additionally requires no catalog or price ownership, no published marker
and a complete successful replacement live walk. Age alone is never sufficient.

Before enabling the flag, run the real compact reader against remote read-only SQL
and compare every tuple with all eleven fresh legacy feeds: identities, printings,
names, sets, rarity/section, artwork, price cents and nulls. Nonced feed requests
avoid mistaking old edge entries for the repaired dataset. A new deployment alone
does not invalidate every URL-keyed legacy feed cache.

## Verification and limits

Focused checks cover valuation parity, game/set name collisions, empty scopes,
parameter ceilings, cache database isolation/publication invalidation, checkpoint
references, thumbnail rewriting and mobile geometry with deliberately held data.
The 14 initial targeted Chromium tests passed. The final complete release gate
passed: build, 666 unit tests (one existing skip), lint/type checks and all 137
Chromium tests. The existing 21 complexity warnings remain; no new warning was
introduced. The sandbox initially blocked an atomic temporary-file rename; the
full gate passed with the required filesystem access. A wallet text-spacing
regression caught by the broad auction journey was corrected before this final run.
Live release results will be recorded separately after deployment.

## First staging release: layout and query fixes

Application `61a959e` was pushed and deployed to staging version
`50f3d949-5715-434d-9513-4f4fd6f574da`, with compact delivery still OFF while the
approved repair continued. All prior plaintext settings, secret binding names,
limiter/storage namespaces and save/identity database bindings were preserved.
The remote staging schedule remained empty and production's deployment was unchanged.

Three fresh guest samples before and after, 390×844, 100 ms latency, 1.6 Mbps down /
750 Kbps up and 4× CPU slowdown, measured readiness plus two seconds of layout
movement. Browser caching was enabled; edge/isolate state was uncontrolled.

| Surface | Median readiness before → after | Median bounded CLS before → after |
|---|---:|---:|
| Cards — Riftbound | 3.93 → 3.54 s | 0.184 → 0.001 |
| Metrics — Riftbound | 4.11 → 3.61 s | 0.003 → 0.001 |
| Auction Play | 7.28 → 6.21 s | 0.048 → 0.002 |

All 18 paired observations were ready with no page errors. Layout stability is the
clearest result; these small samples are not field performance guarantees or proof
that every latency difference came from code. Staging ingestion was active throughout;
the public payload cache still correctly bypassed reuse. Auction still made eleven
legacy feed requests. Cards made two catalog/freshness reads.

Read-only live checks covered Cards, Sealed, Metrics and Auction Play at desktop and
mobile widths in both themes, with no horizontal overflow or application writes.
Theme captures waited for the existing color transition rather than inspecting a
mid-transition screenshot. Server Cards markup contained the neutral loading heading,
not a false Pokémon heading. Play → Inventory → My Showcase → Play retained the
same background element and issued zero catalog re-downloads. No auction was entered,
inventory sold, account signed in or daily manifest regenerated by these checks.

Three fresh/reload pairs each for representative card and sealed details also
returned ready content without page errors (12 observations). Active ingestion
still prevented cache reuse, so this does not demonstrate live detail-cache hits.
Fresh card-detail bounded CLS ranged 0.046–0.065; affected nodes included top-bar
controls, marketplace actions and peer-context text. Sealed detail was 0.002–0.002.
These affected nodes are not proof of the initiating cause. Trace typography,
hydration and control readiness before a separate detail-layout change; do not
claim that every page's cold loading is finished.

## Completed repair and pre-activation proof

The protected catalog walk completed in 251 sequential invocations, including two
temporary HTTP 500 responses followed by successful checkpointed retries. It
published 19,245 records; the expected count and actual run ownership both equal
19,245. Four verified superseded running records were marked failed with an explicit
operator reason. No catalog rows were deleted. All protected-state hashes matched
the pre-repair state, and no ingestion record remained running.

The actual compact reader and eleven nonced legacy feeds matched exactly across
1,583 Riftbound printings: zero missing, extra or changed tuples, including all
128 null prices. Combined decoded JSON was 987,957 bytes for legacy delivery versus
243,183 bytes for the compact manifest plus snapshot. This is about 75% less decoded
catalog JSON for the same current dataset, not compressed wire bytes or total page
savings. New catalog membership/prices differ from the old bundled baseline.

Controlled read-only checks ran the actual services over one stable remote staging
adapter after cleanup. Results were identical; only `generatedAt` was ignored when
comparing independently built payloads. Concurrent callers within one build shared
the same complete result, including that timestamp. Every measurement wrote zero rows.

| Service / case | Calls | SQL statements | D1 rows read |
|---|---:|---:|---:|
| Sets cold | 1 | 10 | 448,205 |
| Sets warm | 1 | 1 | 182 |
| Sets concurrent warm | 3 | 3 | 546 |
| Sets concurrent cold | 3 | 12 | 448,569 |
| Metrics cold | 1 | 13 | 901,651 |
| Metrics warm | 1 | 1 | 182 |
| Metrics concurrent warm | 3 | 3 | 546 |
| Metrics concurrent cold | 3 | 15 | 902,015 |

These are platform metadata totals for service SQL, not unique products or the
entire browser request graph. The checks establish module-cache reuse/coalescing
and retained output in an operator process; they do not force cold D1 or prove
cross-request reuse in every Worker isolate. Cold builds still read many rows.
Do not turn this into an across-the-board database-cost reduction claim.

No index or schema migration is required. The narrower valuation queries reduce
candidate scope, not the number of displayed sets or the valuation formula. Query
plans and measured server timings, rather than SQL appearance, determine whether
they improve staging latency/cost.

Remote staging `EXPLAIN QUERY PLAN` caught an initially catalog-first JSON join.
The final explicit selected-set-first cross join uses the existing exact
`(kind, game, set_name)` index for tier lookups; the pack query uses the existing
kind/game/product-type index. A SQLite regression test pins the selected-set-first
tier lookup in addition to result parity. No index was added to compensate blindly.

Three live decorative samples returned JPEG thumbnails of 15,683 / 13,649 / 17,347
bytes versus originals of 142,072 / 95,787 / 151,693 bytes. These are per-image
samples, not a claim about total page savings; shared URLs, caching, rejected images
and fallback attempts affect page totals.

Remaining work must not be confused with this release: Large/Full loading geometry,
whole-game similarity/peer candidate narrowing, offscreen decode/DOM reduction and
trace-led optional JavaScript splitting need separate characterization. Removing
global peers indiscriminately would change rankings and quartiles. Physical Safari,
populated signed-in acceptance and real two-device recovery are not proven by guest
Chromium simulation. Retain the manual checks in the existing recovery runbook.

Live before/after latency comparisons will also be confounded by the approved market
refresh. Report that dataset change and cache state alongside any small-sample lab
timings; do not attribute every difference to code or claim field Web Vitals.
