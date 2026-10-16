# Investigation revision and NPC information boundary — 2026-10-16

Prepared for the user-authorized staging release; production remains unchanged.
Supersedes the earlier automatic
private-sample policy in the published balance notes. Current speculation, social
influence, rarity budgets, fees and buyout thresholds are otherwise unchanged.

## Current investigation changes

| Investigation | Cost | Exact disclosure |
|---|---:|---|
| Rarity Census | $12 | Ordinary Common, Uncommon, Rare, Epic and Alt Art counts. Overnumbered, Signature and all Other/Promo/Showcase cards share **Chase / Special**, with no premium breakdown. |
| Rarity Markers | $5 | Up to 10 Rare/Epic/Alt-Art copy locations and rarities. No identities or prices. Replaces three separate marker options; excludes Metal, ultra-rare promos, Overnumbered and Signature. |
| Rare & Epic Identity Peek | $6 | Up to 10 ordinary Rare/Epic identities and artwork, no prices. Replaces both rarity-specific identity peeks. |
| Bulk Valuation | $8 | Exact subtotal of ordinary Common/Uncommon/Rare/Epic copies. Alt Art and special/chase treatments excluded. |
| Alt-Art Valuation | $10 | Exact Alt-Art subtotal, without identities or locations. Replaces Rare Valuation. |
| Lot Audit | $4 | Retains set/Common/Uncommon/duplicate counts; adds unique-printing count, up to three most-repeated ordinary printing identities with total copy counts, and three random hidden rarity markers. No prices. |

Lot Audit identifies one representative of each repeated printing, not every
matching location. It excludes special/chase and Alt-Art printings from repeated
identity peeks; its random rarity markers can still hit any rarity. A unique-card
lot can return no repeated identities. The markers and representative identities
can overlap earlier public information; there is no guaranteed valuable discovery.

All active descriptions name their target explicitly, e.g. “up to 12 RARE copies”
or “6 EPIC copies,” and distinguish rarity-only, identity-only and priced facts.
The guide renders the same active definitions, plus scope/examples and NPC rules.
No Count/Locate/Value tags were reintroduced. There are now 22 active choices.

Chase / Special is an information bucket, not a ranking or a promise of high value.
Including Other/Promo makes the census unable to distinguish one Signature from
several cheaper promos. NPCs infer a catalog-weighted mixture of that combined
bucket rather than reading its actual hidden composition.

## NPC information — before and after

Previously, ordinary NPCs automatically learned identity and price for 4/5/6/7
private copies over rounds 1–4. Six weaker profiles received 4/6/8/10 in free or
5/8/11/14 in paid auctions. Those were outside their selected investigation and
additional to shared public reveals. NPC investigation fees/entry costs are not
modeled as wallet charges; NPCs select from a tier-eligible personality-weighted
pool rather than the player's three-option menu.

At the user's explicit choice, **all automatic private samples are removed**.
The compatibility `sample` save field is empty on new rounds. Private knowledge is
rebuilt from recorded investigation reveal snapshots, not old sample, inspected
or identified arrays. An older clue without a disclosure snapshot is not rerun
against hidden cards to fabricate missing knowledge. Saved active rounds retain
their already-generated bids; subsequent rounds use this new boundary.

NPCs retain only:

- shared public cards/prices;
- facts from selected investigations, including aggregate subtotals, rarity and
  identity markers at their actual visibility;
- their earlier recorded investigation findings;
- public collection size/theme, the frozen catalog-level prior, and previous
  completed public bids. Current sealed bids and other players' private clues
  remain inaccessible to bid calculations.

Three/four-round investigation scheduling and imperfect personality-weighted
inference remain. Exact category subtotals form an evidence floor so speculation
cannot reduce an estimate below the disclosed subtotal plus known outside cards.
Expanded Bulk and Alt-Art subtotals are disjoint; expanded Bulk supersedes older
overlapping ordinary-category subtotals when interpreting a mixed legacy save.

## Player bid history

Each completed round records only that round's player investigation, matching NPC
history. The Investigation tile still retains all findings grouped by round.
Rendering normalizes older cumulative bid snapshots without rewriting storage:
tagged clues use their purchase round; untagged legacy clues use first appearance.
A round with no purchase shows No Private Clues, not previously purchased icons.
New settlement records also use this normalization, preserving old untagged active
findings when they first appear. Private/settled information boundaries remain.

## Paired offline balance check

Same saved production catalog (1,288 priced eligible printings), seeds, generated
lots and rivals as the accepted balance trial; player passes every round. Primary
batch: 2,000 free + 2,000 paid. Independent validation repeats those counts using
different seeds. No data refresh, Worker requests, database calls or external APIs.

| Metric | Published free → revised | Published paid → revised |
|---|---:|---:|
| Opening median, primary | $84.18 → $88.72 | $318.59 → $317.16 |
| Settlement bids / gross value, primary | 49.8% → 55.7% | 43.8% → 46.5% |
| Winning bid / gross value, primary | 75.2% → 90.3% | 66.3% → 73.3% |
| Round-one NPC buyouts, primary | 23.8% → 22.2% | 21.4% → 21.1% |
| Winner loss after selling fee, primary | 22.0% → 31.4% | 17.9% → 26.7% |
| Settlement bids / gross value, validation | 49.2% → 53.9% | 44.4% → 46.5% |
| Opening median, validation | $82.71 → $86.13 | $317.92 → $317.35 |
| Winner loss after selling fee, validation | 21.7% → 30.3% | 20.8% → 25.4% |

Removing sample freebies does not necessarily lower final bids: stronger ordinary
valuations and protection of exact subtotals offset the information reduction.
Opening medians remain close to the accepted release, and early buyout frequency
does not increase, but winners lose more often. These combined changes are not an
isolated causal test of removing samples. Percentages average individual ratios,
not dollar-weighted aggregates; actual early settlement changes survivors in each
round. Human-player strategies and other price snapshots can change outcomes.
Do not automatically raise speculation or rebalance NPC margins without reviewing
these results and the user's next decision.

## Compatibility and follow-up

New ids retain old offered options, costs, clue text and effects for saved games.
Retired definitions are excluded from new player menus/NPC choices and the guide.
Old full census clues remain full censuses; their historical disclosure is not
silently rewritten into a grouped result. No migration, daily-snapshot replacement
or normal wallet/inventory reset. No extra runtime data calls.

Tests cover grouping invariance, eligibility/exclusions, exact totals and no
double-counting, price/identity/rarity visibility, legacy compatibility, empty
automatic samples, removal of poisoned old private arrays, retained earned clues,
current-round history and read-only legacy normalization. Browser checks include
the guide and settled-history controls at desktop/mobile widths in both themes.

Final clean `npm run check` passed: 537 node tests passed, one skipped, 73 Chromium
checks passed, production build/lint/typecheck passed. There are 21 existing
complexity warnings and no new ones. An earlier request-count failure coincided
with a development-server refresh during edits; the unchanged assertion passed
in the final source-frozen run. History screenshots reviewed at desktop/mobile
widths in dark/light themes. Staging release verification is recorded separately.

Future personality-specific information bonuses are planned, not implemented:
[proposal and test gates](auction-npc-personality-information-plan.md).
