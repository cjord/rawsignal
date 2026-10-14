# Riftbound Auction House

Source: user-supplied Game Design Plan v1.0 and confirmed decisions, 2026-10-14.
Route `/games/riftbound-auction`, tile alongside Showdown on `/games`.

## Scope and rules

- One free-entry random collection at a time; replay supported between auctions.
  Casual Binder (36–60 target copies), Player Collection (48–84), Collector Binder
  (24–48) and Bulk Box (80–120) vary rarity weights, duplicate frequency and per-printing
  copy limits (4/4/3/8). These are game composition weights, not measured pull rates.
  Lots use current priced Riftbound records and verified artwork, exclude missing/
  nonpositive prices, and freeze before round 1. Game balancing caps new lot gross
  market value at $2,000 against $2,500 starting cash; scarce catalogs/budget can
  yield fewer copies. Exact count is public through every card slot; count clues
  are no longer sold. The old fixed fixture remains only as a test utility.
- $2,500 virtual starting cash. Three distinct NPCs selected from seven personalities,
  independent sealed bids, 60-second deadlines, and 100/60/30% early-buyout thresholds. At least two
  positive bids are required for early buyout. Round 4 uses the highest positive bid;
  ties use seeded rotating bidder priority, all passes mean no sale.
- Locking is final and blocks investigations. Unsubmitted bids expire to $0;
  passing does not eliminate a bidder from later rounds. All locks resolve the
  round immediately, with remaining NPC timings accelerated to 0.5–3 seconds.
  Round bid reveals have a manual Continue so players can review before the next
  deadline starts. Reload/background time does not pause an active deadline.
- NPC bid amounts are fixed before the player's lock. Their valuation function
  receives only publicly visible starting cards, a bounded private sample, the
  public count, selling fee, personality and already-revealed prior bids—not full lot value or
  the current sealed player bid. Each auction gives NPCs fresh $2,500
  bid budgets; private inspection has no modeled charge in this first phase.
- Fourteen offered fixed-price investigations (plus legacy count clues) in Basic/Targeted/Strong/Premium tiers,
  with the design's tier progression, one optional purchase per round, no repurchase
  and no refunds. Prices do not depend on hidden lot value. Identity-only clues
  retain “Price Unknown.” Known value sums individually priced slots once;
  aggregate clues are kept separate to avoid overlapping subtotals.
- Settlement sequentially reveals all copies with rarity borders and running value,
  reports gross spread,
  modeled fee, winner net profit/loss and the player's expenses/result. Only the
  winner's bid is charged; information costs remain spent on losses. Settlement is
  a single idempotent state transition, including across reloads.

## NPC analysis and random generation — 2026-10-14

`node scripts/games/auction-balance.mjs 1000` performs a local, reproducible check
using the bundled priced Riftbound catalog, with the human always passing and no
image probes or network calls. It is game balancing evidence, not a prediction of
real player outcomes or market returns. Seven profiles vary participation, bidding
margin, estimation noise and prior-bid influence. Three distinct rivals are drawn
per auction; their confidence/participation mood and roster stay fixed for that
auction, while bounded private samples and bidding noise change by round.

The old fixed 48-copy lot ($432.82) produced 561 Collector, 278 Opportunist and
160 Dealer wins; 878 of 999 NPC wins were after-fee losses. Its three fixed rivals
used a raw sample mean without fees, which let an expensive sampled card inflate
an estimate. New valuation blends sample mean (60%) and median (40%), applies the
configured fee, and then the personality/mood/noise. Prior bids are revealed-only;
the Follower weights them more heavily. NPCs never receive full collection value
or the human's current sealed bid. Private samples grow from 4 to 7 copies over
four rounds, in addition to two public starting copies. NPCs keep $2,500 virtual
bid caps and do not accumulate inventory or persistent cash between auctions.

New simulation (different randomized lots, not a controlled same-lot A/B):

