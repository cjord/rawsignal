# Auction and account quality plan — 2026-10-19

Scope: improve the five areas identified in the recent review. This request authorizes
local implementation and tests, not a GitHub push, deployment, remote migration,
real-account mutation, provider/email test or production rollout. Preserve the
existing local navigation/profile/cache work and unrelated user artwork.

Follow-up status: [Auction loading and safety](auction-loading-and-safety-follow-up.md)
now implements the traced shell fixes, legacy-feed reuse, artwork independence,
local-session integration coverage and default-off community burst/moderation tools.
The deferred list below records this slice's original boundary; current follow-up
status and remaining live activation/device gates are in that newer document.

## Priorities and acceptance

| Area | Implement in this slice | Acceptance / later gate |
| --- | --- | --- |
| Measured performance | Repeatable guest-only cold/warm browser benchmark; request/byte/readiness/layout-shift summaries. Cache request deadlines. | Multiple samples, explicit environment/cache conditions, no invented D1 cost or speedup. Controlled staging comparison still required. |
| Stable loading | Shared Auction Inventory Page skeleton, stable price-feedback area and retry state; retain controls while data resolves. | Slow/failing data, both themes and phone/desktop; no temporary zero wallet or sell controls enabled before prices. |
| Account resilience | Bound save requests, validate acknowledgement revisions and recheck owner after response-body parsing. Add delayed-response/account-switch/conflict tests. | Pending drafts preserved; a late response cannot enter another owner's records. No automatic money/inventory merge or write retry after an ambiguous result. |
| Community privacy/hardening | Complete owner-only cloud export including visibility and profile appearance; reject malformed/oversized community queries before catalog reads; clearer cosmetic-sharing disclosure. | Private no-store responses, session owner authoritative, no credentials/recovery keys/session tokens. No new anonymous database writes. |
| Maintainability | Small shared request/feedback/loading utilities, behavioral tests and current status documentation. | No new lint warnings; full release gate. Avoid broad market-page rewrites while improving auction/account code. |

## Deferred work, deliberately

- Real signed-in two-device Google/Discord/email, offline/reconnect, storage quota,
  session revocation and recovery checklist. Mocked tests do not prove these live flows.
- Idle cloud refresh: later use a bounded revision check with an explicit adoption
  policy. Never reload an active auction/editor or replace unsynced local progress.
- Community throttling: prefer a platform rate-limit binding at the Worker boundary,
  with separate per-account write limits and bounded anonymous read limits. Provisioning,
  thresholds and production activation require a reviewed rollout; an isolate-local
  counter is not a global security/budget guarantee. Do not reuse email counters.
- Moderation/reporting and audited administrator actions with retention/deletion
  policies, followed by server-authoritative scoring if competitive rankings are wanted.
- Cache activation, database rows-read measurement and version-parity tests in staging;
  browser transfer sizes and SQL statement counts are not database billing measurements.
- Repair the local D1 profile and investigate existing detail-page hydration diagnostics
  separately, without silently migrating or resetting the developer's database.
- Gradually split high-complexity legacy components by behavior, protected by existing
  characterization tests. Do not undertake a wholesale rewrite to erase warnings.

## Verification and handoff

1. Narrow tests for deadlines, save acknowledgement races, private export/query guards.
2. Browser checks for delayed/failed inventory loading, safe sales, privacy controls and
   the benchmark's own collection/reporting behavior. No auction entry in benchmarks.
3. Full `npm run check`, then review generated-data/secret/source diffs.
4. Record what is locally proven versus awaiting staging and real-owner verification.

## Best practices and alternatives

- Measure user readiness separately from decorative artwork; compare distributions,
  not one cold/warm visit. A hosted real-user telemetry service is an alternative,
  but adds privacy, consent, retention and ingestion considerations; begin with a
  local, opt-in benchmark with aggregate metrics only.
- Deadlines must include JSON body parsing, not just response headers. Unmounting a
  public catalog subscriber must not abort another subscriber's shared request.
- Prefer revision-checked saves and explicit conflict resolution over last-write-wins.
  Retry can be ambiguous when a write committed but its response was lost; preserve
  drafts and let the server reject an obsolete revision rather than award money twice.
- Match placeholders to the final structure, while keeping critical failures visible.
  Waiting for every card image would conceal useful data behind an unreliable dependency.
- Export server-owned, allowlisted account data, not an arbitrary browser user object.
  Public visibility stays opt-in and cosmetic cards never become owned holdings.
- Add production limits before public scale. Cloudflare documents actual D1 scans in
  [result metadata](https://developers.cloudflare.com/d1/worker-api/return-object/);
  browser layout-shift observation must exclude recent input and report unsupported
  environments honestly ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift/hadRecentInput)).

## Implemented locally

- A shared 15-second JSON deadline covers headers and body parsing for catalog,
  bootstrap, save, recovery and export requests. Timeouts retain last-good data.
- Save acknowledgements validate the expected key/value/next revision and recheck
  owner after body parsing. Invalid results retain drafts, not false success.
- Saved Account Export is server-owned: allowlisted cloud documents, basic profile
  and community visibility/appearance. Pending device drafts are exported separately.
  Public query guards reject duplicate/unknown parameters and oversized cursors.
