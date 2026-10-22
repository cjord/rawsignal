# Auction Wallet Summary

Follow-up: the user subsequently requested a compact wallet with Total Net Worth,
Showcase Value, inline card counts, a single explanation and reset-only controls.
The [refinement and backdrop plan](auction-wallet-refinement-and-backdrop-plan.md)
supersedes the original copy/control choices below; the accounting remains intact.

## Goal and selected design

The user selected cash-first hierarchy, after-fee card values, subtle green/blue/
purple sections, and direct Inventory/My Showcase navigation instead of an inline
inventory manager. This is the **Auction Wallet Summary**, distinct from real-world
account Collections, Auction Statistics, and the Daily Challenge bankroll.

Available Cash is the headline and means spendable normal-game cash. Beneath it,
Virtual Net Worth, Sellable Inventory and Protected Showcase separate overall
holdings from immediate bidding funds. Counts remain visible. Gross market values
and fee definitions are keyboard/touch-accessible tooltips, not extra headline KPIs.

Inventory and My Showcase links use the persistent Auction Shell. Refresh Market
remains a secondary existing control, along with Reset Cash & Inventory and its
explicit confirmation. The duplicate lobby inventory disclosure is removed;
selling/filtering/pagination remain on the dedicated Inventory page. The wallet
still disappears during active auctions. No normal-save/account format changes.

## Accounting and unavailable data

- Reuse current catalog prices and the fixed 10% virtual fee. No stored valuations,
  new endpoint, polling, ingestion or third-party calls.
- Normal cash + all owned card sale value is the existing net-worth basis. Inventory
  and protected showcase holdings are distinct. Duplicate showcase slots count;
  a card is not counted once in each location.
- Retain the existing per-printing rounding across combined owned quantities.
  Inventory retains its existing sale quote; any shared-printing rounding remainder
  is assigned to the protected showcase subtotal so all displayed totals reconcile.
  Moving cards does not change aggregate net worth by a rounding penny.
- Unpriced holdings keep complete totals N/A. Show counts and known after-fee
  subtotals explicitly; unavailable holdings are never treated as zero. An empty
  inventory/showcase is known to be zero without waiting for the catalog.
- Cash renders as soon as the owner save is available, independently of card prices
  or artwork. A price failure exits Loading into unavailable/last-available values;
  the existing Market Snapshot status owns provenance/retry. No guessed freshness.
- Daily funds are excluded. Net worth is not lifetime auction profit. Showcase value
  does not imply its cards can be sold without first moving them to inventory.

## Loading, design and scope

Owner-loading and resolved wallets share the same component/control slots. Loading
actions are disabled, never links into an unresolved owner save. Card-value rows,
counts and explanatory space are reserved. Both themes, large text and narrow
screens use shared tokens; artwork cannot block balances. No new animation.

This staging release also includes the already-local Account Action Slot, Games
Directory Stable Mount, Auction Hub/pagination/community polish and Backdrop Loop
Track changes described in [navigation/loading polish](auction-navigation-loading-polish.md).
The current user explicitly authorized committing/pushing and deploying to staging.
Production, databases, identity configuration, schedules and saves are unchanged.

## Verification

Pure tests cover duplicate holdings, all-owned fee-rounding parity, movement between
inventory/showcase, unknown-price coverage, fixed fees and separate daily funds.
Browser checks cover exact values, counts, tooltips, narrow/large-text layouts,
cash-before-price readiness, no duplicated inventory manager, same-document links,
sale confirmation/protection and reset behavior. Release gate and staging results
are recorded below once completed.

### Local release gate

Final `npm run check` passed: production build, 675 unit passes (one existing skip),
lint/type checking and all 165 Chromium journeys. The 21 existing complexity
warnings remain; none was added. Focused auction/wallet checks passed 36 cases,
with separate inventory/showcase/loading coverage and both compact-catalog cases.
Screenshots were reviewed at desktop/phone widths in both themes, including large
text and 320px geometry checks. Cash appears independently of held catalog loads.

An earlier full browser run passed 164 cases and found a fixture still opening the
removed lobby inventory drawer. That fixture now renders the dedicated Inventory
page; its changed-price reconfirmation and unpriced-holding assertions are retained.
The final complete gate—not that partial success—is the release evidence. An
earlier lint pass was also followed by a small presentation-helper extraction to
remove the newly introduced complexity warning. The initial restricted local
server startup failed before browser tests and succeeded with the required local
network permissions. No application workaround for these environment/test issues.

Evidence is ignored under `outputs/wallet-summary-release-check.log`,
`outputs/wallet-house-focused.log`, `outputs/wallet-focused-retry.log`,
`outputs/wallet-cache-focused.log` and `test-results/`. Real-device Safari recovery
and populated-account acceptance remain separately deferred, not established here.

### Staging release and live acceptance

Application `60607db` was pushed to `codex/accounts-and-collections`, then deployed
to staging version `d3533f03`. Live inspection confirms existing identity/save DBs,
account flags, secret bindings and limiter namespaces preserved; staging has no
cron and production's deployed version is unchanged. No migration or data refresh.

The live wallet used an isolated guest browser and local-only test holdings, not
a real account. Exact cash/inventory/showcase/net-worth values matched the existing
database-backed catalog and shared fee-rounding model. Desktop/phone, dark/light
and large-text checks found no overflow or page errors. Inventory and My Showcase
navigation retained the document and needed zero additional catalog requests. All
non-GET API calls were blocked; none was attempted. Screenshot review confirmed
the intended cash-first hierarchy in the deployed build.

The broader live smoke passed nine surfaces—Cards Text/Large/Full, Sealed Text/Full,
card detail, sealed detail, Metrics and Auction—at desktop/phone widths in both
themes: all HTTP 200, no overflow/page errors, no API writes. Hub navigation retained
the background with zero catalog reads. Compact delivery remains enabled and
unchanged at 1,583 exact printings, including 128 unavailable prices. Evidence:
`outputs/wallet-staging-verification.json`, `outputs/wallet-release-live-smoke.log`,
`outputs/loading-followup-live-wallet-release.json` and private release setting/version
snapshots under ignored `outputs/wallet-summary-staging-release-*`.
