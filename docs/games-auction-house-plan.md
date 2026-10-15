# Riftbound Auction House

## Compact ranked review and theme/profile tooltips — 2026-10-15

Collection Value Band is now $0–under $250, $250–under $1,000 or $1,000–$2,000
inclusive (legacy lots above the cap retain the $2,000+ fallback), at the unchanged
$30 virtual price and **round 4 only** for players and NPCs. The new `value-band4`
identifier preserves already purchased older band results and historical NPC clues.
Unpurchased old band offers are withdrawn on loading; the purchase handler also
rejects the retired clue and early new-band purchases without charging cash.
NPCs bound their existing estimate by the disclosed range’s lower bound and lower
quarter rather than jumping automatically to that quarter. This reduces information
without inducing high bids; no hidden prices are used and personality risk/margins
are unchanged.

Round Bids and final Bid History share condensed ~64px cells, smaller icons and a
maximum 1100px matrix width; the history title is 24px. Each completed bid has a
1st/2nd/3rd/4th placement; unplayed cells stay placeholders. Rankings and winners use
one shared seeded tie comparator. Passes receive a placement but never a winning
highlight when no positive bids exist. Matrices remain horizontally scrollable on
phones, with keyboard/touch private-clue-type tooltips retained.

The Round Bids header has title left, No Early Buyout centered, and the pulsing Next
Auction Round button top-right. Buyout explanation and tie/pass rules live in a
tooltip. Place Your Bid no longer prints strategy descriptions below bidder names;
NPC names have richer hover descriptions plus accessible profile info controls,
covering strategy, favored clue types and limited knowledge, not actual private finds.

Collection headings use their lot theme: e.g. Deck Builder's Collection / Deck
Builder's Collection Revealed. Other themes use their respective collection names;
unthemed legacy lots retain generic headings. The separate theme description box is
removed; its warning, description and paid-weighting disclosure live in the title
tooltip. Known/Total Value, card count, public/top markers and fixed card dimensions
remain unchanged. No extra pricing requests, database migration or scheduled work.
Release scope: GitHub and staging only; production requires separate authorization.

## Investigation rebalance — 2026-10-15

Approved by the user, including marking the top card’s location while revealing only
its rarity. New options remain one private purchase per round, with up-to counts and
no offers for exhausted scans. All prices below are virtual USD.

| Option | New effect / cost |
|---|---|
| Rarity Peek | Up to 8 random rarity markers, $4 |
| Rare / Epic / Alt-Art Markers | Up to 8 / 5 / 3 copies, $6 / $10 / $12 |
| Top Card Rarity | Mark the most valuable copy’s location and rarity, $8; no new identity or price |
| Common / Uncommon Count | Total category count, $2 / $3; no new identities or prices |
| Rare / Epic / Alt-Art Scan | Up to 8 / 5 / 3 priced identities, $15 / $20 / $30 |
| Rare / Epic Identity Peek | Up to 5 / 3 identities without prices; unchanged $12 / $18 |
| $5 / $20 Price Check | Unchanged count-only effect, increased to $15 / $25 |
| Rare Valuation | Unchanged exact category subtotal, reduced to $15 |
| Rarity Census | Increased to $12; suppresses subsequent Common/Uncommon Count offers |
| Collection Value Band | $30, rounds 3–4 only; replaces the centered 80–120% appraisal |

Fixed market-value brackets: $0–under $50, $50–under $100, $100–under $250,
$250–under $500, $500–under $1,000, $1,000–$2,000 inclusive. A legacy lot above
the current generation cap gets an open-ended $2,000+ band. Bands never disclose a
range centered on the exact value. NPCs use the lower quarter of a disclosed finite
band (or the lower bound for an open band), still applying the configured selling
fee and personality margin. New common/uncommon counts inform estimates using only
personally observed prices and category counts; no unseen prices enter valuation.
NPC strategies favor the equivalent current clues; participation/margins/risk stay
unchanged. Chase Scan remains one priced chase at $65 for this balance pass.

Changed-effect clues have distinct identifiers. Old offers, clues and already locked
bids retain their meaning/prices; retired definitions stay loadable but are excluded
from new offers. Historic $4 census / $6 and $10 price checks / $20 Rare Valuation
offers remain valid. Optional browser-save `topCardSlot` persists the private marker;
its range and rarity marker are validated. Unrevealed top cards stay face-down and
are not added to Known Value. Later identity/public/final reveals retain a small Top
badge without changing card dimensions. No extra API calls, database migration or
scheduled work. GitHub push / staging deployment authorized; production unchanged.

Release: application `172188e` pushed on `feature/set-rarity-heatmap`, deployed to
staging version `4d0c9c3e-f64a-4bc3-b22c-43d72b5b854d`. Full gate passed: 462 node
tests / one skipped, 54 Chromium tests, lint/type check, 21 existing warnings and none
new. Unit coverage includes exact costs/counts, hidden top-card identity/price,
legacy offered effects/prices, census redundancy, fixed-band boundaries and NPC
count/band-only knowledge. The bundled-catalog Collector-overpayment guard still
passes. Browser checks cover expanded scans/markers, whole-lot counts, top marker
reload persistence, icon colors, both themes and mobile; screenshots reviewed.

