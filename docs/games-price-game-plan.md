# Games: Riftbound Price Showdown

Requested 2026-10-14. First implementation: Riftbound singles only.

- `/games` joins the shared desktop/mobile navigation, with existing-style game tiles.
- `/games/riftbound-price`: Normal compares two cards; Hard compares three. Desktop uses columns; mobile stacks cards. Names and uncropped artwork are the only pre-answer clues.
- Choose the highest TCGplayer market price, rounded to USD cents. Reveal all prices, highlight the winner green and an incorrect selection red, then advance after one second. Auto advance can be turned off; manual Next is available. Background tabs do not advance until visible again.
- Track total correct, streak, answered count and accuracy for the current session. Restart or changing difficulty resets the score. No account, leaderboard, persistent score or database writes.
- Reuse detail-art pointer tilt, keyboard-accessible buttons, reduced-motion support, textual outcome feedback and reserved reveal space. Restore keyboard focus for the next round.
- Load the existing eleven Riftbound section feeds once on entering the game. Existing Worker/browser caches apply. No per-round catalog requests, ingestion changes, upstream pricing API calls, history requests or migrations. Cold sessions can cause eleven existing feed requests/read paths; rounds add zero catalog/API calls (artwork can load from its external CDN). Prices remain frozen until reload.
- Exclude unavailable/non-positive market prices and ambiguous same-name/art printings with different prices. Within a round, avoid identical names/art, price ties at displayed cents and repeats from the immediately preceding round when the pool permits. Keep product identities unchanged.
- Rarity preference (user refinement, 2026-10-14): 70% same-tier, 25% adjacent-tier mixed, 5% unrestricted. Try eligible preferred cohorts first; fall back to unrestricted when a chosen style cannot form a fair round. These are style-selection weights, not guaranteed final percentages after fallbacks. Tiers use curated sections for Alt art, Showcase, Over-numbered and Signature rather than treating every source `Showcase` label as the same rarity. Common → Uncommon → Rare → Epic → Alt art → Showcase → Over-numbered → Signature defines adjacency; promo/metal treatments are not assigned speculative neighboring tiers.
- Verify only the drawn two/three images in the browser before enabling answers. Empty image URLs, HTTP failures, timeouts, zero-size images and the established TCGplayer placeholder dimensions are excluded for this page session. Checks and failed-image exclusions are reused across rounds/difficulty changes. A replacement does not increment round, score or streak. Preparation is bounded to eight candidate rounds; show an actionable retry if none succeed. No availability writes, upstream pricing calls or daily-ingestion changes. Image CDN traffic still exists; advancing can wait for artwork after the one-second reveal.
- Difficulty uses the shared SlidingTabs slider; auto-advance uses CheckboxGrid's standard checkbox styling. Score/streak/round use existing metric-tile surfaces, micro-labels and mono values. Intro: “How well do you know the market? Pick the most valuable card to build your streak.” The redundant pre-answer price question is removed; loading and answer feedback remain accessible.

Final name chosen by the user: **Riftbound Price Showdown** (2026-10-14). The route remains `/games/riftbound-price`.

## Later phases / decisions

Round history (2026-10-14): a collapsed native-details tile below the game records
each accepted answer immediately, newest first, with small uncropped card art,
frozen market prices and the actual selected card outlined/tinted green or red.
Wrong answers also identify the highest-price card in text. Repeated clicks and
failed artwork retries do not add entries. The expanded list is keyboard-scrollable
and height-bounded so long sessions do not grow the page indefinitely. History
is session-only and clears on Restart or difficulty change; no browser storage,
API requests, ingestion changes or database reads/writes are added.

History release validation: `npm run check` passed (397 unit tests passed, one
skipped; 32 Chromium tests; no new lint warnings). Tests cover frozen prices,
invalid/duplicate picks, newest-first order, Normal/Hard rows, keyboard disclosure,
restart/difficulty resets, both themes, desktop/mobile and zero extra pricing calls.

- Pokémon: reuse the pure sampler/scoring and game presentation, with its own feed pool and tile. Decide English-only scope and printing visibility before enabling.
- Mixed sealed/cards: opt-in mode only, never silently mixed. Decide product-type restrictions and comparable price bands first; boxes versus cheap singles are often trivial comparisons.
- Optional close-price rounds, best streak by difficulty, additional session controls and a compact single-request pool endpoint if traffic justifies it. No new source spending needed.

## Validation

Unit tests cover eligibility, ambiguous printings, ties, distinct rounds, repeat avoidance and double-answer protection. Browser tests cover concealment, scoring, reveal/advance, difficulty reset, keyboard input, responsive layout and request counts. Full release gate required before deployment. Implementation is local; deployment needs a separate user request.

Validated 2026-10-14: `npm run check` passes (393 unit tests passed, one skipped; 29 Chromium tests passed). No new lint warnings. Dark/light game layouts checked at 1440, 561 and 390px; the shared navigation switches to its compact row below 700px to fit the sixth tab. Existing local D1 schema/cache warnings on older detail-page fixtures remain outside this feature. Test-only fresh page keys and external-script isolation keep browser fixtures deterministic; production cache and affiliate behavior are unchanged.

