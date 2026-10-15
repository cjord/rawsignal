# Riftbound Auction House

## Collection sizes and settlement navigation — local follow-up, 2026-10-14

New free auctions draw 25–90 copies inclusively; paid auctions draw 50–130 (revised
by user request before release). A shared
size contract drives generation, artwork preparation, entry validation and lobby copy.
Free composition profiles retain their different rarity/repeat weights but no longer
dictate separate size bands. Paid rarity weights, $50 fee, personal-clue NPC valuation,
copy caps and the $2,000 collection-value cap are unchanged. Healthy catalog draws use
uniform seeded counts; limited stock/budget may reduce the target within the permitted
band, never below it. Existing saved auctions retain their frozen contents, including
legacy sizes outside the new bands. No additional pricing calls, D1 work or migration.

Both enabled entry tiles use an identical, stronger blue border/halo pulse visible
around their artwork; reduced motion keeps a static highlight. After the winner
announcement, both buyouts and final-round settlements scroll the Auction Settled tile
below the sticky header. Counting/reveal updates do not continually steal the scroll.

Results simplification recommendation awaiting a user choice: remove Gross Market
Spread first, since market value and fee-adjusted profit/loss already explain it.
No results metrics have been removed in this follow-up. This revision is local only;
the staging release below remains unchanged until a push/deploy is requested.

Validation: `npm run check` passed (435 node tests, one skipped, 47 Chromium
journeys; existing 21 lint warnings, no new warnings). Focused auction suite: 14/14.
Coverage includes all inclusive counts across 2,000 seeds per mode, real bundled
catalog budgets, out-of-range entry rejection, saved legacy sizes, failed-artwork
rerolls, matching entry pulses/reduced motion and buyout/final-round scroll position.
Dark/light desktop/mobile lobby/results screenshots reviewed. An initial full run
hit the preceding focused suite's leftover server lock; after that process exited,
the complete gate passed without editing generated tool state.

## Entry reliability, inventory controls and named NPC clues — 2026-10-14

Artwork eligibility no longer stops after four draws. Every failed URL is excluded, successful probes are reused, and a new seeded collection is built automatically until valid stock is found or eligible stock is genuinely exhausted. Work stays six-image concurrent, cancellation-aware and browser/CDN-backed; no upstream pricing calls or availability writes. Both modes now reserve the real cheapest remaining copy capacity. Free lots can use a smaller feasible healthy pool; paid lots retain the 128-copy minimum. A true service/stock outage stops safely with a temporary-unavailability message and no charge, rather than fabricating artwork or looping forever. Ordinary rejected cards never surface the old retry message.

Entry and initial catalog loading are text-only (Starting Auction / Loading Market), without skeleton tiles. Free/paid entry buttons now contain generated binder/premium-case illustrations; prompt set and asset paths: `docs/auction-entry-artwork.md`. Existing blue pulses, reduced motion, clear virtual price and fee rules remain. Inventory sale controls precede the card grid: Sell Commons, Uncommons, Rares, Epics, Alt Arts, Over-Numbered, Signatures, other owned groups and Sell All. Empty/unpriced tiers are disabled; confirmation, fee handling and retention of unpriced cards remain unchanged. Finish & Manage Inventory is right aligned; winning copy explains daily market changes and between-auction selling.

NPCs choose actual named monetary investigations from the existing clue catalog: three priced cards / bulk total initially, rare total from round two, top-five/appraisal from round three. Choices are seeded, retained across rounds and used in estimation. Price samples remain personal; a chosen aggregate is exact only for its own scope, and all outside value is estimated from personal samples. Appraisal uses only its disclosed rounded range. No full hidden value or another bidder's sealed bid is added as an input. NPC investigation costs remain unmodeled, consistent with the existing prototype economy. Only investigation names and icons are exposed in notes, not identities, prices or findings; unknown old private inspections are labeled Card Inspection (Legacy), never retroactively assigned a fabricated choice. The same redaction works for future non-player opponents. Optional IDs/inspected-slot fields preserve old saves; no database migration.

Pushed source `8a6826e` deployed to staging version `32799d2a-db45-443f-a2f2-734d610a1fe4`. Full gate: 434 node tests passed, one skipped, 47 Chromium journeys, no new lint warnings. Focused auction suite: all 14 passed before the full gate. Tests include six consecutive failed-draw repairs, total exhaustion/cancellation, paid minimum counts, no influence from unseen prices outside a selected aggregate, named/redacted legacy/future-opponent notes, explicit tier selling, generated assets, text-only startup and right-aligned finish. Live staging completed a 36-copy free auction (Opportunist/Follower/Gambler rivals) and a 145-copy paid auction; artwork, $50 charge/settlement, sales, saved inventory, reset, NPC loss-sharing, notes and dark/light desktop/mobile layouts passed with zero browser errors and zero additional gameplay pricing calls (11 initial feeds, 11 on reload). No retry was needed in this live check. Production remains `04c63e07`; no production deploy, security changes, ingestion or migration.

