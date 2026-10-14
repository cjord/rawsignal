# Riftbound Auction House — prototype

Source: user-supplied Game Design Plan v1.0 and confirmed decisions, 2026-10-14.
Route `/games/riftbound-auction`, tile alongside Showdown on `/games`.

## Scope and rules

- One free-entry small-binder auction at a time; replay supported between auctions.
  The stable seeded fixture has 24 identities, two copies each when enough catalog
  records exist. Contents derive from current priced Riftbound records, exclude
  missing/nonpositive prices and empty artwork, and freeze before round 1. A small
  test/fallback catalog can yield fewer identities; counts remain honestly bracketed.
  Approximate count is public; exact count requires a clue or final reveal.
- $2,500 virtual starting cash. Three NPC personalities, independent sealed bids,
  25/25/20/20-second deadlines, and 100/60/30% early-buyout thresholds. At least two
  positive bids are required for early buyout. Round 4 uses the highest positive bid;
  ties use seeded rotating bidder priority, all passes mean no sale.
- Locking is final and blocks investigations. Unsubmitted bids expire to $0;
  passing does not eliminate a bidder from later rounds. All locks resolve the
  round immediately, with remaining NPC timings accelerated to 0.5–3 seconds.
  Round bid reveals have a manual Continue so players can review before the next
  deadline starts. Reload/background time does not pause an active deadline.
- NPC bid amounts are fixed before the player's lock. Their valuation function
  receives only publicly visible starting cards, a bounded private sample, the
  count range, personality and already-revealed prior bids—not full lot value or
  the current sealed player bid. Each prototype auction gives NPCs fresh $2,500
  bid budgets; private inspection has no modeled charge in this first phase.
- Fifteen fixed-price investigations in Basic/Targeted/Strong/Premium tiers,
  with the design's tier progression, one optional purchase per round, no repurchase
  and no refunds. Prices do not depend on hidden lot value. Identity-only clues
  retain “Price Unknown.” Known value sums individually priced slots once;
  aggregate clues are kept separate to avoid overlapping subtotals.
- Settlement reveals all copies, highlights top-value cards, reports gross spread,
  modeled fee, winner net profit/loss and the player's expenses/result. Only the
  winner's bid is charged; information costs remain spent on losses. Settlement is
  a single idempotent state transition, including across reloads.

## Saved inventory and economy

- Browser-only `raw-signal-auction-house-v1` localStorage. Wallet stores cash,
  configurable fee basis points (default **10%**) and holdings by product ID,
  printing and quantity. It does not store inventory prices or derived values.
- Inventory is repriced from the current catalog on page entry or explicit
  Refresh market. It is not a live streaming quote; existing feed cache lifetimes
  apply. Header: `$cash + ($after-fee cards)`, with accessible fee/provenance tooltip.
  Missing current prices render N/A, remain owned, and are never sold as zero.
- Between auctions, players can optionally sell all priced holdings after a
  confirmation. Unpriced holdings remain. The fee is applied once to each printing's
  quantity subtotal, rounded to cents; the same quote powers display and sale.
  Fee settings accept integer percentages 0–100 between auctions, not during bids.
  No actual marketplace commission claim is made.
- An unfinished auction separately stores its frozen lot, purchased clues, locked
  bids and absolute deadline so reload cannot regenerate a lot or refund expenses.
  Finished review persists until the player returns to inventory management.
- Saves are versioned and validated. Corrupt data is preserved until an explicit
  reset. Failed storage writes do not charge or advance the action. Storage events
  and a revision check detect stale-tab edits; this is not a secure concurrent
  database or tamper-proof competition. Reset confirms removal of this game's
  inventory/auction and restores $2,500 cash/10% fee; other site storage is untouched.

## Architecture, cost and validation

Pure modules under `core/domain/auction-*` handle lots, clues, NPCs, settlement,
inventory pricing and save validation. React components in `app/games/Auction*`
compose the existing shell, InfoHint, DeferredImage, native dialogs and tokens.
Collection and controls share columns on desktop, stack on phones; entry/next-round
scroll to the arena and a jump-to-bid link assists phones. Artwork is uncropped and
lazy; failures use the existing fallback without changing a frozen lot.

Existing eleven Riftbound section feeds load once per page entry (and once again
only on explicit Refresh market). No per-round/inspection/investigation/sale API
requests, upstream pricing calls, database writes, schema changes or cron changes.
Image-CDN requests remain separate and bounded by visible card thumbnails.

Tests cover cents math, frozen lots, buyout boundaries/ties, independent locks,
deadlines, single settlement/charges, clues without price leaks, live inventory
repricing, fees, unavailable holdings, save validation, reloads and reset. Browser
journeys exercise scoring/settlement/sale and no extra pricing calls, plus dark/light
desktop/mobile layouts. Full release gate required before publication.

## Deferred

Initial release validation (2026-10-14): `npm run check` passed—409 unit tests,
one skipped; 37 Chromium browser tests; no new lint warnings. The twelve new domain
tests and four Auction House journeys cover the boundaries above, including real
epoch timestamps in saved auctions. Existing Showdown, Singles and Sealed journeys
remain green. Visual checks cover desktop/mobile dark/light; no data feeds were
regenerated or hand-edited. Publication is staging-only for this prototype.

Procedural seller/lot profiles, paid-entry lots, condition-based clues, individual
holding sales, five/eight-auction competitive sessions, persistent NPC bankrolls,
daily seeds, accounts/leaderboards and multiplayer. Prototype balancing is not a
promise of real resale profitability. All money is fictional and nonredeemable.

## Staging release — 2026-10-14

Application commit `15e5978`, Worker version `7ad69954`. Deployed to
`https://raw-signal-staging.raw-signal-watch.workers.dev/games/riftbound-auction`.
Live browser verification passed for the tile artwork, 48-copy real-catalog lot,
sealed bidding/early buyout, full reveal, saved inventory after reload, after-fee
sale, reset and desktop/mobile dark/light layouts, with no browser errors. There
were eleven initial catalog requests, zero further gameplay pricing requests,
and eleven requests on the explicit verification reload. The first tile check
timed out under a simulated browser clock; moving clock simulation until after
tile loading let the complete real-page journey pass. No site change was needed.
Some source images are unavailable and use the established fallback without
changing frozen contents or valuation. Production remains unchanged; staging
data is intentionally stale and no ingestion/data refresh was performed.

## Tile artwork asset and prompt

Imagegen skill, built-in generation mode. Saved workspace asset:
`public/images/games/riftbound-auction-house.webp` (1536×1024). Source PNG retained
in the generated-images library; WebP conversion only compresses the format.
Final generation prompt:

> Use case: stylized-concept. Asset type: landscape 3:2 website Games tile for Riftbound Auction House, matching a dark blue/purple trading-card market site. Scene: a premium dark auction table with a partly open card collector binder containing face-down dark teal-blue and black trading cards with restrained gold geometric ornament, a small stack of cards, and one elegant auctioneer gavel on its sound block. Style: polished cinematic matte 3D illustration, crisp silhouettes and restrained atmosphere. Balanced compact composition, all focal objects fully visible with generous margins, legible as a small thumbnail. Electric blue and violet rim lighting on charcoal/navy surfaces, subtle warm gold details. Mystery card-collection auction, not a casino. No coins, no cash, no chips, no characters, no text, no prices, no readable logos, no watermark. Title will be HTML outside the artwork.