Live staging verified all fourteen revised clue price/effect paths (including safe
zero matches under a browser-only forced offer), no identity/price disclosure from
the top marker, zero browser errors and eleven initial feeds / zero additional data
requests. Normal flows also passed: 44 free / 72 paid copies, settlement, paid entry
charged once, inventory sales, persistence, NPC loss shares and reset, desktop/mobile
dark/light. Those flows used eleven feeds / eleven on reload, zero extra gameplay
requests. No database/cron/production changes; production remains `4e8f2913`.
This verification record is a subsequent documentation-only commit.

## Compact collection headings and embedded bid history — 2026-10-15

The pre-auction lobby/inventory returns to the centered standard Games page width;
an active auction (including reveal/results) still uses the whole window. Collection
headings have title left, centered Known Value / Total Value and copy count right,
including compact phone layouts. Final Total Value uses the same visible frozen-card
sum as the settlement metrics while counting, never leaking unseen prices early.
Skip Reveal stays centered immediately below that heading to avoid displacing value.

Round Bids embeds the complete four-round matrix with pending/unplayed placeholders,
winner coloring and private-clue-type tooltips, rather than repeating only the most
recent bids. Final Auction Settled embeds the same matrix. The separate Bid History
tile and its empty active-round matrix are removed; earlier bids remain visible next
to bidders during active rounds as before.

Investigation keeps cumulative public round/count summaries and purchased clue text,
not full card/price lists. Cards themselves retain their revealed information. An eye
in the bottom-right marks only slots publicly revealed before settlement (including
the legacy opening cards); private identities/prices never acquire an eye merely
because someone investigated them or because the final collection is revealed.
All collection cards share a fixed 300px height and consistent grid width, with the
eye absolutely positioned so it adds no size. Full names remain in accessible inspect
labels/dialogs, artwork keeps its natural ratio, and rarity-hover behavior is retained.

No auction economics, NPC strategy, save-format, data calls, database or cron changes.
Target: GitHub push and staging deployment only; production remains a separate decision.

Released application `0d8f83e` on `feature/set-rarity-heatmap` to staging version
`0bc4cd7b-1d0c-4448-b08d-6a73408e8a29`. Full gate passed: 455 node tests / one
skipped, 53 Chromium tests, lint/type check, 21 pre-existing warnings and none new.
Screenshots reviewed for desktop/390px/320px dark/light heading alignment. Browser
tests check centered lobby vs full-width active play, cumulative summaries, uniform
card sizes, public markers surviving settlement without marking private-only cards,
counting Total Value parity and the embedded matrix across rounds.

Live staging passed 33-card free / 96-card paid entry, compact summary/public markers,
fixed card sizes, settlement/Total Value, embedded history and private-clue-type
tooltips, persistence, inventory sales, NPC loss sharing and reset. Zero browser
errors; eleven initial feeds / eleven on reload and zero further gameplay requests.
Staging remains no-cron; no migrations or ingestion refresh. Production unchanged at
`4e8f2913`. This release record is a subsequent documentation-only commit.

## Investigation memory and opening reveals — 2026-10-15

The Investigation tile owns cumulative shared public information and purchased clues.
After purchase its heading remains Investigation Results. Public round panels stay
expanded and list each revealed card/printing/price; every private clue and private
revealed identity remains visible across rounds, with unknown prices kept unknown.
Public panels pop in and newly public cards flip in the collection; reduced motion
disables both effects. Known Value is larger and centered above the collection theme,
still counting distinct individually priced slots only (never aggregate clues).

New auctions start with `ceil(copies * 0.05) + 1` random public priced cards. A seeded
roll adds zero cards 60% of the time, one 20%, or two 20%; later rounds retain 1–3
new public slots, shared by player and NPCs without charge. Opening reveals are not
the old fixed slots 0 and 2; those slots remain the fallback for legacy saves without
public-reveal metadata. Existing auctions keep their saved opening reveal. Validation
accepts the bounded larger first reveal without relaxing later rounds or losing old
saves. NPC samples exclude actual public slots rather than assuming slots 0/2, and
the existing no-hidden-value-peeking tests remain in force.

No additional API calls, database reads/writes, migration, scheduled job or production
deployment is needed. Prices still freeze on entry. Deployment target: staging only;
production promotion remains a separate user decision.

Release: application `a67e785` pushed on `feature/set-rarity-heatmap`, then deployed
to staging version `c16d9d67-82ed-4e29-8c40-b10831b236a0`. Final full gate passed:
455 node tests (one skipped), 53 Chromium tests, lint/type check, with 21 existing
warnings and none new. Browser tests cover four-round cumulative findings, private
identity-only prices, larger opening reveals, flips/pop effects and reduced motion,
reload persistence and desktop/390px/320px dark/light layout; screenshots reviewed.
Live staging checks passed with 62 free / 55 paid copies, public information in
Investigation only, centered Known Value, paid entry charged once, settlement,
inventory sales, NPC loss sharing, reset and reload persistence. Zero browser errors,
eleven initial feed requests / eleven on reload, zero further gameplay data requests.
The live helper needed to scroll entry artwork into view before awaiting lazy images;
the scroll-aware retry passed. No database/cron changes. Production unchanged at
`4e8f2913`. This verification record is a subsequent docs-only commit.

## Settlement layout and collection hover — staged 2026-10-15

Finish & Manage Inventory sits top-right on the Auction Settled heading row, including
compact phone layouts. It remains disabled until reveal/counting completes, then
retains the blue next-step pulse. Removed the visible Collection Count Complete line;
the temporary counting-progress message and metric skeletons remain while needed.
The collection-value tooltip now follows the winner / winning-price sentence and
also remains available for the no-sale case.