## Compact prior bids — initially local, now included in entry-polish staging release

Next Auction Round reuses the blue next-step pulse, with the existing static reduced-motion treatment. Visible Round Leader captions are removed from bid review/history; leader semantics remain in accessible labels and the green border/text. Each participant's prior rounds appear as individual compact Round 1/2/3 value tiles with no Previous Bids heading. Each prior round's winning tile has a green border and tint, using the same positive-bid/seeded-tie rule as the full matrix. No economy, saved data or API behavior changes. Published alongside the entry/inventory staging release above.

Initial local validation: full gate passed with 428 node tests, one skipped, 46 Chromium journeys and no new lint warnings. Desktop/mobile and dark/light prior-bid layouts, round leader selection, removed captions and reduced-motion pulse behavior are covered. The combined reveal test now pauses its virtual clock before entry so the 85 ms skeleton-to-count transition is asserted deterministically; an initial run missed that short window while the clock advanced in real time. No application timing changed. This was initially local, then pushed/deployed as part of `8a6826e` above.

## Paid entry and round controls — 2026-10-14

Free entry retains existing collection profiles. Paid entry costs $50 virtual cash and uses a 128–160-copy profile (25% bulk, 45% rare, 30% premium selection weights, eight-copy printing cap). These are game-generation weights, not pack odds. Both modes retain the $2,000 collection-value cap and verified-artwork requirements. Paid entry requires the complete minimum lot and sufficient cash, charges atomically only after preparation succeeds, starts the clock then, and never recharges on reload. Entry is non-refundable; player profit/loss includes it separately from investigation expenses. Missing required stock/artwork aborts without charge.

Paid NPCs retain the same personal sample/count-based valuation and $2,500 bid ceiling, with 8% higher valuation confidence and four percentage points higher participation. No access to hidden full collection values or the sealed player bid is added. Premium inventory is not guaranteed to make a profit. Existing saves without entry fields remain free; already-offered legacy investigation prices are accepted until a new round offers current prices.

Real-catalog validation exposed short lots when expensive early picks exhausted the affordable copy pool. Paid generation now reserves the exact cheapest remaining copy capacity, not an unlimited repetition of the single cheapest price, before allowing each pick. A 100-seed bundled-catalog regression enforces the full 128–160 count and $2,000 cap. Insufficient stock/budget aborts before charging instead of admitting a short lot.

Investigation prices by information strength (virtual USD): sets $3, duplicates $5, rarity counts $8, three identities $10, copies over $5 $12, highest identity without price $15, copies over $20 $20, three priced cards / bulk total / ten identities $25, top-three value share $30, rare total $35, top-five total $50, approximate appraisal $100. Retired exact-count clues keep their historical $5 value for old saves.

Both entry buttons are capitalized and pulse blue only when enabled, with a static reduced-motion equivalent. Entry preparation uses inline status text, not a skeleton tile. Round/time information is grouped in a bordered tile; Jump to Bid is removed. Previous-bid tiles have no visible heading and color the seeded positive round leader green (ties use the same rule as the full matrix); all-pass rounds have no winner. No new API calls, database work or schema migration.

Deployed pushed source `9da396a` to staging version `54eb3aa1-3a2a-40a0-a92b-817cfadf87b6`. Full gate passed: 428 node tests, one skipped, 46 Chromium journeys, no new lint warnings. The initial new UI test incorrectly assumed the maximum paid bid would always trigger an early buyout; the deterministic accounting test now fixes NPC bids, without weakening the actual auction threshold. Real bundled-catalog comparison across 100 seeds: free mean 62.63 copies / $10.97 per card / 6.8% premium, paid mean 143.19 copies / $13.66 per card / 18.3% premium. These describe the game generator and are not real collection statistics or pack odds.

Live staging verified a 73-copy free collection (Collector/Analyst/Opportunist rivals), a completed 136-copy paid collection, one-time $50 entry and settlement accounting, hidden current bids, prior-round controls, inventory persistence/sale/reset, loss-sharing and both-theme responsive layouts. Eleven initial catalog feeds plus eleven on reload; zero further gameplay pricing calls and zero browser errors. The first live draw failed artwork eligibility and safely returned to the lobby with unchanged $2,500 cash; a fresh collection passed. Four bounded artwork attempts remain intentional, with an explicit retry message and no charge on failure. Production remains `04c63e07`; no production deploy, migration, ingestion or security-rule change in this release.

