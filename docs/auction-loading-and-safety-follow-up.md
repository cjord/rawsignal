# Auction loading and safety follow-up — 2026-10-19

This continues the [quality plan](auction-quality-improvement-plan.md). Source changes
and local verification are authorized. No push, deployment, remote migration, cache
activation, provider login or real-wallet mutation is authorized by this request.

## Goals and acceptance

| Feature | Goal | Acceptance |
| --- | --- | --- |
| Auction Loading Shell | Stop late lobby insertion and transient Inventory collapse. | Bounded unexpected-shift median under 0.01 in the local desktop guest smoke run; preserve usable mobile/light/dark layouts. Not a full-session CLS claim. |
| Data-First Artwork | Prices, names and actions do not wait for unrelated images. | One stalled image cannot block another visible image or inventory metadata. Failed artwork keeps its reserved tile geometry. |
| Legacy Catalog Reuse | Stop repeating eleven catalog downloads on every internal navigation. | One shared eleven-file wave per document; no further catalog requests inside five minutes; explicit refresh/expiry still works. Owner data never enters this cache. |
| Controlled Catalog Comparison | Compare transports using the same exact printings, prices and missing values. | Local paired comparison: legacy eleven requests versus snapshot manifest/body two; remount adds none. Live staging parity/read-cost checks remain a rollout gate. |
| Recovery Acceptance | Prove ownership/conflict/revocation independently of UI mocks, then test physical devices. | Two actual local authenticated sessions share the same recovery owner/key; stale writes fail; revoked sessions lose access. Physical-device/provider checks remain explicitly separate. |
| Community Burst Protection | Bound repeated community reads and account writes before expensive work. | Default-off platform bindings, explicit configuration, private 429 + Retry-After, preserved drafts, no tight write retries. |
| Community Moderation | Reversibly hide inappropriate or manipulated public presentation. | Server admin role, fresh sign-in, origin check, fixed reason, revision check, atomic state/audit, no changes to private holdings or cash. |

## Traced causes and changes

- **Play:** the saved-game hook initially returned null, so wallet, entry choices and
  statistics were absent. Their later insertion moved the market feedback/footer.
  Auction Loading Shell now reserves those structures with placeholders and disabled
  controls. It never fabricates a zero wallet or saved statistics. The temporary
  Inventory label is non-interactive, so a click cannot open a placeholder that is
  immediately replaced by the real closed control. Loading placeholders omit tooltips;
  real controls and their accessible tooltips mount with the loaded content.
- **Inventory:** while restoring URL filters, the real manager replaced its skeleton
  with a one-line message, then expanded again. It now keeps the same loading shell;
  the workspace also reserves a viewport-sized minimum. Empty inventory still renders
  an honest empty state, not dummy holdings.
- **Artwork:** DeferredImage previously waited for the entire window load event before
  scheduling nearby artwork. One hanging eager background image could delay unrelated
  cards. Nearby images now schedule after a frame/idle opportunity independently of
  window load. Data renders first; aspect-ratio boxes, lazy proximity, low fetch priority,
  data-saver behavior and the existing one-time fallback remain. Decorative background
  art still fades in only after decoding. Auction entry still validates usable artwork
  before charging/starting its timer; this change does not admit broken cards to lots.
- **Catalog:** each old hook instance loaded its own eleven files. An auction-specific
  public memory store now coalesces consumers and reuses a complete batch for five
  minutes, including navigation away/back. Failed/partial/expired requests do not
  replace last-good data; explicit errors and manual retry remain. No disk persistence,
  new server endpoint or account data in the legacy cache. Reloading the document still
  requests eleven files; the compact versioned endpoint addresses that separate cost.
- **Tracing:** the opt-in Performance Benchmark now includes bounded element/class
  paths and old/new rectangles for major shifts. It records no text, DOM IDs, account
  identities or prices and adds no visitor telemetry.

## Initial local evidence, not a production performance claim

Same local dev environment, guest 1440×1000, reduced motion, uncontrolled warm server;
three samples per route/phase before and after. Rounded median bounded shift sums:

| Surface | Before | After | Internal catalog calls before → after |
| --- | ---: | ---: | ---: |
| Play | 0.185 | 0.00091 | 11 → 0 |
| Inventory | 0.234 | 0.00044 | 11 → 0 |
| My Showcase | 0.00025 | 0.00025 | 11 → 0 |

Remaining small sources include self-hosted font swaps in controls. Internal samples
preserved the document and recorded zero unexpected movement. These bounded readings
are not full-session CLS or a controlled deployed latency experiment; three samples
cannot estimate p95. First-load legacy requests remain eleven. The local same-data
transport comparison checks content parity and 11-versus-2 request counts, not D1 scans
or live network speed. SQL read cost remains unknown until staging metadata is observed.
These initial post-fix measurements preceded the final non-interactive Inventory
placeholder and tooltip polish. The final source's full regression results are below;
do not present the initial readings as a deployed performance guarantee.