Collection headings show the number and Cards label on one baseline, with compact
type on phones so centered Skip Reveal still fits. Collection-card hover borders and
rings follow revealed rarity, a deliberately narrow exception recorded in
`docs/design-baseline.md`. Unmarked hidden cards remain neutral; keyboard focus
remains blue. Inventory and other site hover styles are unchanged. Removed the
separator rules between bidder rows; the single divider between bid entry and the
bidder list stays, along with participant tile borders/lock feedback.

No pricing, NPC behavior, save, API or database changes. Focused browser checks passed
desktop/390px/320px dark/light header/count layouts, all rarity hover colors,
hidden-card privacy, tooltip placement, completion gating and bidder separators.
Full release gate passed: 454 node tests (one skipped), 52 Chromium journeys,
21 existing lint warnings and no new warnings. Screenshots reviewed. Application
`bf79148` pushed on `feature/set-rarity-heatmap`, then deployed to staging version
`370f09e9-bac0-47ed-9446-c14c4c31a1f5`. Live staging verified the header finish action,
winner-line tooltip, absent completed-count line, inline count and absent bidder
separators, plus 60-card free / 83-card paid flows, settlement, reload persistence,
inventory sales, shared NPC losses and reset. Zero browser errors and zero additional
gameplay data calls beyond eleven initial feeds / eleven on reload. Desktop/mobile
dark/light checks passed. No migrations or refresh jobs; staging remains no-cron.
Production is unchanged at `4e8f2913`. Release notes are a subsequent docs-only commit.

## NPC balance and three new rivals — production 2026-10-15

Production promotion: the same staging-tested application `cace4c2` (already on
GitHub; release-note HEAD `08f9a15`) deployed to `raw-signal` at `rawsignal.cards`,
version `4e8f2913-b1de-460b-b985-0f1cbbdcbe46`. Reused the green 454-node / 51-browser
gate and exact existing build; subsequent committed differences were docs only.
Production config verified the existing production D1, custom domain, workers.dev
disabled, production environment and unchanged minutely guard cron. No migrations,
ingestion refreshes, security changes or production database mutations were made.

Automated production gameplay checks receive HTTP 403 with Cloudflare's managed
challenge on both Games routes. JavaScript, stylesheet and all three new portraits
return 200 and match the staging-tested build byte-for-byte. Full game-flow checks
remain confirmed on staging, not production; do not describe asset parity as a
successful production gameplay test. Staging remains version `50b0ad31` with no cron.
This promotion record is a local documentation update; the deploy-only request did
not authorize a new GitHub push.

Removed the 1.15 opening bid multiplier and 1.08 paid-price multiplier. Paid NPCs
retain their small participation increase, not a higher automatic valuation. Most
profiles keep resale margins, with smaller routine noise and ±2% auction mood.
Explicit occasional stretch bids remain: Collector 2.5%, Opportunist 5%, Gambler
10%, Follower 2%, Playset Builder 1%; other profiles do not use this extra risk roll.
The Gambler remains the most aggressive. Fee-aware bids still cap at the virtual
$2,500 budget, not the actual hidden collection value. No perfect-value guardrail
or reaction to the player's sealed bid is introduced.

The new pure `auction-npc-valuation.ts` boundary accepts only a bidder's priced
observations, public/random samples, visible copy count and personally acquired
aggregate/census clues. Unseen stock uses a median-clipped sample mean with an
information-coverage discount. Targeted hits count individually. Bulk and rare
totals are disjoint; priced outside copies are counted once. Top-five estimates
use a conservative lower sample for the remainder instead of extrapolating chase
hits. Appraisal uses the lower quarter of the provided range, not its near-exact
midpoint. Census knowledge stratifies estimates by the revealed group counts;
duplicate density discounts the independence of a tiny sample. Early bids are
deliberately cautious and may miss hidden chase value; this is not a guarantee that
the resulting auction difficulty is final. NPC overpayment remains possible.

Ten profiles now form the roster pool; three are still randomly selected per auction:

- **Archivist / Collection Census:** expansion and rarity censuses before bulk
  valuation/appraisal. Uses the census counts, not knowledge of hidden prices.
- **Playset Builder / Repeat-Card Specialist:** duplicate checks, identity peeks,
  rarity census and rare valuation. Identity-only slots are saved separately from
  priced inspections and never reveal prices to the valuation function.
- **Skeptic / Cautious Cross-Check:** random scan, bulk/rare totals and appraisal;
  uncertainty reduces participation as well as the conservative resale margin.

Each new rival has an original 192px WebP portrait, distinct visible strategy and
theme-aware name color. Generation prompts, asset paths and tool provenance are in
`docs/auction-npc-artwork.md`. Existing art stays intact. Strength/rarity icon colors,
centered Skip Reveal, neutral entry captions, five lot themes and playset caps from
the preceding follow-ups are included in this staging release.

NPC information remains free and NPC budgets still reset per auction. Charging
NPC investigation costs or adding persistent bankrolls was not decided and is not
silently implemented. NPC-loss sharing is unchanged. Existing frozen saves load;
current saved bids remain frozen, while subsequent rounds use the revised model.
The optional validated NPC `identified` slot list is backward compatible. No database
migration, ingestion job or extra market API call is required.

