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
empty rounds and completed in about 0.2 seconds. Staging deployment is the next step;
production is not authorized for this release.

## Tile artwork

Built-in image-generation skill/tool, 2026-10-14; user selected **clean abstract cards with a market-chart motif**. Saved to `public/images/games/riftbound-price-showdown.webp` (1536×1024, about 154 KiB). The generated PNG remains unchanged in the generated-images library; only format compression was used for the WebP. Title/description remain HTML, not image text. No generated card imagery is used for playable rounds.

Final generation prompt:

> Use case: stylized-concept. Asset type: landscape website game-tile banner illustration for Raw Signal's Riftbound Price Showdown. Primary request: clean abstract trading cards with a market-chart motif. Composition: wide 3:2 landscape, two elegant floating portrait trading-card silhouettes facing one another in a balanced showdown composition, a restrained thin market-price line weaving behind them. Keep complete card silhouettes inside generous margins so this works at small tile sizes. Style: refined premium matte illustration with crisp beveled edges, subtle depth, not photorealistic and not a UI screenshot. Color palette: deep charcoal/navy background, restrained electric blue #2e6cff and purple #7557ff illumination, cool silver card edges. Card faces show only abstract geometric rune-like patterns; NO real card artwork, no characters, no readable lettering, no numbers, no currency symbols, no prices, no arrows suggesting guaranteed profit. Minimal atmospheric detail, strong clean focal shapes. No logos, no watermark, no text. The title will be rendered separately in HTML beneath the artwork.
