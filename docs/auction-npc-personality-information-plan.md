# NPC personality information bonuses — proposal

Status: planned only, 2026-10-16. Not enabled by the investigation release.
The current implementation has no automatic private samples. Keep that version
as the staging control before introducing any bonus.

## Intent and limits

Make rivals better at their specialty, not universally better informed. Prefer
counts, rarity markers and identities to exact prices. A bonus can return no hits;
never reroll it because the hidden result is unhelpful. Do not change bid margins,
speculation or investigation prices in the same experiment.

Proposed ceiling: one bonus per NPC per auction, in addition to its existing
three/four scheduled investigations. Round and chance are seeded per NPC/auction;
no per-round accumulation of automatic priced cards. Start with the first two
profiles below, not the whole table. Probabilities and quantities are trial values.

| Rival | Proposed specialty bonus | Timing / chance | Information withheld |
|---|---|---|---|
| The Playset Builder | Identify up to two repeated ordinary Rare/Epic printings and their copy counts, one representative location each | Round 2, 50% | Prices; special/chase printings; other matching locations |
| The Collector | Mark rarity/location of up to two hidden Alt-Art copies | Round 2, 50% | Identities, prices and higher chase/special cards |
| The Dealer | Count all ordinary Common-through-Epic copies as one combined stock total | Round 1, 40% | Category breakdown and value; no free Bulk Valuation |
| The Analyst | Count ordinary Alt-Art copies | Round 2, 40% | Alt-Art subtotal, identities and premium composition |
| The Opportunist | Reveal one ordinary Rare/Epic identity | Round 2, 40% | Price; chase/special identities |
| The Gambler | One random hidden card's rarity/location | Round 1, 35% | Identity and price; no guaranteed chase hit |
| The Bargain Hunter | Count ordinary Common and Uncommon copies separately | Round 1, 40% | Exact value and identities |
| The Follower | No extra hidden information; lean on existing public reveals and prior completed bids | No bonus initially | Current sealed bids and other players' private information |
| The Archivist | Expansion counts only | Round 1, 40% | Rarity, identities and prices; no full Lot Audit |
| The Skeptic | One uniformly random hidden priced copy as a cross-check | Round 3, 35% | Every other unseen price; no targeted top-card sample |
| The Closer | Reveal one ordinary Epic/Alt-Art identity | Round 3, 40% | Prices and higher chase/special identities |
| The Trust Fund Kid | No extra information initially; its distinctive trait is overconfidence, not expertise | No bonus | Preserve the possibility of expensive mistakes |

Ordinary eligibility must use the shared investigation predicates, excluding
Metal, Best Of, T1, ultra-rare promos and other special pools as appropriate.
Selecting from hidden slots is seeded, not based on their actual prices. The
Skeptic's uniform sample is the only proposed new priced disclosure, and should
be tested separately after the non-priced pilot.

## Player visibility and fairness

- Label these as **Personality Insight**, with an icon and a short specialty
  description. During bidding disclose the type only, never private contents.
- At settlement show the exact earned findings under the relevant round's bid
  history, separate from its selected investigation. No cumulative icons.
- Use the same knowledge/reveal snapshots and visibility levels as paid options.
  A rarity marker must not quietly provide the card's actual price to the bidder.
- Count the bonus in the NPC information budget and guide; it is a deliberate
  NPC-only advantage. Keep chosen investigations visibly separate. No extra fees
  or fictitious NPC wallet deductions.
- Preserve information already earned in saved games. New rules apply only to
  new auctions. Version the rules for daily challenges and freeze them with the
  shared daily snapshot so players receive the same challenge.

## Implementation and acceptance plan

1. Establish current staging play-test results. Add a pure, seeded personality
   insight policy behind an off-by-default rules flag, initially Playset Builder
   and Collector only.
2. Persist the bonus result, source and round once; merge it through the existing
   information interpreter. Add settlement/guide disclosure and old-save parsing.
3. Run paired control/bonus simulations over at least 2,000 free and 2,000 paid
   auctions plus independent seeds. Report per-profile opening/final bid ratios,
   early buyouts, passes, winner losses, player profit and priced/identity/rarity
   disclosure counts. Include player strategies, not only player-passes runs.
4. Provisional guardrails: no more than 10% increase in a profile's median opening
   bid, no more than 3 percentage points increase in round-one buyouts, and no
   collapse in NPC overpayment frequency. Inspect distributions and rare lots,
   not only averages; these thresholds are proposals, not balance guarantees.
5. Test zero hits, overlapping public clues, reloads, no unseen-price leakage,
   exactly-once bonus awards, round-specific history and daily reproducibility.
   No external API, Worker or database calls should be added to normal play.
6. Stage only after user approval, play-test, then decide whether to expand the
   roster. Avoid compensating every weaker bidder with more hidden information.