## Rarity selling and NPC loss sharing — 2026-10-14

Between auctions, inventory offers Sell All buttons for each owned, currently priced rarity group: Commons, Uncommons, Rares, Epics, Alt Arts, Over-Numbered and Signatures where present. Each action confirms the exact copy count and proceeds after the configured fee. Other rarities and unpriced holdings remain owned; printing identities stay separate. No new data fetching or database work.

When an NPC wins with negative net value (frozen collection market value minus selling fees minus winning bid), that loss is divided among all three other bidders, including passes. Whole-cent remainders are assigned using seeded recipient order; the sum exactly equals the loss. Your share is added atomically at settlement, once only, and Your Auction Result includes the credit less your investigation spend. NPC shares appear in the result but NPC wallets are not persisted. Profitable/zero-loss NPC wins, player wins/losses and no-sale auctions pay no rebate. Existing already-settled saves are not retroactively credited. The reveal waits to display shares until the collection count completes, avoiding disclosure of the final loss early.

The lobby uses a readable summary and Free Entry / Up to 4 Rounds / 1 Minute per Round badges. Timer/reload and pre-entry advice moves into a keyboard/touch-accessible tooltip. The wallet uses green cash/blue inventory accents and the next-collection panel uses the site's blue accent, in both themes.

Released from pushed source `c983e21` to staging `28235f76-b87e-480f-a7f9-c66dfc99d335` and production `04c63e07-d924-4baa-902d-2c44257f3efd`. Full gate passed: 423 node tests, one skipped, 45 Chromium journeys. The old hover-color assertion was made deterministic against the fixed blue token after it sampled the Finish button mid-animation; the full rerun passed. Staging live verification passed a 58-card collection with Collector/Dealer/Analyst rivals, rarity sales, one-time NPC loss-sharing, inventory/sale/reset, fresh collections, both-theme desktop/mobile layouts and zero browser errors/additional gameplay pricing calls. The helper now waits for lobby hydration before checking facts. Production retains its custom domain, guard cron, bindings and existing variables/secrets (`--keep-vars`). Its new artwork/game bundle return 200 with the expected new features; page-level verification is blocked by Cloudflare HTTP 403 with `Cf-Mitigated: challenge`. No security rule change or production browser pass is claimed. No migration or database refresh.

## Settlement count and previous bids — 2026-10-14

After the winner announcement, Auction Settled immediately displays six skeleton values. As hidden cards flip, its market value, fees and profit/loss update from the same revealed-card calculation used by Collection Revealed. Fees round per printing/quantity, matching the final inventory sale calculation. Partial totals are explicitly labeled; Finish remains disabled until counting completes or Skip Reveal is used. Reduced-motion users receive the completed totals immediately. No extra API calls or database operations are added.

Investigation options are stacked vertically. In rounds 2–4, each bidder has a separate Previous Bids tile on the right showing all completed rounds. Current sealed bid amounts and NPC private details remain hidden; the full bid-history matrix retains investigation popovers.

Released to staging from `a4d835a`, version `1d84c0b6-a9ca-4364-ae24-dd46e131aa0e`. Full gate passed: 420 node tests, one skipped, 43 Chromium journeys. Dedicated tests cover initial skeletons, partial totals matching collection values, final totals/skip, vertical options and previous bids in rounds 2–4 at desktop/mobile in both themes. Live staging verified a 104-card auction with Analyst/Follower/Opportunist rivals, matching settlement totals, persistence, sale, reset, fresh next collection, zero browser errors and no additional gameplay pricing calls (11 initial cached feeds, 11 on reload). An initial verification attempt failed because the local helper referenced its text-reading method instead of calling it; correcting the helper and rerunning passed without application changes. No migration or production deployment.

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
  public count, selling fee and personality—not other bidders' prices, full lot value or
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
margin and estimation noise. Three distinct rivals are drawn
per auction; their confidence/participation mood and roster stay fixed for that
auction, while bounded private samples and bidding noise change by round.

The old fixed 48-copy lot ($432.82) produced 561 Collector, 278 Opportunist and
160 Dealer wins; 878 of 999 NPC wins were after-fee losses. Its three fixed rivals
used a raw sample mean without fees, which let an expensive sampled card inflate
an estimate. New valuation blends sample mean (60%) and median (40%), applies the
configured fee, and then the personality/mood/noise. The current model ignores
other bidders' prices, including previous-round bids. NPCs never receive full collection value
or the human's current sealed bid. Private samples grow from 4 to 7 copies over
four rounds, in addition to two public starting copies. NPCs keep $2,500 virtual
bid caps and do not accumulate inventory or persistent cash between auctions.