| Personality | Appeared | Wins | Unprofitable wins | Average winner net |
|---|---:|---:|---:|---:|
| Dealer | 451 | 118 | 46 | $66.06 |
| Collector | 426 | 193 | 87 | $103.74 |
| Opportunist | 417 | 124 | 52 | $51.98 |
| Analyst | 399 | 168 | 81 | $27.57 |
| Gambler | 442 | 188 | 99 | $37.89 |
| Bargain Hunter | 426 | 64 | 28 | $95.22 |
| Follower | 439 | 144 | 58 | $161.41 |

One no-sale auction; 451 of 999 NPC wins were losses. Collector and Gambler are
the most frequent overall winners, with Gambler's larger risk producing the most
losing wins. This preserves imperfect opponents rather than making them omniscient.
The four collection profiles occurred 238/260/270/232 times (Casual/Player/Collector/Bulk).
Collection value ranged $13–$2,000, median $398.43, 90th percentile $1,822.81.
This capped, game-specific composition is not a real-world collection appraisal
distribution and never changes the source price of a selected card.

Fresh browser entropy seeds each new collection/roster. Seed mixing avoids adjacent
seed correlation; stable identity ordering makes tests reproducible. Slots shuffle,
duplicates vary and have profile copy limits; rarities with no usable records
fall back to other eligible cards. Candidate images must pass before the timer
starts. Saved contents, prices, bids and wallet remain frozen/resumable; old saves
are retained without rerolling a collection or charging again. New personalities
reuse the existing optimized illustrated portrait family with name/role tooltips.

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
Investigate and bidding share columns on desktop, stack on phones; the collection
spans the full content width below them. Entry/next-round
scroll to the arena and a jump-to-bid link assists phones. Artwork is uncropped and
lazy; failures use the existing fallback without changing a frozen lot.

Existing eleven Riftbound section feeds load once per page entry (and once again
only on explicit Refresh market). No per-round/inspection/investigation/sale API
requests, upstream pricing calls, database writes, schema changes or cron changes.
Image-CDN requests remain separate: candidate artwork checks run six at a time,
with four bounded draws (at most 120 candidate images per draw, successful checks
cached for the page). No full-catalog image scan. Auction seed is browser-generated
before preparation and saved only after images pass; failed preparation starts no
deadline or charge. Slots and images use normal browser/CDN caching afterwards.

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

Paid-entry lots, condition-based clues, individual
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

## Random collections and polish staging release — 2026-10-14

Application commit `f234786`, Worker version `3e534e78`, same staging route as above.
Full gate passed: 413 unit tests, one skipped, 39 Chromium browser checks; 21
pre-existing lint complexity warnings and no new warnings. Live fresh-browser
verification passed for a 109-copy collection, Dealer/Bargain Hunter/Analyst roster,
clue icons, full-width slots, settlement/full reveal, saved wallet after reload,
after-fee inventory sale, reset, a different seeded collection on re-entry, and
desktop/mobile dark/light layouts. No browser errors. Eleven initial catalog
requests, eleven on reload, and zero further gameplay pricing requests.

Verification notes: one test helper initially checked virtual-time settlement
before the pre-existing native timer caught up; a short synchronization wait fixed
that helper. A subsequent run timed out awaiting artwork preparation; the next
fresh browser completed the full real-data journey in about seven seconds. The
timeout cause was not established, so image/CDN availability remains a review
limitation, not a claim that every source card will always load. No application
changes were made to hide failures: new lots retain bounded candidate probes and
explicit failure feedback, while saved lots remain frozen.

No migrations, database mutations, source refreshes, upstream pricing calls,
cron changes or production deployment. Staging remains deliberately stale.

## Tile artwork assets and prompts (continued)

### Auction polish (included in staging version `3e534e78`)

Every copy now has a visible slot using the supplied blue/gold back and a question
mark. Exact count is public; new offers exclude the paid count clue and NPCs use
the same count. Existing saves and count clues remain valid. Every new round is
60 seconds; previously saved deadlines remain unchanged. New auctions check only
candidate artwork (six concurrent probes, four bounded draws), excluding broken
or placeholder images before any timer starts. Existing frozen lots are not rerolled.
No new pricing API or database calls are added. Images use browser/CDN caching.

