# Catalog Snapshot Cache — staged implementation design

Update 2026-10-19: implementation has begun. The compact versioned endpoint,
database consistency guard, shared memory cache and gated consumers are implemented
locally, including transaction revalidation and changed-sale-quote confirmation.
Read-cost measurement, live parity and activation remain.
The switch is off by default and production cannot enable it. See
[implementation progress](auction-implementation-progress.md). The original design
below remains the target; it is not a claim that every stage is shipped.

## Current behavior and evidence

Auction House fetches eleven Riftbound section feeds through `useCatalogPage`.
Each page mount currently parses/normalizes them again; there is no shared
version-aware application cache. Browser HTTP caching already helps: database feed
responses advertise 60 seconds browser caching, 300 seconds shared caching and
stale-while-revalidate. Do not describe repeat visits as completely uncached.

A two-visit staging sample on 2026-10-19 measured DOM-ready / market-ready at
691 / 1,578 ms cold and 47 / 101 ms warm. Cold navigation made 22 section requests,
warm 11. These are two observations, not a benchmark or guaranteed improvement.
The current release gates the catalog until account bootstrap finishes to avoid
the first request wave being aborted and repeated by the owner-scope remount.

`/data/freshness.json` currently supplies source/published timestamps, **not a
catalog version identifier**. Section responses are bare arrays. A timestamp alone
cannot prove eleven independently requested sections belong to one published run.

## Recommended design

1. Add a small public manifest and compact auction catalog endpoint. Return an
   opaque content version derived from the complete published catalog identity,
   relevant price identity and response-schema/normalizer version. Include source,
   price date, record count and fallback status, but no database UUIDs or secrets.
   Read only a complete published run; obtain all cards against that pinned identity.
2. Cache the complete validated catalog in shared browser memory, keyed by version
   and schema. Deduplicate in-flight loads across Auction Lobby, Inventory and My
   Showcase. A single view unmount must not abort a request still used elsewhere.
3. Add bounded IndexedDB storage only after the memory version is measured. Keep
   one or two complete versions, with corruption/quota handling. These are public
   market prices, **not account documents, wallets, recovery drafts or hidden lots**.
4. Render last-good cached public prices promptly with their as-of date; check the
   small manifest on return. Propose a five-minute manifest freshness limit during
   browsing, with mandatory validation before a new economic action. This limit is
   a proposed policy, not an existing guarantee.
5. Replace the whole catalog atomically when the version changes; never splice
   sections from different runs. Do not move inventory selections or change sale
   proceeds underneath an open confirmation. Requote and require confirmation if
   the selected sale price changes.
6. A started auction, cancelled-entry draft and daily lineup retain their existing
   frozen cards/prices. New catalog versions must not reroll a retained draft or
   change an active auction. Review the stale retained-draft entry policy explicitly
   before enforcing a new-entry freshness rule against those drafts.
7. Show a small stale/unavailable status on failure. Recommended: block new sales
   and new unprepared entries if freshness cannot be established, without blocking
   inspection or continuation of already-frozen auctions. Decide this offline
   policy before implementation. Keep manual Refresh Market as a recovery action
   until automatic validation and retry behavior are proven.

## Cost and safety

A warm unchanged version should need one small manifest check, not eleven payload
downloads. An updated version adds one catalog response. Memory/cache hits can
avoid catalog queries; a cold endpoint still needs readiness and catalog reads.
Exact D1 read statements/rows depend on the implemented query and cache hit rate;
measure them rather than treating one HTTP request as one database read.

No additional ingestion schedule, upstream TCGCSV calls, history calls or database
writes are needed for read-only cache validation. Reuse published-run identity and
existing ingestion; never start price ingestion from a page visit. Bound manifest
memoization (for example 60 seconds) and invalidate edge keys by the same version.
Personal state remains owner-scoped and never enters a public edge response.

## Acceptance tests and rollout

- Concurrent mounts request one catalog, and one subscriber abort does not break others.
- Publication during a download cannot produce mixed-version prices.
- Same timestamp with different version, schema upgrades and bundled fallback work.
- Warm navigation, reload, account switch, offline state, quota exhaustion and corrupt
  cache preserve owner isolation, N/A prices, printings and unsynced saves.
- Sales detect updated prices; existing auction/daily/draft snapshots do not change.
- Compare guest and signed-in cold/warm market-ready time, payload bytes, actual
  network transfer, catalog requests and D1 rows read. Report cache state explicitly.

Ship behind a staging-only flag, compare cache-on/off parity and then request a
separate rollout. No new endpoint or persistent browser cache ships in this release.
Compare the [Auction Bootstrap Response alternative](auction-bootstrap-response-plan.md).