Staging release 2026-10-14: application commit `7ce4e7f`, Worker version `fac134e0`.
Deployed to `https://raw-signal-staging.raw-signal-watch.workers.dev/games/riftbound-price`;
live checks passed for the chosen name/page title, concealed prices, reveal/scoring,
Normal/Hard, desktop/mobile and both themes. Eleven initial catalog requests and zero
additional pricing calls across rounds/difficulty changes; no browser errors.
No migration, data refresh, cron change or production deployment was performed.

Refinement validation 2026-10-14: complete release gate passed (396 unit tests,
one skipped; 31 Chromium tests; no new lint warnings). New tests force HTTP failures
and TCGplayer placeholder artwork, verify image exclusion without score changes,
exercise preference cutoffs/fallbacks, and check shared controls and tile artwork.
A 1,000-round Hard-mode check on the bundled 1,271-card eligible pool produced no
empty rounds and completed in about 0.2 seconds.

Refinement staging release: application commit `743a2fa`, Worker version `59e4891d`.
Live checks passed for real card artwork, scoring, Normal/Hard, shared controls,
generated tile artwork, desktop/mobile and both themes. The game still makes eleven
initial catalog requests and zero further pricing requests while playing/changing
difficulty. No browser errors, migrations, data refreshes or cron changes.
Production remains unchanged and is not authorized for this release.

## Control and artwork polish (2026-10-14)

Difficulty, Auto next round and Restart game share the 56px control height and
site typography. On desktop they share one row in that order; on phones the
difficulty slider sits above the Auto/Restart pair to avoid cramped controls.
Restart uses the standard blue hover border. Score/streak/round numerals are
reduced from 24px to 20px. Auto-next preference stays unchanged when restarting
or changing difficulty. No extra data requests or writes. Released to staging with
round history; production unchanged.

Polish validation: `npm run check` passed (396 unit tests passed, one skipped;
31 Chromium tests; no new lint warnings). Browser assertions cover equal control
heights/order, Restart typography/hover border, smaller values and preserved
auto-next preference. Screenshots reviewed in dark/light at desktop/mobile sizes;
the existing local D1/cache fixture warnings are unchanged.

History and polish staging release: application commit `dde27bf`, Worker version
`9833f54c` (2026-10-14). Live verification passed for real artwork, revealed prices,
selected-pick highlighting, Normal/Hard history rows, history reset and both themes
at desktop/mobile widths. Eleven initial catalog requests, zero further pricing
requests; no browser errors. The first artwork check timed out immediately after
deployment; direct responses and a subsequent complete browser journey passed.
No migrations, data refreshes, database writes or cron changes were performed.

## Tile artwork

Built-in image-generation skill/tool, 2026-10-14; user selected **clean abstract cards with a market-chart motif**. Saved to `public/images/games/riftbound-price-showdown.webp` (1536×1024, about 154 KiB). The generated PNG remains unchanged in the generated-images library; only format compression was used for the WebP. Title/description remain HTML, not image text. No generated card imagery is used for playable rounds.

Original generation prompt:

> Use case: stylized-concept. Asset type: landscape website game-tile banner illustration for Raw Signal's Riftbound Price Showdown. Primary request: clean abstract trading cards with a market-chart motif. Composition: wide 3:2 landscape, two elegant floating portrait trading-card silhouettes facing one another in a balanced showdown composition, a restrained thin market-price line weaving behind them. Keep complete card silhouettes inside generous margins so this works at small tile sizes. Style: refined premium matte illustration with crisp beveled edges, subtle depth, not photorealistic and not a UI screenshot. Color palette: deep charcoal/navy background, restrained electric blue #2e6cff and purple #7557ff illumination, cool silver card edges. Card faces show only abstract geometric rune-like patterns; NO real card artwork, no characters, no readable lettering, no numbers, no currency symbols, no prices, no arrows suggesting guaranteed profit. Minimal atmospheric detail, strong clean focal shapes. No logos, no watermark, no text. The title will be rendered separately in HTML beneath the artwork.

Reference edit via the built-in image-generation skill/tool: the user's supplied
League of Legends back replaces both abstract backs, one blue and one black.
Current asset: `public/images/games/riftbound-price-showdown-v2.webp`, 1536×1024.
The versioned filename avoids stale artwork in browser caches. The source PNG is
preserved in the image library; WebP conversion only compresses the format.

Final edit prompt (the existing tile was image 1; the user reference was image 2):

> Use case: compositing. Image 1 is the edit target: existing wide website tile artwork with two floating cards and blue/purple market-chart scenery. Image 2 is the exact card-back design reference supplied by the user. Change only the two card backs in Image 1. Replace the left card's abstract back with the design from Image 2, keeping the exact dark teal-blue background of Image 2, gold border, gold geometric circles and diamond, small top/bottom symbols and gold 'LEAGUE OF LEGENDS' lettering. Replace the right card's back with the same reference design and the same gold linework and lettering, but its background must be solid neutral black, not purple or blue. Preserve the reference back's natural proportions and typography, and apply only the gentle perspective necessary to fit the existing floating card positions. Keep both backs fully visible and legible. Preserve the existing landscape 3:2 canvas, background, thin market-chart motif, two-card arrangement, camera, blue/purple ambient lighting and reflections. Do not redesign the reference ornament or invent different symbols. No extra cards, no additional text, no watermark. The two actual card surfaces should have flat printed reference artwork, not embossed invented rune patterns.
