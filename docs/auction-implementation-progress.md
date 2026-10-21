# Auction platform implementation — 2026-10-19

**Release update 2026-10-21:** application `44ecc7a` is pushed and deployed to staging
and production after full regression and live staging checks. The historical local-only
notes below are superseded by [release evidence and remaining gates](auction-loading-and-safety-follow-up.md#release-results--2026-10-21).
Accounts/moderation remain staging-only, migration 0028 is applied there, and compact
caching is off in both environments after failed live parity. Physical-device recovery
and production custom-domain browser verification remain pending.

The user authorized beginning the previously documented plans on 2026-10-19.
This supersedes the earlier planning-only restriction for navigation. Implementation
is phased; **no GitHub push, staging deployment or production change is authorized
by this new request**. Existing live releases are unchanged.

## Phase 1: Catalog Snapshot Cache foundation — implemented locally, off by default

- A public Worker-native `/api/auction/catalog` manifest and version-addressed body
  replace eleven section downloads when the experimental feature is enabled.
- The compact body contains Riftbound identity/printing, name, set, rarity/section,
  canonical artwork and nullable current market cents only. It omits history,
  metrics, listing extremes, account data and internal ingestion IDs.
- SHA-256 hashes the canonical content and source metadata, not merely a timestamp.
  Source date/published date and database/feed fallback are explicit. Version/body
  disagreement, duplicate printings and malformed rows are rejected.
- D1 reads reuse the published catalog readiness gate and recheck completeness,
  current-price coverage and the pointer in the same SQL snapshot as the card rows.
  A newly started in-place ingestion cannot silently serialize a partial old run.
- One in-flight request and a 60-second per-database server memo coalesce work.
  Versioned bodies can use the existing public edge cache; manifests are revalidated
  rather than retained in that cache. Missing versions return 409 so the browser
  can retry the manifest once. Errors are no-store.
- The shared browser-memory cache deduplicates concurrent readers, reuses a checked
  version for five minutes and downloads a body only when its content version
  changes. Consumers unmounting cannot cancel another consumer's request. No
  IndexedDB/localStorage catalog persistence has been added yet.
- Auction Lobby, Inventory, Profile Studio and My Showcase have feature-gated
  integrations. The existing eleven-feed path runs unchanged while the switch is
  off; it makes no speculative cache API call. A failed check retains last-good
  valid prices with a visible warning, allowing entry/sales as the user requested.
  No previous valid catalog means no entry or sale. Started auctions stay frozen.
- The existing private session/bootstrap already supplies owner progress/preferences;
  no duplicate personalized bootstrap endpoint was introduced.

### Rollout boundary

`AUCTION_CATALOG_CACHE_ENABLED` defaults false. Preparation accepts
`--auction-catalog-cache true` **only for staging** and explicitly resets inherited
values. The server-side page feature and endpoint both refuse production activation,
even if an enabled value is accidentally supplied. This is a local implementation,
not an instruction to turn it on or deploy it.

**Do not activate yet:** measure D1 read rows and live parity in an authorized
staging release. Transaction-time checks and changed-quote confirmation are now
implemented locally, but this is not the complete cache rollout.
Retained cancelled-entry drafts and daily snapshots must never be rerolled/repriced
by that check. Manual Refresh Market remains available.

### Cost and verification

Cold database construction uses three read statements: published marker, indexed
readiness count, and the guarded Riftbound catalog query. Statement count is **not
rows read**: readiness counts walk the published-run index and the guarded query
rechecks coverage. Hot server memo hits add no database statements; expiry may
rebuild the catalog even when unchanged. Measure this before enabling it on any
busy environment; a future cheap identity probe or longer safe memo could reduce
unchanged-run work. No new D1 writes, migrations, upstream price/history calls,
artwork checks, scheduled work or account bootstrap reads are added.

Eleven new node tests cover contract/hash validation, null/exact printings, shared
requests, expiry, publication races, malformed payloads, last-good retention,
fallback downgrade protection, SQL consistency, fallback completeness and rollout
guards. A new browser journey exercises the enabled path with zero section feeds,
cross-consumer reuse, unchanged-version checks, frozen entry prices and retry.
The consistency tests include duplicate-retry undercounts: a running/failed new
Riftbound run cannot masquerade as a complete older run just because the older
published `recordsWritten` counter was lower than its physical row count.
The final combined `npm run check` passed: 604 node tests, one skip and all 109
Chromium browser journeys; build, lint and type checks passed. The 21 existing
complexity warnings remain, with no new lint warnings. The layout characterization
now checks computed full width and its actual 1,440px bounds, instead of pinning the
old page-level class name. Navigation, profile editing, quote changes, frozen lots,
owner isolation and desktop/mobile dark/light layouts are covered.

The local browser server also logs placeholder-D1 missing-column and detail-page
hydration diagnostics outside these auction changes. The fallback journeys pass;
this work does not apply local or remote database migrations or repair those pages.

Bundled-data payload comparison (1,333 exact-printing records, no source refresh):
eleven existing files total 631,621 raw bytes / 66,626 gzip bytes; the compact body
is 203,924 raw bytes / 26,067 gzip bytes. That is about 68% smaller raw and 61%
smaller with gzip. These are local serialization sizes, not measured live network
bytes, D1 costs or a guaranteed page-speed improvement. First load needs a small
manifest plus a body; unchanged in-memory consumers reuse the checked version.

## Phase 2: Persistent Auction Shell, Auction Hub and Inventory Page — local

- A nested auction layout retains one Top Bar, footer and scrolling background.
  Internal links use client navigation without automatic adjacent-route prefetch.
  Heading focus updates on navigation. External links remain ordinary links.
- The confirmed compact icon-and-text tabs are Play, Inventory, My Showcase,
  Community (Leaderboard / Public Showcases) and Guide. Daily Challenge is under Play.
- `/games/riftbound-auction/inventory` reuses the existing manager and single owner
  save. Search, rarity, set, availability, sort and page are URL-backed; selected
  holdings and confirmation state are not. The lazy inline manager remains during
  transition; both protect showcase copies and block sales during active auctions.
- Browser verification confirms unchanged document time origin and background DOM
  node across navigation, Back restoring filters and an active auction surviving a
  visit to Guide. Auction deadlines continue; navigating is not abandoning a lot.

## Phase 3: Profile Studio / Profile Card Backdrop — local

- `/games/riftbound-auction/profile` is explicitly an owner preview, separate from
  live public viewing and the private account/security Profile. My Showcase links
  to it. Public username stays authoritative in Account Profile, not a second field.
- Edit Profile Appearance offers up to twelve unique exact Riftbound printings from
  the catalog, including unowned/unpriced cards with artwork. Decorative choices do
  not create holdings or consume showcase slots. Empty selection uses the default.
- Draft edits preview immediately, with explicit Save/Cancel, an internal-link
  discard warning and native refresh/close warning. Drafts are not cloud writes.
  Browser Back/Forward is not forcibly hijacked; leaving can discard unsaved edits.
- One bounded, validated account preference stores IDs/printings, not arbitrary image
  URLs. Signed-in saves reuse existing document sync/recovery/export/delete behavior;
  guests remain isolated. No new database table or migration.
- Public profiles resolve canonical artwork from the published catalog only when
  showcase viewing is opted in. Leaderboard-only profiles do not expose cosmetic
  choices. No wallet, private inventory or email enters the public payload. Frozen
  Showcase Snapshot links retain their old contract, not live profile appearance.
- Profile backdrop applies to the owner preview, My Showcase and opted-in public
  profile. It does not change auction contents or everyone else's lobby background.
- Opening the owner preview does not publish anything. Saving appearance updates an
  already-public account profile automatically; it never switches visibility on.
  Appearance uses one existing preference-document save, not one write per chosen
  card; choosing/previewing cards does not save. The public profile's existing
  metadata query includes at most twelve additional product IDs. An otherwise empty
  showcase now needs that published-catalog lookup when it has decorative artwork.

## Phase 4: Transaction-time price checks — local, cache-gated

New normal-auction drafts force a manifest check before capturing their pool. An
unchanged version downloads no body. Cancelled-entry drafts, started lots and daily
snapshots bypass repricing/rerolling. Entry double-clicks are guarded while checking.
All selected/extras/rarity/Sell All confirmations share one sale component. It checks
prices, re-quotes changed count/proceeds and requires another confirmation before
charging; the final revision-protected transaction rechecks holdings and active-auction
status. A failed refresh can use the last valid snapshot; null prices remain unsellable.
The legacy feature-off feed path retains its existing page-load/manual refresh behavior.

## Remaining rollout work

1. Full local release gate is complete as recorded above. This is not live staging
   evidence or proof that real provider/account flows were retested against staging.
2. With separate push/deploy permission, verify staging catalog parity, source dates,
   failed-refresh behavior, frozen lots/daily runs and real signed-in appearance sync.
   Measure D1 read **rows**, not just statement count, before enabling cache traffic.
3. Retain the explicit feature switch and production refusal until those results
   justify a separately approved rollout. No database/cron/source refresh is needed
   for the navigation and profile features themselves.
4. Consider bounded IndexedDB catalog persistence only after the memory cache is
   measured. Keep manual Refresh Market during the feature-off transition; it can
   become a quiet recovery action after automatic checks are activated.

All three design questions were answered 2026-10-19 and implemented as above.
Remaining: authorized staging parity/read-row measurements, then
explicit rollout approval. IndexedDB persistence and any new personalized bootstrap
remain deferred: the existing private session bootstrap already supplies owner saves.
No performance claim beyond the local payload comparison has been made.

References: [cache design](auction-catalog-cache-plan.md),
[bootstrap alternative](auction-bootstrap-response-plan.md),
[navigation/inventory/profile design](auction-navigation-and-profile-plan.md),
[feature names](ui-feature-map.md).

## Phase 5: Quality and measurement — local

The [quality improvement plan](auction-quality-improvement-plan.md) records bounded
requests, save-response owner/revision checks, private Saved Account Export, query
guards, shared loading/retry components and tests. Initial local cache-off sampling
records baseline latency and remaining cold-shell movement, not a live speedup.
Read Cost Meter uses metadata from existing staging statements only. No tables,
migrations, cron, ingestion or upstream calls added. Full gate passed: 613 node tests,
one skip, 113 browser journeys, build/types/lint with 21 existing complexity warnings.
Existing local D1/history and detail hydration diagnostics remain documented. No
push/deploy occurred.

## Phase 6: Traced loading and community safety — local

[Goals and detailed evidence](auction-loading-and-safety-follow-up.md): late lobby
insertion and Inventory's one-line filter fallback caused the major measured shifts.
Structure-preserving shells reduce the local bounded medians to ~0.00091 / 0.00044.
Legacy public catalog reuse removes eleven repeat requests during internal navigation;
fresh documents still need the original eleven files. Nearby artwork is independent
of unrelated window images. The same-data transport comparison checks 11-versus-2
requests with exact printing/price/null parity. Staging's endpoint is still 404.

Two actual local authenticated sessions now exercise recovery-key ownership, conflict
and revocation in addition to mocked browser coverage. Physical-device testing remains.
Community burst bindings and audited public Hide/Restore are local/default-off, with
pending moderation migration 0028. No deployment or persistent database mutation.
Final full gate passed: 622 node tests / one skip, 117 browser journeys, build/types/lint
with 21 existing complexity warnings. Placeholder interactivity and the reserved-statistics
contract were corrected during regression checks. The physical Chrome/Firefox/Safari
matrix is documented but pending. Earlier Phase 5 results are the prior checkpoint.