Offline bundled-catalog audit: 500 seeds per mode, all four potential rounds,
excluding passes. Collector bids above net resale value fell from approximately
25% free / 41% paid in deployed-source generation to 0.6% / 0.2% in this version;
Gambler remains higher at 6% / 3%. First-round overpayment across all profiles is
about 1.2% free / 1.1% paid. Rosters and generated lots differ between versions;
these are model-simulation rates, not paired trials, live telemetry, winning-loss
rates or difficulty guarantees. Realized fees can differ by cents from the audit's
whole-lot rounded 10% comparison. Tests include a separate 200-seed-per-mode
Collector regression, information isolation, identity privacy, risk/uncertainty,
no opening/paid uplift, save compatibility and original asset checks.

Release validation: `npm run check` passed (454 node tests, one skipped, 51 Chromium
journeys; 21 existing lint warnings, no new warnings). New-rival portrait/strategy
screenshots were reviewed at desktop/mobile widths in both themes.

Application `cace4c2` pushed to `feature/set-rarity-heatmap`, then deployed to staging
version `50b0ad31-38fd-4386-aa11-f161b3ea6f8f`. Live checks passed an 87-card free
auction and 64-card paid auction, charged paid entry once, verified exact new
portrait asset hashes, visible themes/strategies, caption styling and centered
Skip Reveal, completed settlement, saved-game reloads, rarity/all inventory sales,
reset and NPC-loss sharing. Eleven initial catalog feed requests, eleven after
reload, zero additional gameplay data requests and zero browser errors. Desktop /
mobile dark/light layouts passed. The first smoke run timed out waiting on lazy
game-tile art; direct page inspection was 200/error-free, and a normal-URL,
scroll-aware lazy-image retry passed without a redeploy or application change.

No migrations, database writes outside normal page reads, ingestion refreshes,
cron or security changes. Staging keeps its existing D1 and no cron; production
was not deployed. Start a new auction to draw from the expanded roster; old saved
bids remain frozen. Deployment record is documentation-only after the application
release; no second deployment is needed for those notes.

## Investigation icon colors and heading spacing — included in 2026-10-15 staging

Rarity-targeted scans, markers and identity peeks now use the same icon palette as
collection rarity borders: common gray, uncommon green, rare blue, epic/alt art
purple and overnumbered/signature chase gold. Rare Valuation also uses rare blue.
General investigations use their existing strength tier: basic gray, targeted blue,
strong purple and premium gold. Random/census clues do not imply a particular hidden
card rarity; these colors describe the investigation level. Existing labels and
descriptions remain the non-color cues. The shared icon component keeps the same
colors in results and bid history without revealing private findings.

Investigate / Investigation Results headings have a 24px gap before their following
content. No clue pricing, gameplay, save, API or database changes. Included above.
Validation: `npm run check` passed (450 node tests, one skipped, 50 Chromium journeys;
21 existing lint warnings, no new warnings). Browser checks exercise every active
clue's color mapping and heading gap on desktop/mobile in dark/light themes; reviewed
screenshots. Icon rendering now uses a local glyph variable rather than reassigning
the component's input ID.

## Reveal heading and entry caption polish — included in 2026-10-15 staging

Skip Reveal now occupies the centered column of the same heading row as Collection
Revealed and the right-aligned card count. It disappears when counting completes;
the count stays right-aligned. Narrow screens use compact type and a wrapping title
without moving the button to a separate row. Both entry-button captions explicitly
have no independent border, corner radius, shadow or background; the accessible
outer button retains its normal blue hover/focus/pulse treatment. No gameplay,
prices, save format, API or database changes. Included in the staging release above.

Regression checks cover centered same-row positioning at desktop/390px/320px in both
themes, Skip Reveal completion behavior and borderless entry captions on hover.
`npm run check` passed: 450 node tests (one skipped), 49 Chromium journeys and
21 existing lint warnings, with no new warnings. Heading screenshots reviewed.

## Future multiplayer — public auctions only (2026-10-15)

Status: future plan, not implemented. The user approved the direction with one
explicit constraint: multiplayer supports **public auctions only**. No private
auctions, invite-only rooms, join codes or private-room creation. This supersedes
the earlier conversational suggestion to prototype invite-code rooms. Private
investigations and sealed bids remain private information inside a public auction;
public entry does not mean exposing hidden game state. Keep solo NPC play available.

### Proposed player experience

- A public auction lobby / Quick Join flow under Auction House. List waiting tables
  and seat availability; joining reserves a seat server-side. An internal table ID
  or public URL is routing, not an invitation or access code.
- Start with up to four seats and one complete auction using the existing themed
  lots, investigations, shared reveals, four-round timing and settlement interface.
  NPC fill is proposed, not decided; define minimum humans, waiting time and when
  unfilled seats become NPCs before implementation.
- Players see names/avatars, connection status and bid-lock status. Other players'
  bid amounts stay hidden until round resolution; personal clue findings never
  appear in another player's payload or bid tooltip.
- Reconnect to the same seat with a secure session credential. Disconnects do not
  pause the server deadline; a missing bid becomes a pass. Define reservation expiry,
  abandoned-table cleanup and disconnected-seat handling explicitly. Guests must
  not be able to take over another player's seat.
- Recommended first economy: equal starting funds and separate multiplayer balances,
  not imports from editable solo browser cash/inventory. Multi-auction sessions,
  selling between auctions, accounts and persistent multiplayer collections follow
  only after the initial public-auction flow is validated.

### Technical direction and safeguards

