# Auction NPC balance — 2026-10-16

Approved for staging and production after paired offline trials. No changes to
rarity odds, entry fees, selling fees, NPC margins or buyout thresholds.

## Settings

| Setting | Free | Paid |
|---|---|---|
| Speculation weights, rounds 1–4 | 14%, 11%, 8.5%, 6% | 20%, 18%, 15%, 12% |
| Weaker rivals' cumulative random sample targets | 4 / 6 / 8 / 10 | 5 / 8 / 11 / 14 |

Weaker rivals: Dealer, Collector, Opportunist, Bargain Hunter, Follower and Skeptic.
Other profiles retain random sample targets of 4 / 5 / 6 / 7. Samples avoid public
cards and earlier random samples but can overlap purchased investigations; these
targets are not guaranteed counts of newly useful clues. Formal investigations
retain the existing three/four-round schedule. They carry no modeled NPC expense.

Speculation blends a frozen, catalog-derived expected value with personal evidence,
scaled down by the individually priced coverage. It is not a fixed fraction of the
actual lot value or a minimum bid. Existing evidence floors, category inference and
exact-top-valuation bypasses remain unchanged. Known prices remain undiscounted.

Ordinary rivals follow previous public bids with 45% / 55% / 65% probability in
rounds 2–4, blending 30% toward the median, bounded to ±12% / ±16% / ±20% of
their personal bid. Follower probabilities are 75% / 85% / 95%, bounded to
±18% / ±22% / ±26%. Influence can lower as well as raise bids. Current sealed
bids, other rivals' private findings and the hidden collection total are never
inputs. Existing saved rounds retain their bids; new rounds use the new policy.

## Offline evidence

Frozen saved production catalog: 1,288 eligible priced printings from
`live-daily:2026-10-15`. No data refresh or artwork probes. Compare identical
lots/rivals/seeds before/after with the player passing every round and actual
early settlement enabled. Percentages average per-bid ratios to gross collection
market value; they do not sum bids across rounds or use dollar-weighted ratios.

Primary batch: 2,000 free and 2,000 paid auctions per configuration. A separate
validation batch repeats that count with different seeds. Final candidate combines
the accepted free trial and stronger paid-only follow-up.

| Metric | Original free → final | Original paid → final |
|---|---:|---:|
| Opening median, primary | $72.88 → $84.18 | $200.54 → $318.59 |
| Opening mean, primary | $174.23 → $185.53 | $364.94 → $467.90 |
| Settlement bid / market value, primary | 46.4% → 49.8% | 34.7% → 43.8% |
| Winning bid / market value, primary | 73.2% → 75.2% | 60.0% → 66.3% |
| Round-one NPC buyouts, primary | 26.8% → 23.8% | 32.1% → 21.4% |
| Winners losing money after selling fees, primary | 21.0% → 22.0% | 15.3% → 17.9% |
| Settlement bid / market value, validation | 45.8% → 49.2% | 35.9% → 44.4% |
| Opening median, validation | $71.46 → $82.71 | $201.23 → $317.92 |

The primary free/paid settlement gap narrows from 11.7 to 6.0 percentage points.
More competitive runner-up bids reduce early NPC buyouts even as bids increase.
Free simulation outputs were asserted identical between the first and paid-only
follow-up trials. Final application parity is checked against the tested candidate.

These are simulations, not human-play telemetry. Results depend on catalog prices,
the player passing, and which auctions survive to later rounds. The combined trial
does not isolate each lever's causal effect. Follow up with active-player strategies
and human play-testing; watch rare-guest overpayments and paid underestimation before
another blanket increase. All runtime calculation remains browser-local: zero new
Worker requests, database reads/writes or paid API calls for NPC balancing.
