# Auction community and management follow-up

## Scope (2026-10-19)

Released to staging from `codex/accounts-and-collections`, source `19bc36e`, Worker
version `05b35536-032a-4995-87b5-1eb0ba2887d4`. Production accounts remain disabled;
no production source/configuration/database deployment was performed.
Migration 0025 adds the earlier recovery/audit foundation; additive migration 0026
adds support counters and account-linked public auction profiles.

## Public showcases and leaderboard

- `/games/riftbound-auction/showcase` retains the editable owned-card showcase and
  frozen URL-fragment sharing. Signed-in users additionally choose a public display
  name and independently opt into public showcase viewing / leaderboard participation.
  Both switches default off. Provider names/emails are never substituted for the
  public name; names are not unique or verified identities.
- `/games/riftbound-auction/showcases` lists opted-in showcase accounts, newest save
  first. `/games/riftbound-auction/players/[id]` shows the account's current selected
  cards and explicitly projected auction statistics. IDs are random public UUIDs,
  not account IDs. Wallet cash, sellable inventory, daily progress, hidden auctions,
  authentication data and imported real collections are not returned.
- `/games/riftbound-auction/leaderboard` ranks opted-in accounts with at least one
  settled normal auction by lifetime net auction P/L, descending. Ties use settled
  auctions descending, then public ID ascending. Each page contains 25 entries and
  uses indexed keyset pagination. Live score changes can move entries between pages;
  this is not an immutable competition snapshot. Daily challenges remain separate.
- All results are **browser-reported and unverified**. Account ownership proves who
  submitted a save, not that gameplay was honest. No prizes, verified ranking claims
  or server-authoritative economy are introduced. Server-verified daily scoring is
  a separate future project; do not imply this board has anti-cheat protection.
- Scores are projected atomically from the existing revision-checked game document
  by SQLite triggers; stale cloud writes cannot change them. A reset clears ranking
  eligibility until another normal auction settles. Account deletion cascades the
  public profile. No separate client-provided score endpoint is exposed.
- Visibility writes are session-owner scoped, exact-origin checked, bounded to 1 KiB
  and allowlisted. Public output has explicit fields; even extra properties in a saved
  statistics object cannot leak. Public APIs bypass edge caching and return no-store.
  Making both choices private revokes future profile reads; making only cards private
  leaves opted-in leaderboard statistics public. Existing viewers, screenshots and
  frozen snapshot links cannot be recalled. Frozen links remain non-revocable.
- Public artwork/names/prices come only from the published Riftbound singles catalog,
  never arbitrary saved URLs or invented card prices. At most 20 selected slots are
  enriched in one bounded catalog lookup; duplicate slots remain separate. Another
  printing's price is never substituted. Unmatched/unpublished prices stay unavailable.

## New management pages

All inherit the server-side admin guard and mandatory access audit. They are read-only,
private/no-store, noindex, manually refreshed, and add no market-source calls or cron.

1. `/admin/accounts`: exact account-ID support lookup, with one required fixed purpose
   (`sync-support`, `account-access`, `user-request`). POST keeps the target out of page
   URLs. Audit records include target ID and purpose before data is read. Results show
   creation/verification metadata, linked provider names/dates, active-session count,
   document keys/revisions/byte sizes/update dates and at most 100 last-30-day counters.
   No email, IP, credentials, provider account IDs or saved document values appear.
2. `/admin/quality`: published-run product totals, missing current price/artwork URL/
   stored product-history counts, largest 50 sets and up to 25 duplicate-identity review
   candidates. Product history coverage does not prove every printing/condition matches;
   image URL presence is not a live image-availability test. No history JSON scanning,
   auto-merging, source fetching or signal promotion. A coverage notice compares rows
   still stamped with the published run against its recorded writes; an in-flight live
   walk can restamp rows before publication.
3. `/admin/jobs`: latest 20 ingestion attempts, status/timestamps/written/rejected counts,
   an error-present flag (never raw error text), recorded email/eBay UTC budget counters
   and applied account migration names. Provider dashboards are not contacted. Missing
   Wrangler ledger data is unavailable, not automatically marked applied. No run/retry/
   backfill/reset controls are added.

