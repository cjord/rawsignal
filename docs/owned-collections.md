# Account Collections — initial release

## Scope and agreed behavior

Collections tracks real-world holdings, separately from Auction House game inventory.
It requires a signed-in account; guest holdings are never created or imported. The
Collections top-navigation destination is labeled Holdings in the compact phone tab
bar, with the accessible name Collections. Staging keeps its administrator-only
account restriction and separate saves. Production activation is a separate release.

The account can create multiple named collections and view All Collections together.
The initial bound is 20 collections, 1,000 dated lots, 1,000 sale allocations and a
1 MB serialized collection document. These are explicit first-release safety bounds,
not an unlimited portfolio promise. Oversized actions fail without partial imports.

Feature names for future feedback:

- **Collection Overview:** market value, market movement since addition, unrealized
  purchase gain/loss, realized gain/loss, and coverage hints.
- **Holdings Ledger:** thumbnail table by default, sortable headers, optional card
  grid with sorting, search, game/type filters, and 30-holding pagination.
- **Visit Movers:** expandable changes since an explicitly acknowledged review,
  ranked by absolute owned-quantity dollar impact or percentage change.
- **Card Show Mode:** optional per-collection manual sticker price per copy.
- **Sold History:** completed-sale records with retained identity, recorded proceeds,
  purchase-cost coverage, search, event filter, sorting and 20-sale pagination.
- **Card Show Events:** account-wide named/date events with paid shared expenses,
  event proceeds, known purchase costs and net profit/loss; ten events per page.

## Adding and managing holdings

Add from catalog search, the shared single/sealed detail-page action, or the saved
account Collectr import. Only supported exact catalog printings are accepted: Pokémon
and Riftbound raw singles, plus Pokémon/Riftbound/One Piece unopened sealed. Singles
use Near Mint pricing. Alternate printings absent from the current published catalog
cannot be substituted with another printing's price. Condition/graded support and
detail-only alternate-printing prices remain future work.

Each acquisition creates a dated lot with quantity, server-captured market-at-addition
price, source/date metadata, optional purchase cost per copy, and optional sticker
price per copy. Repeated acquisitions retain independent dates/baselines while the
ledger groups exact kind/game/product/printing identity. New acquisitions should be
added as new lots; Manage Lot is for corrections, not backdated purchases.

Reviewed Collectr imports default to Skip Existing within the chosen collection.
Add Quantities creates new dated lots; neither mode deletes/replaces other holdings.
Duplicate source rows of an exact printing have their quantities combined. The preview
excludes unmatched printings and unsupported conditions, and displays exclusions.
Missing single-card condition requires explicit acknowledgment of Near Mint pricing.
Collectr's quoted value does not become the starting market price or purchase cost.
Confirmation captures the latest available server snapshot, which may differ from the
preview. Existing account imports are reused; no extra Collectr fetch is performed.

Record Sale previews oldest-lot-first (FIFO) allocation and accepts quantity plus
**total net proceeds after fees**. Every proceeds cent is allocated once. Sales retain
their original purchase-cost basis even after a later correction/removal of the lot.
The sale timestamp is the time recorded in this release; custom historical dates are
not supported yet. Remove/Correct Entry is not a sale. Card Show sticker prices never
rewrite market values, performance baselines or already recorded sale proceeds.

### Sold History and Card Show Events follow-up (2026-10-21)

The follow-up retains completed sales, not hypothetical future resale estimates.
New sales save a common transaction ID across FIFO allocations and a card/product
identity snapshot. They appear as one sale and remain readable after the last owned
copy is sold or its lot is removed. Historic cost/proceeds do not change when market
prices or the remaining lot's cost change. Older sales without a transaction ID remain
separate allocation records; grouping is not guessed from matching names/timestamps.

The sale form suggests a sticker total for the selected FIFO quantities only when
every allocated item has a sticker price. Changing quantity updates an untouched
suggestion; typing a negotiated total takes control and is not silently overwritten.
Use Sticker Total explicitly restores the suggestion. Missing sticker values leave
the amount blank, and a zero sticker value is valid. The final entry is **net proceeds
after fees**: sticker suggestions do not automatically subtract selling fees.

Card Show Events have a name, explicit calendar date and optional total expenses
already paid (table, travel, supplies). Sale-level fees already deducted from proceeds
must not be entered again. Up to 100 events reuse the same account document; no SQL
migration, new database resource or public profile is introduced. Event fields and
sale references are server-validated, revision-protected and owner-scoped. Existing
version-1 documents without optional event/transaction/snapshot fields remain valid.
Account export/deletion continue to include the whole document automatically.

