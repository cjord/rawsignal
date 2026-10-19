# Auction loading and inventory follow-up — 2026-10-19

## Findings and implemented fixes

The page previously began catalog loading before account bootstrap finished.
Changing the owner scope remounted the subtree, aborting and repeating requests.
A cold staging sample made 22 section requests instead of eleven. The save hook
could also create a temporary empty state before the account document arrived,
causing statistics/provenance text to appear and disappear.

This release waits for account readiness before loading the main catalog or save,
and before mounting the shared decorative background. The optional statistics
tracking explanation is now in its definitions tooltip, not a conditional paragraph.
Wallet, statistics and background components are memoized to avoid unnecessary
updates from the auction's quarter-second clock. Inventory rows mount only when
the disclosure opens, with at most 24 visible printings per page. Showcase skeletons
reserve disabled Edit Showcase and Share Showcase controls. Entry help is now
**About Entry Fees**, covering both auction types. No new API, schema, cron or
price-ingestion work is introduced.

Pre-change sample: cold DOM-ready 691 ms / market-ready 1,578 ms, warm 47 / 101 ms.
Only two visits were sampled; network and cache conditions vary. Encoded resource
sizes are not actual network/billing bytes. Decorative image requests sampled at
market readiness do not represent the final total image count.

## Auction Inventory Manager

- Name/set/printing search; rarity, set and priced/unpriced filters.
- Holding sale value ascending/descending, unit price, quantity, rarity and name
  sorts. Missing prices remain N/A and sort last in either value direction.
- Pagination at 24 printings; selecting a page versus all filtered printings is
  explicit. Changing filters/sort clears selection to avoid hidden-card sales.
- Sell Selected and Sell Filtered Extras (Keep 3), with exact copy/proceeds
  confirmation. Keep 3 applies to sellable inventory; protected showcase copies
  are additional. Fees use the fixed 10%, rounded per sold holding.
- Unpriced or unknown printings cannot be sold, are never replaced by a similarly
  named card and remain owned. Showcase copies never enter the sellable list.
- Entire-inventory rarity/Sell All actions remain under a clearly scoped collapsed
  section. Active-auction sales remain disabled. One confirmed action uses the
  existing revision-protected save transaction, not a write per card.

These are virtual game holdings, not Collectr imports or real collections.

## Refresh Market: retain for now

Current code loads prices on page mount or manual refresh. Entering an auction
freezes the already-loaded catalog; **entry does not currently fetch it again**.
Removing the button without changing that would remove the recovery/freshness
option for a long-open tab. Retain it until automatic bounded-age/version checks
on return and before new economic actions are implemented. Then move manual
refresh to a quiet secondary recovery action, or remove it if retry remains clear.

Started auctions, retained cancelled-entry drafts and daily snapshots must keep
their frozen prices. Revalidating market data is not permission to reroll them.

## Next loading work — planned, not implemented

1. Instrument identity-ready, save-ready, catalog-ready and decorative-decode
   separately for guests and accounts, cold and repeat visits. Count requests,
   transfers, parsing time, D1 statements/rows and layout shifts.
2. Finish a route-by-route loading audit: structural buttons reserve their final
   positions; avoid temporary zero statistics/N/A wallets; keep price notices in
   reserved space. Critical account/save errors remain visible, not toast-only.
   Use in-page placeholders, not route-level Suspense loading files.
3. Implement a shared public versioned catalog and in-flight request deduplication;
   only then consider bounded persistent browser cache. Do not delay text on art.
4. Evaluate an owner-only bootstrap response against two coordinated public/private
   responses; a larger private response may lose more cache value than it saves.
5. Introduce the Persistent Auction Shell to remove whole-page/background resets.
   Navigation migration is explicitly **not part of this release**.

Detailed proposals:
[Catalog Snapshot Cache](auction-catalog-cache-plan.md),
[Auction Bootstrap Response](auction-bootstrap-response-plan.md),
[Auction Hub, Inventory Page and Profile Studio](auction-navigation-and-profile-plan.md).
Use the [UI feature map](ui-feature-map.md) for precise future requests.

## Validation

Full `npm run check` passed: 590 node tests passed, one skipped, all 105 Chromium
journeys passed, and type checking passed. Lint retains only 21 existing complexity
warnings. New coverage verifies delayed account bootstrap produces one eleven-feed
wave with no empty-statistics flash, disabled Showcase loading controls, exact
printing/fee preservation, protected duplicate showcase copies, paged filters and
confirmed selected/extra sales. Inventory screenshots were reviewed at desktop and
phone widths in dark/light themes. Existing Singles/Sealed and game journeys passed.
The old local D1 fixture still emits schema/fallback diagnostics during unrelated
detail-page checks; no local or remote database migration was made for this work.
Staging deployment/live timing verification follows the validated source push.