Collection spans the content width below Investigate and bidding. Hidden slots
never expose rarity borders. Enter locks a bid; all completed round bids show
player/NPC portraits. The wallet is hidden until Finish returns to the lobby.
Settlement is atomic; sequential flips and running values are presentation only.
Skip Reveal and reduced motion show the final result immediately. Sound uses
quiet synthesized Web Audio after user interaction, with a persisted mute choice
(`raw-signal-auction-sound`); no sound asset requests or background sound backlog.

Imagegen skill, built-in mode: edited tile saved as
`public/images/games/riftbound-auction-house-v2.webp`; four generated portraits as
`public/images/games/auction-{player,dealer,collector,opportunist}.webp`.
Original generated PNGs and prior tile are retained. The supplied reference was
format-converted only into `public/images/games/riftbound-card-back.webp`.

Tile prompt: replace the binder/stack printed backs with the supplied teal-blue
and gold League of Legends reference, preserving scene, gavel, binder, composition,
3:2 canvas, blue/violet lighting and reflections; no extra objects or text.
Portrait prompts: centered head-and-shoulders illustrated portraits, navy background,
blue/violet rim lighting, natural skin tones, generous circular-crop margins,
no text/props/logos: friendly young player in blue hoodie; older dealer with glasses
and gray beard; curly-haired collector in violet jacket; bargain hunter in green jacket.

Exact tile editing prompt:

> Use case: compositing. Image 1 is the existing Auction House tile edit target; Image 2 is the exact card-back reference. Replace the printed card backs in the open binder and top card on the stack with the dark teal-blue and gold League of Legends back from image 2, including the gold ornamental border, diamond, circles, symbols and LEAGUE OF LEGENDS lettering. Keep the reference proportions and apply only the perspective needed for each card in the existing binder/stack. Preserve everything else: gavel, binder, card stack, dark auction-room scene, composition, 3:2 canvas, blue/violet lighting and reflections. No additional objects or extra text. Printed flat artwork, not invented embossed designs.

Exact portrait template (one generation per subject):

> Use case: stylized-concept. Asset type: small square NPC/player profile portrait for Riftbound Auction House. Subject: [subject]. Head and shoulders centered, face clearly readable at 40 pixels. Cohesive polished illustrated game portrait, understated realistic proportions, dark navy plain background, soft blue/violet rim light, warm natural skin tones. Generous safe margin for a circular avatar crop. No cards, no props, no text, no lettering, no logos, no watermark. Square canvas.

Subjects: `a friendly young gender-neutral trading-card player in a simple blue hoodie`;
`a thoughtful older male card dealer with glasses, short gray beard and a charcoal jacket`;
`a confident female collector with dark curly hair and a refined violet jacket`;
`a sharp-eyed young male bargain hunter with short dark hair and a green casual jacket`.

Imagegen skill, built-in generation mode. Saved workspace asset:
`public/images/games/riftbound-auction-house.webp` (1536×1024). Source PNG retained
in the generated-images library; WebP conversion only compresses the format.
Final generation prompt:

> Use case: stylized-concept. Asset type: landscape 3:2 website Games tile for Riftbound Auction House, matching a dark blue/purple trading-card market site. Scene: a premium dark auction table with a partly open card collector binder containing face-down dark teal-blue and black trading cards with restrained gold geometric ornament, a small stack of cards, and one elegant auctioneer gavel on its sound block. Style: polished cinematic matte 3D illustration, crisp silhouettes and restrained atmosphere. Balanced compact composition, all focal objects fully visible with generous margins, legible as a small thumbnail. Electric blue and violet rim lighting on charcoal/navy surfaces, subtle warm gold details. Mystery card-collection auction, not a casino. No coins, no cash, no chips, no characters, no text, no prices, no readable logos, no watermark. Title will be HTML outside the artwork.