Recommended architecture: one Cloudflare Durable Object per public auction table,
with hibernating WebSockets for action/state updates. The server owns the lot and
generation seed, frozen price snapshot, private clues, NPC knowledge, balances,
deadlines and settlement. The browser receives only a player-specific safe view;
CSS-hidden copies of the full lot or all NPC bids are not acceptable. Reuse pure
domain utilities and presentation, but split current single-player state into room
state and per-player state rather than trusting localStorage saves.

Use persisted deadlines and alarms, check deadlines on every action, and make
settlement/retries idempotent. The browser animates the countdown locally; no
per-second broadcasts, database writes, polling or price refreshes. Load a shared
catalog snapshot for generation and freeze auction prices, rather than fetching
source data per player, bid or round. Persist accepted actions before acknowledging
them; reconnects receive a current versioned snapshot. Keep market D1 separate from
live room coordination; any later account/history storage needs an explicit design.

Public matchmaking adds abuse risks beyond the solo prototype: rate-limit table and
seat creation, authenticate seat actions, validate message size/schema/origin,
prevent duplicate submissions and bound room lifetime/storage. Public-lobby growth,
multiple guest seats, collusion and passive NPC-loss payouts need an economy/abuse
review before launch. Avoid free-form chat in the initial scope; decide nickname
validation and reporting/moderation before opening public entry.

Cost plan: use event-driven messages, hibernation and automatic expired-table cleanup.
Measure Worker requests, Durable Object compute/storage, connections and reconnects
in a load-tested prototype before committing to a monthly cost. No hosting resources,
bindings, migrations or schedules are authorized by documenting this plan.

### Implementation sequence and remaining decisions

1. Specify the public lobby, seat lifecycle, start rules and guest/account identity.
2. Extract a server-authoritative multi-player engine and privacy-safe views; test
   concurrent bids, late actions, duplicate charges, hidden information and recovery.
3. Build public discovery/join plus a single-auction flow with reconnect support.
4. Decide and add NPC fill, if wanted; test capacity, cleanup, abuse and actual costs.
5. Expand to rematches / multi-auction sessions and later account-backed progression.

Still undecided: guest sessions versus accounts, minimum human players/start timeout,
NPC-fill policy, cross-auction wallet/inventory persistence and NPC-loss sharing in
mixed tables. Private rooms/codes are excluded, not an open decision. Future deployment
requires separate authorization and staging/production resource isolation.

