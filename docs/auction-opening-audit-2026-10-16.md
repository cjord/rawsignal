# Auction openings and lobby polish — 2026-10-16

## Scope and implementation

Local only; no push, deployment, migration, new API endpoint or pricing-provider
call. NPC bidding rules are **unchanged** pending review of the findings below.

- Investigation offers retain icon, name, description and price, without category
  headings (Count / Locate / Value) or disclosure tags. Round findings stay grouped.
- Normal-play statistics have a purple-tinted section and semantic inset colors:
  blue counts, purple rates/buyouts, green gains, red losses, amber spending and
  neutral zero amounts. A fresh save shows zero tracked counts plus the existing
  no-backfill explanation; unavailable win rate remains a dash.
- Normal lobby reuses the faded scrolling catalog-art motif. Up to ten unique
  decorative URLs are sampled with a new browser seed per visit, independent of
  hidden contents. Entry backgrounds also sample by their retained auction seed
  instead of always using the first ten catalog images. Motion stops under
  reduced motion; imagery is noninteractive, lazy/low-priority and cached normally.
  This can add up to ten distinct CDN image fetches per lobby visit, not catalog,
  D1 or paid-provider calls. Entry may select a different ten images.
- Paid entry says “Enter Paid Auction · $50 Fee,” with the fee highlighted in
  amber. The tooltip distinguishes entry from the winning bid and investigations,
  and explains nonrefundability. Lobby facts include the **current configured**
  selling-fee percentage and three rivals, alongside round count/duration.
- Normal entry increases from five to seven seconds, leaving about 3.3 seconds
  after all rivals lock instead of 1.3. Skip/Cancel and artwork checks still work;
  fees and the active timer start only after preparation. Reduced motion retains
  its short, static preparation path.

## Reproducible offline tests

Two nonoverlapping batches: seeds 0–999 and 10,000–10,999, for **each** entry type.
That is 2,000 free + 2,000 paid auctions, 12,000 opening NPC bids. The player
passes every round; the ordinary game engine resolves auctions. Use default 10%
virtual selling fees, the saved production catalog observed on Oct 16 from
`live-daily:2026-10-15`, and 1,288 eligible priced printings. No network artwork
probes, source refresh, server game writes or player-wallet changes. This is a
modeled baseline, not observed human play: a competitive human bid can prevent
some of these NPC buyouts.

```powershell
node scripts/games/audit-auctions.mjs --snapshot <saved-catalog.json> --seeds 1000
node scripts/games/audit-auctions.mjs --snapshot <saved-catalog.json> --seeds 1000 --seed-start 10000
```

Omit `--snapshot` to use bundled feeds (different prices mean different results).
The reusable script now reports per-rival opening distributions, pass rates,
round-one wins, no-guest results and extreme examples. Raw local audit outputs
stay ignored in `work/auction-opening-audit-20261016-{a,b}.jsonl`.

## Average opening bid by rival

Arithmetic means include passes, weighted by actual appearances across both
batches, rounded to the nearest virtual dollar. Every ordinary rival appears
496–576 times per entry type; the rare guest appears 155 times (7.75% of tables).
Means are higher than a typical bid because of the expensive-hit tail.

| Rival | Free mean | Paid mean | Free R1 wins | Paid R1 wins |
|---|---:|---:|---:|---:|
| Dealer | $138 | $242 | 20 | 18 |
| Collector | $151 | $284 | 26 | 25 |
| Opportunist | $140 | $283 | 22 | 28 |
| Analyst | $235 | $511 | 81 | 96 |
| Gambler | $187 | $371 | 41 | 41 |
| Bargain Hunter | $147 | $279 | 31 | 26 |
| Follower | $159 | $320 | 38 | 28 |
| Archivist | $197 | $498 | 88 | 119 |
| Playset Builder | $173 | $391 | 42 | 70 |
| Skeptic | $135 | $273 | 26 | 33 |
| Closer | $197 | $442 | 65 | 114 |
| Trust Fund Kid | $349 | $697 | 56 | 44 |

Across all opening bids, means are about **$174 free / $365 paid**. Batch medians
are **$71.48 / $74.34 free** and **$199.79 / $200.61 paid**. There is no fixed
opening bid or floor. Current medians are below the earlier ~$300 paid goal after
the newer investigation/scheduling changes; lowering every opening bid would
therefore address the wrong part of the distribution.

## Why one rival can jump far ahead

1. Every NPC gets **four additional privately priced sample copies in round one**,
   on top of public reveals and any chosen investigation. This happens even when
   its formal investigation schedule skips round one. `roundNpcs` requests
   `3 + round` sample copies, and `npcRoundInformation` adds their full prices to
   observed evidence. A genuine signature in this sample sets a large known-value
   floor; it is not treated as speculative unseen value. This free background
   information is not obvious from the displayed investigation name.