Sync health starts at activation and records daily per-document `saved`, `conflict`,
and recognized `invalid` outcomes for an authenticated owner. It does not reconstruct
older activity, transport failures, browser drafts or recovery counts. Telemetry failure
never changes an already-successful cloud-save acknowledgement. Only 30 days are read;
older counters are not automatically deleted in this slice. Bounded retention cleanup,
support access policy and authentication/profile/deletion event coverage remain open.

## Loading changes

The guest warning is rendered only after account bootstrap confirms a guest, never
while identity is loading or unavailable. This prevents a signed-in guest-banner flash.
Decorative auction art retains its layout but remains transparent until image decode
completes, then fades in. Failed/no-photo artwork is removed. Reduced motion removes
the transition and drifting animation. No new catalog/history requests are added.

## Incremental work and calls

- Ordinary public market pages and daily ingestion are unchanged.
- Enabling audit support counters adds one small upsert to each authenticated document
  save/conflict/recognized invalid request. It is not an exact request/event ledger.
- Existing accounts with a public-profile row add one trigger update to a successful
  Auction House document save; other documents and accounts without that row do not.
- Own visibility loads/settings writes happen only on My Showcase. Public directory /
  leaderboard pages perform a bounded indexed read, no polling; public profile reads
  add a bounded selected-card catalog read/readiness check only if cards are public.
- Admin reads are manual, audited queries. Catalog coverage aggregates scan the current
  catalog, not the large observation archive. Restrict access and precompute these
  summaries if admin traffic or catalog size grows significantly.
- Public read throttling at the edge, per-account save/visibility throttles, moderation
  and server-verified scores are launch hardening work before high-traffic production.
  Account document exports still export the existing document domains; include the
  new visibility/display-name settings in a reviewed full-account archive before a
  production privacy/portability launch. Audit target filtering and richer exact-variant
  public pricing are useful next UI work; audit target IDs are already visible.

## Rollout

Local release gate passed on 2026-10-19: 580 node tests passed, one skipped;
all 100 Chromium journeys passed; type checking passed and lint retained only
the 21 pre-existing complexity warnings. The existing winner-presentation journey
now pauses its clock before checking the brief bid-lock state, then explicitly
advances into winner/results; no gameplay assertion was removed. Account/public
visibility, revocation, reset/deletion, ownership isolation, DTO privacy, pagination,
support audit and decoded-art/guest-banner behavior have focused coverage.

Staging release completed: disabled-feature deploy first, then migrations 0025/0026,
then enabled-feature deploy of the same build. Both migration records and all four
new tables were verified. A private database export and recovery bookmark were saved
before migration. Existing OAuth/email/admin/auth-secret configuration was preserved.
No market refresh, daily-lineup replacement, new schedule or production write occurred.

Live staging checks passed for session feature flags, no-store community APIs,
anonymous rejection on new private admin/settings APIs, guest redirects on management
pages, leaderboard/showcase directory/profile controls for guests, and desktop/mobile
layouts in both themes. The real lobby became market-ready and all 108 decorative
image elements decoded/loaded. No emails sent or real account saves changed. Live
authenticated admin/recovery/visibility workflows still need review in the user's
existing signed-in session; local integration/browser coverage checks those boundaries.

Full gate → commit/push exact validated source → deploy staging with accounts enabled
but tools/community disabled → record staging recovery bookmark/export → apply pending
0025/0026 → explicitly prepare with `--account-tools true --account-community true`
and redeploy the same build. Preserve `AUTH_SECRET`, existing OAuth/email secrets and
the owner allowlist; no new secrets are required. Keep staging cron absent. Public
features and recovery/admin tools default off in a newly prepared config and never
inherit enabled flags accidentally. Production remains unchanged.

Rollback disables tool/community flags without dropping keys, audit, profiles, game
saves or daily manifests. Do not attempt a database rollback as an automatic deploy
fallback; user saves may have changed since the recovery point.
