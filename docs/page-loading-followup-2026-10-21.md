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