Architecture references: [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
[alarms](https://developers.cloudflare.com/durable-objects/api/alarms/),
[pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Initial personality strategies and themed lots — included in 2026-10-15 staging

The initial seven NPC profiles gained distinct named investigation strategies, displayed below
their names while bidding. Dealer: bulk-first reseller; Collector: premium specialist;
Opportunist: targeted scout; Analyst: aggregate valuation; Gambler: chase hunter;
Bargain Hunter: everyday value; Follower: sample checker. Preferences are seeded
weighted choices (12/7/4/2 for their ranked preferences, 0.3 for other options), not
fixed scripts. Round-tier eligibility, useful remaining scan stock and no repeated
private investigation still apply. Empty/scarce target pools fall back to available
clues, not omniscient findings. Rosters remain three randomly selected rivals.

NPCs can now choose priced rarity scans in addition to the previous random scan and
aggregate valuations. Their bid model counts actually inspected copies, estimates
the unseen remainder from public/random samples only, and uses purchased aggregate
information when available. A targeted rare/chase hit is not extrapolated across
every unseen copy. Findings stay private, no current sealed player bid is consulted,
and existing margins, participation, opening boost, cash cap and free NPC information
cost rule remain unchanged. Existing locked bids are not rerolled on reload.

Five visible themes replace the old hidden free profiles and generic paid profile:

| Theme | Gameplay bias |
| --- | --- |
| Bulk Seller | 85% common/uncommon tier, more repeat attempts |
| Deck Builder | 50% regular-rare tier, repeats and expansion focus |
| Trade Binder | Mixed stock, fewer repeat attempts |
| Set Collector | Strong expansion focus, low repeat rate |
| Chase Collector | Stronger premium-tier weighting, low repeat rate |

Themes apply to free and paid lots. Paid reduces each theme's bulk and regular-rare
draw weights by 20%, moving the balance to premium stock. This is not a claim about
actual decks, competitive demand, pack odds or a guarantee of specific cards/value.
Deck Builder is explicitly a player-style collection, not a verified playable deck.
Set focus prefers an eligible expansion with at least twelve unique printings; if
stock, seeded playset caps or the budget prevent a preferred draw, generation falls
back safely. Count bands, $2,000 cap, free chase suppression and rarity-scaled playset
limits stay in force. Themes never alter source prices or printing identities.

Only an optional validated theme ID is added to browser saves. New prepared lots
retain their generation seed/theme through artwork rerolls; old frozen saves without
a theme stay unlabelled, rather than inventing a theme from their seed. No database,
ingestion, API or additional feed calls. Included in staging above; the balance
release expands the roster to ten and revises the estimator/strategy weights.

Validation: `npm run check` passed (450 node tests, one skipped, 49 Chromium
journeys; 21 existing lint warnings, no new warnings). Dedicated tests cover seeded
personality preferences, scan-only price changes, hidden-price isolation, theme
mix/focus differences across 300 seeds per mode, budget/count limits, legacy saves,
artwork-retry theme consistency and responsive theme/strategy labels. Desktop/mobile
dark/light screenshots reviewed. Existing Singles/Sealed regressions passed.

## Playsets, partial clues and NPC-note cleanup — included in 2026-10-15 staging

Removed the paid-entry caption's independent gold background; it now inherits the
same button surface as free entry. Shared-public-reveal notes/icons are filtered
from NPC hover, round-review and history tiles, including legacy public-start notes.
Stored history and actual NPC knowledge are unchanged; player notes remain intact.
Empty filtered histories say No Private Clues, not that a bidder knew nothing.

New information-only investigations: Rarity Peek (three random rarity markers, $4),
Rare Markers (two regular rares, $6), Epic Markers (two regular epics, $10), Alt-Art
Marker (one, $12), Chase Marker (one overnumber/signature, $18). Cards remain face
down with only a rarity badge/border; no names, artwork, prices or Known Value change.
Rare / Epic / Chase Identity Peeks reveal up to two / two / one matching identities
without prices, costing $12 / $18 / $35. Priced scans remain separate. Partial clues
exclude already-known information, are useful-stock filtered, and use an optional
validated rarityKnown slot list. Markers sit after face-up cards, ahead of unknown
backs. Old saves still load; no schema migration or added data calls.

Collections now normally allow three copies per exact product/printing. A seeded
fourth-copy permission has rarity-scaled probabilities: common 12%, uncommon 8%,
rare 3%, epic 1%, alt art 0.3%, overnumbered 0.1%, signature 0.025%. Further copies
must pass successively five-times-rarer conditional gates, within the existing
profile maximum. Budget reservation and feasible lot sizes use these actual limits;
they never silently force extra duplicates to fill a lot. These are game-generation
rules, not pack odds. Exact printings are kept separate: combining alternate arts
into gameplay-card playsets needs a verified base-card mapping, not name-only merging.
Existing frozen auctions remain unchanged.

Real bundled-catalog check, 500 seeds per mode: free common groups >3 copies 110/4532,
uncommon 63/4471, rare 10/5983; paid common 99/4526, uncommon 13/3413, rare 34/12238.
No epic/alt/overnumber/signature group exceeded three in this sample. Maximum free
common stack was five; other observed exceptions were four. Included in staging above.

Validation: `npm run check` passed (445 node tests, one skipped, 48 Chromium
journeys; 21 existing lint warnings, no new warnings). New tests cover rarity-scaled
20,000-seed copy-limit monotonicity, real budget/copy constraints, source-order
independence, marker/identity privacy, useful-stock filtering, saved marker validation,
legacy/current shared-note filtering and neutral paid-entry caption. Browser marker
checks and desktop/mobile dark/light screenshots passed; other auction, Singles
and Sealed regressions remain green.

### Current design review — proposals, not implemented

1. **Economy guardrails first.** Free auctions cost nothing, all losing bidders share
   NPC losses even when passing, and NPC budgets reset every auction. This permits
   passive cash farming. Keep the mechanic but consider capped/funded payouts or
   persistent NPC budgets; requires user approval because it changes the agreed rules.
2. **Give the bankroll a purpose.** A five-auction challenge with a clear net-worth
   target, optional higher stakes and a session recap would provide an objective.
   Currently the $2,000 collection cap and fresh $2,500 NPC cap limit progression.
3. **Offer meaningful clue choices.** There are now 29 registered investigations
   (one retired), but only three random offers per round. A structured choice of
   cheap overview / targeted inspection / valuation would make plans more reliable.
   Useful-stock filtering also leaks rarity presence through the menu itself;
   a generic choose-a-rarity scan with transparent empty-result rules could reduce it.
4. **Personality clue preferences implemented locally** in the follow-up above.
   A post-auction decision recap remains deferred; private findings remain private.
5. **Visible themed collections implemented locally** in the follow-up above.
   Verified deck composition is still deferred: rarity and expansion patterns alone
   do not prove a competitive deck or synergy.

## Remove duplicated revealed-collection totals — released 2026-10-14

Collection Revealed no longer repeats Market Value or Net Profit / Loss; those
running/final metrics remain in Auction Settled. Its explanation toggletip moves
to that settlement section beside count progress. Skip Reveal remains a separate,
right-aligned control while counting. Active Mystery Collection still shows Known
Value and the individual-price/aggregate-clue explanation. Individual card prices,
counting, final value sorting and all shared-round/NPC/investigation changes below
are retained. No pricing, save-format, API or database changes.

Final validation: `npm run check` passed (441 node tests, one skipped, 47 Chromium
journeys; 21 existing lint warnings). Regressions cover no duplicate completed
collection totals, moved accessible tooltip, retained Skip Reveal and running totals
matching revealed card prices. Desktop/mobile, dark/light screenshots reviewed.
The initial run caught ambiguous metric lookups when the tooltip lived inside a
metric tile; it now sits outside the metric grid beside count progress, and the
complete gate was rebuilt/rerun successfully on that final layout.

Application commit `2a3f8da` pushed on `feature/set-rarity-heatmap`, then deployed
to staging `1be620f0-5fd7-4437-a6fc-96db623ac650` and production
`e587217f-bbc0-4343-8e48-37e1589e2058`. Live staging passed 53-card free / 122-card
paid auctions, settlement, inventory sales, persistence, reset, NPC loss sharing,
compact artwork and dark/light desktop/mobile layouts; zero browser errors and
zero extra gameplay pricing calls (11 initial feeds plus 11 on reload).
Production bundle and CSS return 200 with exact validated build hashes; gameplay
verification remains blocked by Cloudflare HTTP 403 (`Cf-Mitigated: challenge`).
No security changes, migrations, database mutations or ingestion jobs were performed;
staging remains cron-less and production retains its guarded minutely schedule.
Start a new auction for the new offer/balancing rules; saved offered prices and
already-generated current-round bids remain intact.

## Shared round clues, investigations and calmer NPCs — released 2026-10-14

Each round now includes a free public price reveal shared with every bidder: the
two shuffled starting cards in round one, then 1–3 newly public slots per round.
Reveals persist in an optional round/slot log, are shown in the collection pane,
and enter all NPCs' knowledge before bids are generated. They never spend the
player's one paid investigation. Private player scans are not passed to NPCs.
Old saves without the log remain readable; future rounds begin the public log.

NPC analysis found that a small sample containing one expensive chase was being
extrapolated over the entire lot, amplified by broad personality margins, noise,
the opening boost and paid modifier. New estimates blend 35% observed mean,
45% mean clipped at three times the observed lower median, and 20% lower median.
The shared sample contributes 25% of the general per-card anchor, personal known
cards 75%. Purchased aggregate clues remain exact for their own disclosed scope;
unseen remainder estimates are moderated, never replaced with actual hidden value.
Personal margins narrow from 0.58–1.08 to 0.80–0.98, random noise from 4–16% to
3–8%, and mood confidence from ±6% to ±3%. Participation and cash cap are unchanged;
the existing 15% opening/8% paid modifiers still apply. Different private clues
can legitimately produce different bids; opponents do not target the player's bid.

Calibration (1,000 matched seeds, same 50-card chase-heavy lot worth $1,438.57):
mean positive openings free $717.59 → $330.54; paid $756.74 → $354.46. Participation
counts were unchanged. A more aggressively clipped draft was rejected because it
treated genuine observed chase cards too much like bulk. These are game-balancing
measurements on one fixed collection, not expected returns or universal bid targets.

Investigation descriptions now state exactly what is revealed. Virtual costs:
Set Census $2, Duplicate Check $3, Rarity Census $4, $5 Price Check / Identity Peek
$6, Common Scan $8, Uncommon Scan / $20 Price Check $10, Random Price Scan /
Top Card Peek $12, Bulk Valuation $15, Binder Preview $16, Top-Three Share $18,
Rare Scan / Rare Valuation $20, Epic Scan $30, Top-Five Valuation $35, Alt-Art
Scan $45, Collection Appraisal $60, Chase Scan $65. New scans reveal up to three
commons/uncommons, two rares/regular epics, or one alt art/chase (overnumber/signature),
with prices. Empty/exhausted rarity scans are excluded from offers. Previous two
price schedules and already-offered labels/prices remain accepted in saved games.

Selling/investigation/entry costs display negative amounts (zero stays neutral).
After counting, NPC Loss Shared expands vertically rather than popping in, with a
static reduced-motion alternative. Only once every card is counted does the revealed
collection sort by market value descending (stable slot ties); counting order and
frozen indices are unchanged. Entry artwork is now a compact side thumbnail rather
than a large banner. No additional data calls, D1 work or migrations. Deployed with
the collection cleanup release recorded above.

Validation: final `npm run check` passed (441 node tests, one skipped, 47 Chromium
journeys; 21 existing lint warnings, no new warnings). Added shared-round continuity,
no-charge/persistence, rarity-only/exhausted scans, robust sample and legacy-price
regressions. Browser checks cover shared announcements each round, negative fees,
descending completed-card prices, smaller artwork and expanding/static-reduced-motion
loss sharing. Desktop/mobile and dark/light screenshots reviewed; existing Singles
and Sealed journeys passed. An earlier gate also passed before final calibration;
the final gate rebuilt and rechecked the exact final application state.

## Compact collections and consolidated settlement — 2026-10-14

Collection grids now use auto-filled columns with 120px target minimum (100px on
phones) and a 140px card-tile cap, rather than stretching six cards across the full
window. More cards fit as width increases; natural artwork proportions, names,
inspection dialogs, rarity borders, reveal order and internal scroll remain intact.
Bid controls and every bidder entry have subtle token-colored horizontal separators.

Removed Gross Market Spread from settlement. Both modes show six metrics: Collection
Market Value, Selling Fee, Winner Net Profit / Loss, Your Investigation Spend,
Auction Entry Fee and Your Auction Result. Free entry is explicitly $0 and neutral,
so it also has an even six-tile layout; paid entry remains $50. Counting skeletons,
fee rounding, running reveal totals and NPC loss sharing are unchanged.
The round header says Auction Finished after settlement (including buyouts and
no-sale results), retains Bids Revealed only between unfinished rounds, and keeps
the countdown while bidding. No auction economy, save-format, API or database changes.

Validation: `npm run check` passed (438 node tests, one skipped, 47 Chromium
journeys; 21 existing lint warnings, no new warnings). Browser assertions cover
140px maximum cards, at least nine desktop / two mobile columns, bid separators,
six metrics in free/paid settlements and the finished status. Dark/light screenshots
reviewed at 1440px and 390px; Singles and Sealed regression journeys also passed.

Pushed application commit `ddac677` on `feature/set-rarity-heatmap`; staging
`85126f47-a469-4971-a111-ba231d447a91`, then production
`9fd0dd82-366b-4e98-af1e-3cb492bb2488` deployed. Live staging passed compact
card caps, bid divider, finished label, six settlement metrics, 54-card free /
67-card paid auctions, sales, persistence, reset and NPC loss sharing. Dark/light
desktop/mobile layouts passed; zero browser errors and zero extra gameplay pricing
calls (11 initial feeds plus 11 on reload). Production page testing still receives
Cloudflare 403 (`Cf-Mitigated: challenge`). Its new bundle/CSS initially returned
404 during propagation, then returned 200 at their normal URLs with exact validated
build hashes; no redeploy or cache/security mutation was needed. No migrations,
database writes or ingestion jobs; existing environment schedules are unchanged.

## Free chase balance, opening bids and full-width layout — released 2026-10-14

Free draws retain 80% of initially selected overnumbered copies and 50% of signatures.
Rejected copies reroll into eligible non-chase stock (same candidate group first,
otherwise other affordable stock), not into another scarce treatment. If only chase
stock remains, retain the draw rather than inventing cards or admitting a short lot.
Copy caps, real-stock budget reservation, 25–90 / 50–130 sizes and artwork checks remain.
Paid generation is unchanged. These are game-balancing rules, not real pull rates.

NPCs apply a 1.15 opening-round multiplier to their own personal-clue valuation in
both auction types, on top of the existing paid modifier. Rounds 2–4, random
participation/personalities, the $2,500 cap and the actual buyout thresholds are
unchanged. No hidden-value access or reaction to the player's sealed bid is added.
This makes first-round buyouts more expensive, not impossible. Existing active
auctions retain frozen cards and already-generated bids; new rounds use current rules.

Before/after real bundled catalog comparison (1,000 matching seeds per mode): free
overnumbered copies 1,210 → 922 (~24% fewer), signatures 406 → 203 (50% fewer), total
57,603 copies unchanged. Paid 90,131 copies / 3,871 overnumbered / 994 signatures
unchanged. With the same fixed 50-card lot and matched seeds, mean positive opening
bids rose from $644.15 to $717.59 free and $680.60 to $756.74 paid; saturation at the
cash cap makes the observed average increase smaller than 15%. Participation counts
were unchanged. These figures describe the game generator, not real market odds.

Auction House alone opts into the full browser width with existing 24px desktop /
16px mobile gutters; Games and Price Showdown retain their current maximum width.
No extra API requests, database work or save-format change.

Validation: `npm run check` passed with 438 node tests, one skipped, 47 Chromium
journeys and no new lint warnings (21 existing). Added distribution/stock-exhaustion
regressions, exact seeded clue-based round-one boost and unchanged later-round bid
checks for both modes, and full-width/gutter assertions in desktop/mobile journeys.
Auction screenshots reviewed in dark/light at 1440px and 390px; existing Singles
and Sealed browser journeys also passed.

Application commit `1a18fbc` pushed on `feature/set-rarity-heatmap` and deployed
to staging `3e587bd2-9772-443d-a2f7-a2be4956b4fe`, then production
`903c395c-6c51-44a2-9693-742b994041d1`. Live staging verified full browser width,
53-card free / 64-card paid auctions, settlement, paid fee, random collections,
inventory sales, persistence, reset, NPC loss sharing and dark/light desktop/mobile
layouts. Zero browser errors and no additional gameplay pricing calls (11 initial
feeds plus 11 on reload). Production deployment succeeded; its game bundle and CSS
return 200 and match the validated build hashes. Live production gameplay remains
blocked by Cloudflare HTTP 403 (`Cf-Mitigated: challenge`). No security-rule changes,
migrations, ingestion jobs or database mutations were performed. Existing staging
no-cron and production guarded minutely-cron policies are unchanged.

## Collection sizes and settlement navigation — released 2026-10-14

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

Results simplification was initially deferred at this release. Gross Market Spread
is removed in the compact-settlement follow-up above, after user approval.

Validation: `npm run check` passed (435 node tests, one skipped, 47 Chromium
journeys; existing 21 lint warnings, no new warnings). Focused auction suite: 14/14.
Coverage includes all inclusive counts across 2,000 seeds per mode, real bundled
catalog budgets, out-of-range entry rejection, saved legacy sizes, failed-artwork
rerolls, matching entry pulses/reduced motion and buyout/final-round scroll position.
Dark/light desktop/mobile lobby/results screenshots reviewed. An initial full run
hit the preceding focused suite's leftover server lock; after that process exited,
the complete gate passed without editing generated tool state.

Pushed application commit `00a4ff1` on `feature/set-rarity-heatmap`, then deployed
staging version `a855b6be-6704-472b-8b49-f2447fe0d2e5` and production version
`0a179746-da2f-485f-b532-75b49511aaa0`. Live staging passed with 47-card free and
105-card paid lots, settlement, inventory sales, persistence, reset, NPC loss sharing,
and dark/light desktop/mobile layouts. Eleven initial catalog feeds plus eleven
on reload, zero additional gameplay pricing requests and zero browser errors.
Production deployment succeeded; the game bundle and CSS return 200 and match the
validated build hashes, and both entry images return 200. Production page/gameplay
verification remains blocked by Cloudflare HTTP 403 (`Cf-Mitigated: challenge`).
No security changes, migrations, ingestion jobs or database writes were performed;
staging remains cron-less and production retains its guarded minutely schedule.

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