2. **Rarity Census** is available immediately. Its complete category counts switch
   valuation to a catalog-priced category estimate at all rounds, bypassing the
   usual 10% free / 8% paid opening speculation blend. Knowing that a signature
   exists is valuable even without its identity. Census was the chosen clue for
   **207/536 free (38.6%) and 325/642 paid (50.6%)** round-one winners. This is an
   association plus an identified valuation pathway, not an isolated causal test.
   Analyst, Archivist and Closer favor census/aggregate information, explaining
   their high paid means and early-win counts.
3. Most ordinary random noise is only ±2–6%, with occasional risk stretches.
   The Trust Fund Kid intentionally adds a 35–80% personal-estimate premium, but
   is **not** the primary cause: guest-free tables still end early frequently.
4. Round one has no completed public bid history. Social influence correctly
   starts in round two; NPCs do not see the player's current sealed bid or other
   NPCs' current sealed bids. It cannot pull opening estimates together.

Examples from the first batch:

- Free seed 961: Playset Builder $2,217 versus runner-up $39. Its private sample
  contained a $2,744 card; lot net value was $2,564. Large lead, but not overpayment.
- Paid seed 372: Archivist $1,054 versus runner-up $54 after Rarity Census; its
  four background sample cards were only $0.53/$0.15/$0.28/$0.32. Lot net was $773:
  a genuinely wrong estimate/overpayment driven by broader category expectations.

## Early endings

| Player-pass baseline | Free | Paid |
|---|---:|---:|
| R1 NPC buyouts | 536/2,000 = **26.8%** | 642/2,000 = **32.1%** |
| R1 buyouts on tables without the rare guest | **25.5%** | **31.5%** |
| R1 winner had a $100+ background sample card | 177/536 = 33.0% | 241/642 = 37.5% |
| R1 winner overpaid after selling fees | 122/536 = 22.8% | 106/642 = 16.5% |

The existing round-one rule requires at least two positive bids and the leader
to bid at least **2× the runner-up**, not 2× every bid combined. Increasing all
three bids by the same factor would not change their ratio or these buyouts.

## Recommended next balance experiment — not implemented

An additional **opening-only** counterfactual uses the first 1,000 seeds per type
and the same frozen catalog. Its reconstruction of all baseline bids was asserted
equal to the production engine before changing a test input. Smaller samples use
the first one/two cards from each original four-card sample. The census experiment
excludes Rarity Census from the NPC opening menu, allowing the normal weighted
selector to choose an alternative. Changes exist only in an isolated Node process;
no source/runtime bidding changes. Subsequent rounds/economy are not simulated in
these alternatives and still need a full comparison before adoption.

| Opening-only alternative | Free R1 buyouts | Paid R1 buyouts | Free median | Paid median |
|---|---:|---:|---:|---:|
| Current: four samples + opening census | 25.3% | 31.1% | $71.48 | $199.79 |
| One automatic sample; census unchanged | 21.5% | 27.4% | $65.12 | $181.59 |
| Four samples; census unavailable in R1 | **19.7%** | **19.2%** | $68.54 | $183.49 |
| One sample; census unavailable in R1 | 13.4% | 13.3% | $61.35 | $168.17 |

Based on this comparison:

- **Start by testing full Rarity Census from round two**, or lower-confidence
  valuation of its unpriced stock in the opener. Census timing has the larger
  paid-auction effect and preserves lucky genuine card discoveries. Do not
  discount individually revealed prices or erase useful rarity clues.
- Keep the four-card background sample initially; reducing it as well pushes
  early wins toward 13% in this batch and lowers opening bids further. If needed,
  later test one/two samples or tie background information to investigations.
  Either approach addresses information advantages, not a forbidden bid cap.
- Recalibrate the shared *soft* prior afterward, watching typical free/paid bids
  near the earlier ~$100/~$300 direction without hard floors or ceilings. Keep
  its weight decreasing as disclosed evidence and prior public bids accumulate.
- Preserve occasional genuine early discoveries and the rare guest's deliberate
  overpayment. An initial trial target might be 15–20% round-one NPC buyouts in
  this passive-player benchmark, then validate with human bids/playtesting.
- Surface all sources of NPC private knowledge in completed-auction inspection,
  not just the chosen clue, if free background samples remain. No live private
  cards should leak during bidding.

Do not change the 2× buyout rule or cap bids solely to hide the tail. Re-run the
same seeds and prices for each proposed change, checking early-ending rate,
median opening bids, later-round participation and loss-share frequency together.

## Validation

Final `npm run check` passed: **529 node tests passed, one skipped; 71 Chromium
journeys passed**, with production build, lint and typecheck green. There are 21
existing complexity warnings and no new warnings. Tests cover the seven-second
review hold without early charges/timer, Skip/Cancel, missing artwork, tag-free
investigation offers, configured fee facts, colored statistics, full-window
noninteractive decoration, reduced motion and desktop/phone overflow. Screenshots
reviewed in dark/light at desktop and phone widths. Existing Singles/Sealed,
history, EV, heatmap, practice and daily-game journeys remain green. No remote
push/deployment, data regeneration or migration was performed for this update.