Read-only staging probes: Auction House HTTP 200 without a challenge; new catalog API
HTTP 404. Staging does not yet expose this local implementation, so no live paired
comparison or new-feature activation was performed.

## Controlled staging comparison — pending deployment permission

1. Release the exact validated build with cache and new protection switches off.
   Keep staging cronless and do not refresh its database just to improve timings.
2. Capture a bounded guest baseline. Record build, source date/version, viewport,
   network conditions and cold-browser versus warm-server assumptions. Observe auth
   enabled guests separately from accounts-off local results.
3. With explicit activation approval, use the same build with the staging-only cache
   switch on. Freeze/record source version for the paired run; discard comparisons
   across catalog changes. Verify exact printing/null/artwork parity before timings.
4. Pair browser request/transfer/readiness readings with `auction_catalog_read_cost`
   staging logs. Measure database rows, not SQL statement count. Separate memory-cache
   rebuilds from hits and feed fallback from database snapshots.
5. Exercise unchanged version, version change, timeout, failed refresh, frozen active
   lot, daily snapshot and changed sale quote. Never reprice an active/daily lot.
6. Report distributions and actual cost; leave production cache disabled until reviewed.
   No migration or new upstream/ingestion work is needed for the catalog cache itself.

## Recovery: automated evidence versus physical devices

Local integration uses the actual authentication handler and an in-memory SQLite/D1
adapter, with a captured email transport, not delivered email. Two independently issued
session cookies for the same test account resolve the same recovery key. A committed
write followed by a stale replay returns conflict; signing out one session revokes it
without revoking the other. Fixture-only email cooldowns are reset between those two
sign-ins; this is not a test of real email delivery or provider configuration.

Existing browser tests also cover isolated contexts, encrypted pending drafts,
close/reopen, quota failures and conflict export, using mocked APIs. They do not prove
cross-device browser storage or live provider behavior. The user confirmed a personal
Chrome-to-Chrome setup and realistic desktop Chrome/Firefox-to-Safari use. Acceptance
includes the personal baseline and cross-browser coverage; record whether Safari is
on macOS or iOS/iPadOS instead of treating those devices as interchangeable.

Target matrix (not yet run on physical devices):

| Pair | Why |
| --- | --- |
| Desktop Chrome → Chrome on the second device | Personal baseline; separate storage, same engine family |
| Desktop Chrome → Safari | Cross-engine auth/cookies and encrypted recovery |
| Desktop Firefox → Safari | Independent engine and privacy/storage policies |

Chromium automation is not Safari verification. A future Playwright WebKit/Firefox
pass can add engine coverage, but does not replace Safari on the actual device.
No new browser packages were installed for this task.

Use a disposable staging account, not a valuable wallet. Record device/browser, build,
feature flags, test case, observed result and sanitized evidence. Never record cookies,
codes, recovery keys, secret tokens or pending save contents in logs/docs.

| Physical test | Expected result | Status |
| --- | --- | --- |
| Linked login on A and B | Same owner/preferences, independent sessions | Pending |
| A saves, B submits stale draft | Conflict; B retains export; no money/inventory merge | Pending |
| Offline change, close, reopen, reconnect as same owner | Recoverable draft, one accepted revision | Pending |
| Lost response after accepted save | Conflict on stale replay, no duplicate award | Pending |
| Another owner signs in on same device | No other owner's unlocked draft or wallet | Pending |
| Revoke B from A | B loses authenticated access; A stays signed in | Pending |
| Block/full storage and export | Visible failure; no false persistence claim; private backup | Pending |

## Community protection and moderation — implemented locally, default off

### Burst controls

`AUTH_COMMUNITY_LIMITS_ENABLED` requires two distinct platform bindings. Proposed
starting limits are 120 community reads/minute per coarse anonymous IP key and 60
document/visibility/moderation writes/minute per session-authoritative account key.
Anonymous IP protection is deliberately coarse: shared networks can collide and IP
rotation can bypass it. No auth lookup is added to anonymous reads. Inputs are hashed
for binding keys, not logged; this does not make guessable IPs anonymous.