Earlier release simulation (before the private-information-only revision below;
different randomized lots, not a controlled same-lot A/B):

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

### Investigation layout and NPC privacy corrections — 2026-10-14

Staging application `842cfe7`, version `e100bb10`. Full gate passed with 419 unit
tests, one skipped, and 42 Chromium checks; no new lint warnings. Real staging
verification passed with an 80-copy auction and Analyst/Dealer/Collector roster:
equal panel heights, aligned controls, purchased clue replacing offers, no notes
under the collection, type-only NPC popup without prices, centered reset, saved
inventory/sale and another collection after reset. Desktop/mobile dark/light checks
passed with zero browser errors; eleven initial catalog calls, eleven on reload,
zero additional gameplay pricing calls. Production, database contents and cron
schedules were not changed.

Investigate and bidding stretch to equal desktop heights; bid input/buttons share
exact top/bottom alignment. Purchasing replaces offers with the current result
in the left panel. Previous clues remain in a disclosure there and your bid popups,
not at the bottom of the collection. Visible slots are ordered first without
changing frozen slot identities, prices or inspection targets. Inventory and
collection share one rarity resolver. Reset/sale/card dialogs are viewport-centered.
Unlocked bidders pulse blue (static under reduced motion); settled metric tiles
gain blue hover borders. Zero/unavailable metrics stay neutral; nonzero expenses
and actual losses keep their cost/loss colors. The fee title is Selling Fee.

NPC estimates use only personally accumulated private samples (four copies first,
one new copy per round up to seven), public starting cards/count, fee and margin.
They do not react to current OR prior rival bids. Price noise is bounded to
±4–16% by personality, with an auction confidence mood of ±6%; participation
still controls passes. Locked amounts and existing finished results are unchanged.
New NPC note snapshots contain only information types; legacy detailed hover notes
are sanitized without destroying saves. The full lot remains client-side for
casual single-player play; this is UI privacy, not a tamper-proof competition.
An updated 1,000-auction bundled-catalog, human-always-passes simulation produced
999 NPC winners and 400 unprofitable wins: Gambler 192 wins, Collector 187,
Analyst 170, Follower 168, Opportunist 109, Dealer 107, Bargain Hunter 66.
These are game-balancing observations, not real-world outcomes.

### Bid review and result presentation — 2026-10-14

Staging release: application `8d29a28`, Worker version `35f8b249`, same staging
game URL. Full gate passed: 415 unit tests, one skipped; 41 Chromium checks; no
new lint warnings. Live real-data verification passed on a 40-copy auction with
Follower/Opportunist/Bargain Hunter: header mute control, round-column matrix,
positive leaders, NPC note popup, full-width results, collection-before-history,
saved inventory, sale/reset and a different collection on re-entry. Desktop/mobile
and dark/light checks passed with zero browser errors, eleven initial catalog
requests, eleven on explicit reload and zero additional gameplay pricing requests.
Production, database contents and cron schedules were not changed.

Bid History is a four-round table: players are rows, rounds are columns, future
rounds have Pending/Not Played placeholders, and each positive round leader has
a green border (seeded tie priority is identical to settlement). Completed bid
tiles show clue icons and open notes on hover, keyboard focus or touch; Escape
and outside taps dismiss them. Floating popups use viewport-aware positioning
outside the horizontally scrollable matrix; bidder row labels remain visible
while scrolling. Only one popup is open at a time. Names have consistent,
theme-aware participant colors, backed by explicit names and portraits.

Each completed round records optional `RoundBid.notes` in the existing browser save:
the human's actual purchased clue results, and only the TYPES of NPC information
(public starting cards and private inspection). The initial review release exposed
private sample prices; this has been superseded by the privacy correction below.
Exact NPC cards, sample prices and estimates are never shown in hover notes, even
for older detailed saved rounds (their UI notes are sanitized). Older saves remain
valid; missing notes are explicitly unavailable, not reconstructed.
No extra save writes, database calls, API calls or image generation are required
for note popups: snapshots piggyback on the existing round-resolution save.

Mute is beside the title, round number and available balance are emphasized,
and locked participant tiles turn green. Round Bids and Auction Settled occupy
the full content width. Results use green/red gain/loss and cost accents, while
unavailable metrics stay neutral. The completed collection precedes Bid History.
A fresh win pauses on Winner Announced for 1.6 seconds before results/reveal;
player wins emit a short, center-origin confetti burst. Existing finished saves
open directly on results, without replaying confetti. Settlement remains atomic
and immediate in the engine; these effects never charge or award anything twice.
Finish & manage inventory pulses blue after reveal; reduced motion uses a static
blue accent and suppresses confetti. The removed explanatory text remains absent.

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

## Tile artwork assets and prompts

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
