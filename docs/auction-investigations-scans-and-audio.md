# Auction scans, direct inspection and presentation — 2026-10-16

Implementation prepared for staging; production is not part of this release.

## Investigation menu

| Investigation | Cost | Disclosure |
|---|---:|---|
| Small Price Scan | $5 | Up to 4 random unpriced cards, identities/artwork/prices |
| Large Price Scan | $8 | Up to 7 random unpriced cards, identities/artwork/prices |
| Chase Identity Peek | $15 | One hidden Overnumbered/Signature identity and artwork, no price |
| Chase Scan | $20 | One unpriced Overnumbered/Signature card and price |
| Rarity Census | $10 | Existing grouped census; Chase / Special composition stays hidden |
| Top-Three Price Peek | $40 | Round 4 only, in free and paid auctions. One random unpriced card from the three most valuable; not an aggregate valuation |
| Follow-Up Inspection | $5 | Choose one previously privately rarity-marked, unpriced card from an earlier round directly in the collection |

Random Price Scan and Top-Two Valuation are retired from new menus. New ids keep
already offered legacy prices/effects intact. The split creates 23 active options.
Menus still permit zero-hit outcomes; scans never invent matches. If all three top
cards are priced, the top-three peek reveals nothing. Draw among remaining unpriced
top-three slots is uniform/seeded, with stable slot tie-breaking on equal values.

After purchasing Follow-Up, eligible collection cards get a purple outline and
become keyboard/touch-selectable. No dropdown in the new offer. Pending choice,
purchase cost and one-per-round limit survive reloads. Choosing a card updates the
same round's finding without charging twice. If unused, a seeded eligible card is
revealed at the deadline or when all sealed bids resolve early, before history is
written. Leaving still abandons the purchase without refund. Old saved Follow-Up
offers retain their old immediate-selection behavior.

Rarity words use existing site tokens in option titles, descriptions, findings,
tooltips and guide entries. User-facing investigation text says cards rather than
copies; internally legacy clue wording stays unchanged for save/fact parsing.
Whole-dollar investigation amounts omit .00; actual card market prices retain cents.

NPCs use the current investigation definitions and recorded disclosures, including
the top-three peek as ONE priced card, not an invented top-two subtotal. Grouped
census interpretation stays grouped. No automatic private samples or proposed
personality bonuses are introduced. Bid margins/speculation are unchanged.

## Scrolling artwork

Three rows reuse a seeded, premium-weighted decorative catalog sample (up to 18
unique images), never the hidden prepared lot. Two identical groups per lane loop
by exactly one group width; reversed middle lane adds variation. Groups cover at
least the viewport width. Missing URLs are skipped and failed image URLs removed
from every duplicate rather than leaving invisible placeholders. Low-priority
eager loading warms the repeated images before they scroll into view. Duplicate
elements reuse cached URLs, not 108 unique downloads. Reduced-motion disables drift.

No new catalog/provider/Worker/D1 calls. Up to eight additional unique decorative
art URLs versus the prior ten-image sample, served by existing image hosts/cache.

## Sound map

Existing sounds: final ten seconds countdown, new round, card flip and investigation
purchase. Added cues are short, low-volume synthesized tones, not media downloads:

| Moment | Cue / purpose |
|---|---|
| Lock Bid or Pass | Short confirmation that the irreversible choice registered |
| Rival locks | Quieter soft tap, once per observed transition, no bid information |
| Player wins | Brighter rising settlement cue |
| NPC wins or no winner | Neutral descending settlement cue, not a punishment |
| Collection count completes | Soft completion chime, including Skip Reveal |
| Follow-Up selection | Flip cue when the paid selection reveals a card |

All respect existing saved mute, browser interaction/audio unlock and hidden-tab
suppression. No replay of historic result events on reload or preference toggles.
No sound-only information: visible bid states, clock, result and card prices remain.
Rival cues coalesce when several lock in one update; counted replaces mass flip
noise. Audio failures cannot interrupt play.

Potential later cues, **not implemented**: collection/opponent lock-in during the
intro, inventory sale confirmation and daily-challenge completion/reward. These
could help distinguish phases but should be tested for repetition before adding.

## Verification

Focused tests cover current/legacy offers and amounts, scan quantity/visibility,
random top-three targeting, grouped NPC census, pending reload/choice, deadline and
early-resolution fallback, exactly-once payment/history, sound event deduplication,
mute/background behavior and premium-weighted image sampling. Browser coverage
includes direct card selection and rarity colors in dark/light and desktop/mobile.
Complete release check and live staging verification must pass before handoff.
No migrations or daily-snapshot replacement is needed.