- Inventory Loading Shell reserves overview/filter/action structure, with sales
  disabled until usable prices. Market Snapshot Status shares source/date/retry
  feedback across owner pages. Frozen shares are not relabeled as live prices.
- Shared request, filter, loading and feedback components avoid parallel copies.
  Tests cover deadlines, old-owner response bodies, invalid acknowledgements, two
  isolated browser contexts, private exports and slow/failed inventory loads.

## Local smoke baseline — 2026-10-19

Three samples per route/phase; isolated guest, 1440×1000, reduced motion, local dev
server, cache feature off. Server caches were uncontrolled and already warm.
These are medians, not a controlled before/after speed comparison or tail estimate:

| Route | Fresh browser document | Repeated document | Client navigation |
| --- | ---: | ---: | ---: |
| Play | 587 ms | 297 ms | 89 ms |
| Inventory | 590 ms | 352 ms | 252 ms |
| My Showcase | 375 ms | 332 ms | 140 ms |

Every sample requested eleven legacy catalog files. Internal navigation preserved
the document but does not alone eliminate catalog traffic. Cold-document bounded
unexpected-shift medians: 0.185 Play, 0.234 Inventory, 0.00025 Showcase; client-navigation
medians were zero. Remaining cold-shell movement needs element-level tracing and
reserved final geometry: not every loading shift is fixed. These sums are not
full-session CLS. D1 scanned rows are unknown locally; controlled staging metadata
and feature-on/off comparisons remain necessary.

## Final verification

`npm run check` passed: production build, 613 passing node tests / one skip, lint
(21 existing complexity warnings, no new warnings), type check and all 113 Chromium
journeys. Reviewed Inventory Loading Shell screenshots at desktop/mobile in dark/light
themes; the wider suite also covers Singles and Sealed. New focused browser checks
passed after correcting an isolated provider-list mock, followed by the full gate.
Source diff/known-credential checks passed; no generated feeds, dependency lockfile,
migrations or repository instructions changed. Existing local D1 missing history
columns and unrelated detail-page hydration diagnostics still appear in passing
fallback journeys; they are not claimed fixed. No GitHub push, deployment, real-account
mutation, remote database change or production verification occurred.

## Performance Benchmark and Read Cost Meter

`scripts/performance/auction-benchmark.mjs` is an opt-in command, not page telemetry:

```powershell
node scripts/performance/auction-benchmark.mjs --base-url http://localhost:4173 --samples 3
```

Run against an already-running local server. The command uses 1–5 samples per route
and phase: fresh isolated guest document, repeated document in the same context, and
client navigation. It measures Play, Inventory and My Showcase without entering an
auction or submitting account data. Production targets are intentionally rejected;
running against staging still needs an intentional testing decision.

Output is aggregate JSON on stdout: readiness, same-document navigation, request
counts, browser-reported same-origin resource transfers, failed requests and bounded
unexpected layout-shift sums. It excludes recent user input. This is not full-session
Core Web Vitals CLS; byte values omit document/third-party transfers and zero transfers
are not automatically proof of a cache hit. Cold browser contexts do not make the
server/colo/database cold. No card identities, prices, account IDs or save values are
recorded. Compare repeated distributions under the same build/data/network settings.

On controlled staging cache builds, `auction_catalog_read_cost` structured logs report
statement count, scanned/written rows and SQL duration from existing D1 results.
Missing metadata is null, not zero. A memory-cache hit performs no rebuild; logs occur
only on database construction attempts, including fallbacks. The wrapper refuses
writes and batches. No new query is made solely to measure another query, and no SQL,
bound value, database identifier, account information or result payload is logged.
The existing catalog feature remains off by default and refused in production.

## Real-account acceptance checklist — pending, not run here

Use a dedicated test account and two isolated devices, not an owner's valuable wallet:

1. Sign in through the already-linked methods. Confirm the same preferences, game
   state, showcase and private/public choices appear on both devices.
2. Make a change on A, then attempt a stale change to the same saved document on B.
   B must retain its pending draft and offer export/reload, never silently merge.
3. Go offline, make a small change, reconnect, and verify one accepted revision.
   Repeat with a server write whose response is lost: a conflict is safer than an
   automatic replay that could duplicate money or inventory.
4. Close/reopen a tab with pending changes. Confirm encrypted device recovery for
   the same owner; another signed-in account must not receive the pending data.
5. Change cloud state on the other device, then try recovering an older draft.
   Recovery must stop on revision conflict while preserving export access.
6. Expire/revoke a session, fill/block device storage, and verify visible failures,
   no false save success and a usable backup/recovery path.
7. Download the saved-account export. Compare preferences, game documents, cosmetic
   appearance and visibility with the cloud. Export is plaintext and must be kept
   private; device-only pending drafts have a separate export.

## Community launch gates

- Measure legitimate bursts before choosing independent anonymous-read and
  authenticated-write quotas. Return 429 with Retry-After, preserve drafts and avoid
  tight automatic retries. Infrastructure limits are not supplied by query validation.
- Add moderation/reporting before broad discovery: audited hide/unhide of public
  presentation, not destructive deletion of private account/game holdings.
- Document retention/deletion scope, including frozen links and copies already shared.
- Keep the community leaderboard labeled unverified. Server-authoritative auction
  outcomes, authenticated actions and anti-replay controls would be a separate
  competitive architecture, not a small browser-scoring adjustment.