Choose an event when recording a sale, or assign/reassign it later in Sold History.
Assignment changes the entire original transaction across all its lot/collection
allocations, not quantities, proceeds or cost basis. Events may span several named
collections. Shared expenses are therefore deducted **once in All Collections**, not
arbitrarily split across collections. Individual collection totals show card profit
before shared event expenses. Event summaries always show the complete account-wide
event, regardless of the selected collection.

Overview now shows realized card gain/loss, unrealized purchase gain/loss and combined
profit/loss separately. Each eligible owned lot contributes independently, even if
another lot of that printing lacks a cost. Sold gains include only recorded sales with
known purchase costs; excluded sales' proceeds are not treated as pure profit. Both
figures disclose cost/price coverage counts. Combined profit sums the known realized
and unrealized portions, then deducts paid event expenses once at account scope.
It is explicitly partial when coverage is incomplete. An empty side contributes zero;
if all existing holdings/sales lack usable costs, profit is unavailable, not a guessed
zero. An empty portfolio with actual event expenses correctly shows an expense loss.

Event profit likewise uses known-cost sales profit minus all its paid event expenses.
The proceeds tile includes all event sales, but missing-cost sales and their proceeds
are excluded from the profit calculation. Coverage and partial-result explanations
remain visible. Event expense edits update summaries without rewriting sale history.
Refunds, cancellations, historical sale editing and per-expense itemization remain
future work; this is a personal ledger, not tax reporting or a marketplace checkout.

Unrealized gains use current market value before any future sale fees; combined
profit is not a cash balance. For example, a completed sale with $70.01 net proceeds
and $22 purchase cost has $48.01 realized card profit. A $5 paid show expense leaves
$43.01 combined/event profit when no other holdings or sales are present.

Validation passed: full `npm run check`, 647 passing unit tests (one skip), 123
Chromium journeys, type check and lint with 21 existing warnings and no new warnings.
Focused coverage includes legacy document compatibility, canonical retained sale
identity, cross-lot grouping, exact proceeds cents, unknown costs, event validation,
ownership/revision/export, editable FIFO sticker suggestions, assignment and expense
edits, reload persistence, and desktop/mobile dark/light views. This is browser
automation, not real-device or signed-in staging acceptance.

This follow-up is included in the interface-polish staging release. Its original
focused validation is recorded above; the combined release passes 652 unit tests
(one skip) and 126 Chromium journeys. No schema migration is required.

### Collections interface polish (2026-10-21)

The [ten-area interface review](collections-interface-review.md) adds first-use
setup continuation, explicit unit prices, compact full-width dated-lot expansion,
actionable data-coverage filters, URL-backed filtering/sorting/pagination, stable
reloads and confirmed-save notifications. An uncertain save blocks subsequent writes
until a successful explicit reload; it never automatically replays a sale.

Private Holdings and Sold CSV downloads cover all matching rows, not just the visible
page. Holdings export is per dated lot; Sold export is per recorded allocation.
Unit prices, quantity, optional costs/stickers and market provenance are explicit;
unavailable values stay blank. Untrusted text is protected against spreadsheet-formula
injection. Downloads contain private financial information and are user-initiated.

## Performance and review math

All money uses integer USD cents. For copies still held:

- Current value = current unit market price × owned quantity.
- Starting value = sum of each lot's unit market-at-addition × remaining quantity.
- Market movement = current value − starting value; percentage divides by starting
  value. Added stock changes contributions, not gains.
- Unrealized purchase gain/loss uses optional purchase costs, not starting market.
- Realized gain/loss uses recorded net proceeds minus allocated known purchase cost.

Missing price/cost pairs remain unavailable. Overview sums show known comparable
coverage, rather than silently guessing missing holdings. A database-to-feed fallback,
known older source snapshot, or undated cross-source transition does not manufacture
a gain/loss. The current value can still be displayed with its explicit source label.
Bundled fallback source dates are unavailable; same-feed comparisons therefore do not
claim verified daily freshness. No ingestion refresh is triggered by viewing a collection.

