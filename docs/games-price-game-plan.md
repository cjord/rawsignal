# Games: Riftbound Price Showdown

Requested 2026-10-14. First implementation: Riftbound singles only.

- `/games` joins the shared desktop/mobile navigation, with existing-style game tiles.
- `/games/riftbound-price`: Normal compares two cards; Hard compares three. Desktop uses columns; mobile stacks cards. Names and uncropped artwork are the only pre-answer clues.
- Choose the highest TCGplayer market price, rounded to USD cents. Reveal all prices, highlight the winner green and an incorrect selection red, then advance after one second. Auto advance can be turned off; manual Next is available. Background tabs do not advance until visible again.
- Track total correct, streak, answered count and accuracy for the current session. Restart or changing difficulty resets the score. No account, leaderboard, persistent score or database writes.
- Reuse detail-art pointer tilt, keyboard-accessible buttons, reduced-motion support, textual outcome feedback and reserved reveal space. Restore keyboard focus for the next round.
- Load the existing eleven Riftbound section feeds once on entering the game. Existing Worker/browser caches apply. No per-round catalog requests, ingestion changes, upstream pricing API calls, history requests or migrations. Cold sessions can cause eleven existing feed requests/read paths; rounds add zero catalog/API calls (artwork can load from its external CDN). Prices remain frozen until reload.
- Exclude unavailable/non-positive market prices and ambiguous same-name/art printings with different prices. Within a round, avoid identical names/art, price ties at displayed cents and repeats from the immediately preceding round when the pool permits. Keep product identities unchanged.

Final name chosen by the user: **Riftbound Price Showdown** (2026-10-14). The route remains `/games/riftbound-price`.

## Later phases / decisions

- Pokémon: reuse the pure sampler/scoring and game presentation, with its own feed pool and tile. Decide English-only scope and printing visibility before enabling.
- Mixed sealed/cards: opt-in mode only, never silently mixed. Decide product-type restrictions and comparable price bands first; boxes versus cheap singles are often trivial comparisons.
- Optional close-price rounds, best streak by difficulty, additional session controls and a compact single-request pool endpoint if traffic justifies it. No new source spending needed.

## Validation

Unit tests cover eligibility, ambiguous printings, ties, distinct rounds, repeat avoidance and double-answer protection. Browser tests cover concealment, scoring, reveal/advance, difficulty reset, keyboard input, responsive layout and request counts. Full release gate required before deployment. Implementation is local; deployment needs a separate user request.

Validated 2026-10-14: `npm run check` passes (393 unit tests passed, one skipped; 29 Chromium tests passed). No new lint warnings. Dark/light game layouts checked at 1440, 561 and 390px; the shared navigation switches to its compact row below 700px to fit the sixth tab. Existing local D1 schema/cache warnings on older detail-page fixtures remain outside this feature. Test-only fresh page keys and external-script isolation keep browser fixtures deterministic; production cache and affiliate behavior are unchanged.
