# Auction showcase and delayed investigations — 2026-10-16

Released to staging from source `845d726`. Production is unchanged.

## Decisions and game rules

- Delayed Gratification costs **$15**, is offered in rounds 1–2 only, and has half
  the weight of an ordinary non-basic option. It does not replace the guaranteed
  basic choice. Half weight is not a fixed percentage chance to see it in a menu.
- Buy in round 1 → triggers at the start of round 3; round 2 → round 4. The normal
  public reveal happens first. From the five highest-value still-unpriced cards,
  pick two randomly without replacement using the auction seed. If fewer remain,
  reveal those; do not invent cards. No immediate information, early trigger or
  refund if the auction ends first. This is one paid investigation, not a free
  additional purchase in its activation round.
- Save the due/resolved rounds and exact disclosure snapshot with the original
  purchase. Trigger once. Show the matured finding under its purchase round and
  explicitly name its activation round. Settled history can show the matured
  result without rewriting frozen bids. NPCs follow the same delay and use only
  their own revealed facts; no automatic free samples are restored.
- Free entry is **Bilgewater Auction House**; $50 entry is **Piltover Auction
  House**. Internal free/paid keys and prepared lots stay compatible.
- New auctions and inventory sales use a fixed **10%** selling fee; remove the
  lobby setting. Preserve historical active auctions' frozen fees and settled
  results rather than rewriting money already spent. Legacy wallet settings may
  remain in saves for compatibility but do not alter new auctions or sales.
- Display **Known Sale Value** during bidding: individually priced cards less
  the fee, grouped by printing for rounding. Never consult unpriced duplicates,
  hidden prices or category subtotals. At settlement, add up only cards revealed
  so far. Market value remains separate; these are virtual modeled sale proceeds.

## Reveal, header and presentation

Above $1,000 (strictly, not equal), a newly visible price gets a short bling cue.
Above $500, the revealed card has a short sparkle overlay; hidden/identity-only
cards get neither effect based on their hidden price. Existing foil/glow remains.
The sound tracker compares priced visible slots, not just card count, so adding
a price to an already identified card is recognized. No repeated bling on sorting,
ordinary re-renders or historic result reloads. Sounds obey mute, gesture unlock
and background-tab suppression. Intro collection/opponent lock-ins get quiet cues.

Keep the timer's buyout explanation alongside the round count, explicitly saying
“above second place”; the tooltip retains the two-positive-bid and tie conditions.
At ten seconds the timer and the entire header warn red; reduced motion disables
flashing and sparkles. Investigation/bidding/results tiles use subtle existing
accent tokens; collection tint follows its public theme. Sound is an icon button
with an accessible action label; Leave Auction has a red border and is rightmost.

## Showcase ownership

`/games/riftbound-auction/showcase` is linked from the normal auction lobby.
Show auction statistics above the display. Editing has inventory and showcase
side by side on desktop, stacked on mobile, with the existing faded scrolling
catalog artwork behind both. Native drag/drop is optional: explicit Add/Return
and reorder arrow buttons support keyboard and touch.

There are 20 **distinct printing** slots, one physical owned copy per slot. Move
one copy out of sellable inventory when adding. A second copy of that printing
can remain sellable, but the reserved copy cannot be sold by Sell All, rarity or
individual sales. Return it to inventory before selling. Moving/reordering does
not change cash or statistics, and cannot occur during an active normal auction.
Net worth includes both sellable and showcased holdings without double-counting.
Unpriced reserved cards remain owned and can be returned. Reset clears showcase
and optional display name alongside normal inventory; its confirmation says so.

## Sharing and limits

The optional display name, known statistics and up to 20 selected card records
are serialized as a bounded Unicode-safe URL fragment. No new database, uploads,
accounts or public write endpoints. The fragment contains neither wallet cash,
unselected holdings nor arbitrary extra save fields. The server does not receive
the fragment. Prices/statistics freeze at share time; edits/sales afterward do
not change existing links. Artwork is resolved by printing id from trusted site
catalog data, not arbitrary image URLs supplied by a shared payload.

Shared pages are read-only and do not import holdings, reset progress, start games
or modify the viewer's browser save. Malformed/oversized snapshots fail safely.
Missing catalog artwork/price stays unavailable. Links are self-reported, not
verified ownership or authenticated profiles. Anyone with a link can read it;
links cannot be revoked. Some social apps may reject long links or omit previews.
Short updateable profiles and verified identities require future account/storage
work, not an implicit addition to this browser-only feature.

The profile loads the same existing 11 cached Riftbound feeds for artwork/current
owner prices. Moves, reorder, sharing and decoding add no API or database calls.
Daily snapshots are not replaced; challenge inventory continues to auto-sell and
does not enter the normal showcase. No migrations or extra ingestion work.

## Validation

Tests cover delayed eligibility/weight/timing, early ending, seeded selection,
NPC disclosure timing, per-round history, copy conservation/protected sales,
20-printing cap, reorder/reload, share Unicode/privacy/frozen values/malformed
inputs, fixed future fees, hidden-value independence, sound boundaries, drag/touch
controls, colors, urgent header, intro audio and reduced motion. Complete release
gate and live staging verification are required before handing off.

Release verification: `npm run check` passed with 553 node tests, one skipped,
79 Chromium journeys, build/lint/typecheck, and the same 21 existing complexity
warnings (no new warnings). A test-only prefer-const error was corrected before
the final run. The revealed-sale-value regression test also caught and fixed a
hidden duplicate-price lookup; the calculation now uses revealed values only.

Staging version `d88a6156-73b1-41ea-934e-8842184279b3` passed live verification:
round-three delayed activation without extra calls; showcase drag/reserved-copy
sales protection/return/reload; frozen shared profile with no wallet or unselected
inventory; desktop/mobile and dark/light layouts. Both auction houses matched NPC
calculations in all four rounds and passed settlement/reload/leave with no extra
gameplay data calls or browser errors. Only isolated virtual browser saves were
used. No migrations, snapshots replaced or production changes.