Mark as Reviewed stores prices/quantities by dated lot ID. Opening/reloading never
advances this checkpoint. Each collection and All Collections retain the last three
distinct **UTC review days**; another review that day replaces that day's point.
Movers compare only quantities present at both the review and now (minimum of the two),
exclude newly added lots/copies, and separately report additions. Sales/removals do
not appear as negative market movement. A holdings-aware history chart, transfers,
collection deletion and bulk sticker editing are not in this release.
Full collection records are included in the existing account export.

## Storage, privacy and loading

`raw-signal-owned-collections-v1` uses the existing `account_documents` D1 table;
there is **no schema migration**. Pure contracts/calculation/actions live in
`core/domain/owned-collections.ts` and `collection-actions.ts`; canonical prices are
loaded through `db/collection-market.ts` and `worker/collection-market.ts`.

Private `/api/account/collections` GET/POST is mounted inside the authenticated
account boundary before public caching. Ownership comes from the session, not a
caller-provided user ID. Writes also require matching origin, bounded JSON, the
existing per-account burst limiter, and an exact document revision. The generic
account document write endpoint rejects this key. Baselines are captured by the
server, never accepted from the browser. Atomic compare-and-swap rejects concurrent
edits instead of merging quantities or overwriting another device.

The ledger is loaded on demand, not in every account/session bootstrap. It is included
in account export, deletion and existing save-health telemetry. No collection holdings
are exposed in public profiles, showcases or leaderboards. No guest/localStorage copy
or offline action queue is maintained. Failed/conflicting dialogs retain inputs in the
current tab; reload the saved version and review before retrying. If a response is
lost, reload first rather than replaying a purchase or sale blindly.

The page reuses TopBar, footer, product identity/image fallback, market tabs, segmented
view controls, sortable headers, pagination, InfoHint, native accessible dialogs,
metric anatomy, theme tokens, and reduced-motion behavior. Text/data do not wait for
artwork. In-page skeletons reserve loading space; route-level loading.tsx is not used.

## Cost and deployment

Current published D1 prices are retrieved by a bounded batch of exact references
(JSON binding), not a query per card or an upstream price request. The standard
readiness check still applies. When D1 is unavailable/unpublished, the compact bundled
fallback is loaded once per warm asset-binding isolate for five minutes, with in-flight
coalescing; a cold fallback may read all supported feed sections. This adds no daily
ingestion work, source credits, cron or database resources. A collection save replaces
one bounded document; normalized tables should be considered before raising limits.

`AUTH_COLLECTIONS_ENABLED` is explicitly default-off in deployment preparation and
requires accounts. Use `--collections true` only on the intended deployment; it cannot
leak from another environment's configuration. Keep account/identity/save bindings,
secrets, staging no-cron and the existing compact-catalog-cache setting unchanged.
Rollback disables the feature flag or restores the prior Worker; stored documents
remain intact. No migration rollback is needed.

## Validation and release status

Focused checks cover baseline/contribution math, missing/older-source handling, exact
identity, review retention, FIFO/cent allocation, sticker independence, import atomicity,
authentication/owner isolation, origin checks, revision conflicts, server-owned baselines,
private bootstrap/export/deletion, explicit feature flags, and browser interactions.
Browser fixtures cover dark/light desktop/mobile, import confirmation, and conflicts
retaining inputs without automatic replay. These are not physical-device acceptance.

Application `b784a9e` is pushed to GitHub and deployed to staging as version
`db580987-d9a0-4da8-a21e-5aae074c5a36` (2026-10-21). Full gate passed: 639 unit
tests (one skip), 122 Chromium journeys, type check and lint with 21 existing
complexity warnings and no new warnings. Live guest Collections rendering,
private/no-store 401 API behavior, explicit feature/shared-identity flags,
desktop/mobile dark/light layouts and representative Singles/Sealed views passed.
There were no browser errors, guest collection reads or account writes during live
verification. Original identity/save bindings and secret names are preserved;
staging has no cron. Production's deployed version is unchanged. No migration was needed.
Signed-in staging acceptance must use the user's real admin login, not impersonation.
Production deployment is not authorized as part of this task.

Signed-in acceptance checklist (use a clearly named staging test collection): create
a collection; add an exact catalog item and another dated lot; enable Card Show Mode
and set different sticker prices; compare Table/Card Grid and filters; explicitly
mark reviewed and confirm reload preserves the point; review an account Collectr
import without confirming until its exclusions/quantities are correct; preview and
record a test FIFO sale, then check the account export. On a second real browser,
load the same save, edit on one device, and verify a stale edit on the other is
rejected without losing form inputs. Staging test records never affect production.