Cloudflare describes these bindings as per-location, permissive and eventually
consistent, **not exact global quotas**. Production abuse/budget protection may also
need WAF limits or durable global budgets; broader market APIs are not newly protected
by these community-specific hooks. [Official platform behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Enabled protection with a missing/failed binding fails closed. Denials return private,
no-store 429 with a conservative 60-second Retry-After. Writes preserve drafts and
respect the cooldown before a manual/online retry. No new D1 counter writes are added;
normal auth reads still occur before account-scoped write limiting. Thresholds are
initial proposals to validate with legitimate bursts, not tuned production guarantees.

### Moderation

`/admin/community` lists bounded public presentation metadata, not emails, login tokens,
private holdings or save bodies. Hide/Restore requires a verified allowlisted server
admin, a sign-in within ten minutes, same origin, a fixed reason and current revision.
The two-statement D1 batch updates review state and appends an audit event atomically;
an audit failure rolls everything back. Stale reviews return 409. Hidden profiles leave
both directories and direct public API reads; changing owner visibility or saving game
progress cannot clear the review state. Restoring never overrides the owner's opt-out.

Migration `0028_auction_profile_moderation.sql` adds only review state; it is not applied
to persistent local or remote databases (tests use disposable in-memory schemas).
`AUTH_COMMUNITY_MODERATION_ENABLED` is independently default-off.
Private game progress is untouched. Profile deletion cascades review state; the existing
90-day audit policy remains. Frozen snapshots and copies previously shared cannot be
revoked. Reporting/appeals, review queues and verified competitive scoring remain later
work; no anonymous report-write endpoint or automatic punitive scoring was introduced.

### Activation and cost checklist

- Deployment preparation clears inherited switches and these two bindings by default.
  Explicit `--community-limits true`, `--community-read-namespace <integer>` and
  `--account-write-namespace <different integer>` configure the burst bindings. Choose
  unique namespaces per environment after checking the account's existing namespaces.
- `--community-moderation true` requires accounts, account tools and community. Deploy
  once with moderation off, back up the target D1 and apply 0028 after deployment, then
  separately enable after verification. No secret or cron is added. No database has
  been changed by this task.
- Moderation list: session/role validation, one coalesced audit insert and one bounded
  profile query per explicit page/refresh. Accepted state change: two atomic writes
  (review + audit), no private document write. No-op conflict writes no review/audit.
- Enabled public reads add an indexed moderation existence check to existing queries,
  not one lookup per displayed card. Burst-limited reads stop before D1.
- Roll back switches first; preserve review/audit state. Disabling moderation removes
  its suppression, so review exposure implications before doing so.

## Why incremental refactoring fits this repository

Auction UI, timed rounds, serialized saves, owner isolation, price snapshots and URL
navigation share contracts. A broad rewrite could simultaneously change mounting,
timer lifetimes, migration of old saves and when money is written. A regression might
then look like a UI glitch while actually duplicating a charge or adopting another
owner's state. Existing tests protect many of those less-visible behaviors.

Small changes let us pin the behavior, change one boundary and compare the same inputs:
the Inventory placeholder fix, shared public cache and isolated moderation service are
examples. This does not mean the current structure is ideal or a rewrite is forbidden.
A larger rewrite becomes reasonable when measured constraints cannot be fixed locally,
with a clear migration boundary, old/new parity tests, feature flag and rollback path.
Do not add a new state/query framework merely to reduce line count or warning totals.

## Final verification

### Release follow-up — 2026-10-20

The user authorized GitHub, staging validation and subsequent production promotion.
Application `6774350` passed the complete 622-node/117-browser gate and reached
staging first. Live built-code navigation exposed a vinext Link dynamic-export
failure that the dev-server journeys did not reproduce. Auction Hub links now use
the shell's public router callback, retain native modified/target/download clicks,
and perform no speculative prefetch. A separate built-preview/deployed navigation
smoke command checks that three tab changes preserve the document and backdrop
without browser errors:

```powershell
node scripts/cloudflare/auction-navigation-smoke.mjs http://localhost:4184
```

Staging's private full export and Time Travel bookmark were captured with explicit
approval before migration 0028, which is now applied and verified there. Production
account migrations and account activation remain out of this release. Final deployed
versions, protection/cache state and live results will be recorded after verification.

`npm run check` passed on the final source: production build; 622 passing node tests,
one skip; lint with the same 21 existing complexity warnings; type check; all 117
Chromium browser journeys (6.2 minutes). Dark/light and desktop/mobile checks cover
the new loading and moderation surfaces; the suite also exercises Singles and Sealed.
Reviewed moderation and Inventory loading screenshots. Provider/device testing and
actual platform-binding enforcement remain separate from local mocks/integration.

Narrow checks cover cache coalescing/timeouts, real local session ownership, Retry-After,
default-off configuration, audit rollback, reversible moderation, same-catalog 11-vs-2
request parity and an image that never finishes while other data/artwork remain usable.
Regression runs found an outdated absent-statistics assertion and a genuine clickable
Inventory-placeholder race; the test now requires blank reserved statistics and no
active loading controls, and the placeholder is non-interactive. Loading tooltips were
removed to avoid the new skeleton's ID mismatch path. Existing unrelated local D1
missing-history-column and detail-page hydration diagnostics remain in passing fallback
journeys; they are not claimed fixed. An initial leftover test-server startup conflict
cleared before the successful full run.

No generated feeds, dependency lockfile or repository instructions were changed.
Source whitespace/known-credential review passed. No GitHub push, deployment, real
email/provider action, physical-device test or persistent database migration occurred.
