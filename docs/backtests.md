# Walk-forward backtest log

Harness: `scripts/backtest/walk-forward.mjs` (todo P1). Runs replay the local
max-profile database (`.wrangler/local-profiles/max.sqlite`): at each origin date every
strategy sees only observations known by that date; forward 7/30/90-day returns judge
the picks. The production `evaluateMarketSignal` is imported directly, so harness and
live model cannot drift. Raw reports live under `backups/backtests/<run>/` (local-only);
this file records the findings that drive decisions.

Standing caveats for every run against this archive:
- **Single regime.** Feb 2024 → Sep 2026 is one broadly rising collectibles market;
  every conclusion is conditional on that regime.
- **No liquidity gate.** Archived sales do not exist; a price floor (`--min-price`) is
  the proxy, applied identically to all strategies.
- **Marks, not executions.** Forward returns are market-price marks; no spread, fees,
  or fills.

## Run `full-v1` — 2026-09-01 (baseline: current production model)

16,982 products · 117 weekly origins (2024-05-06 → 2026-07-27) · ~818k evaluator calls.
Headline table at the $5 floor (`report-min5.md`; unfloored `report.md` agrees
directionally but is noisier below $1):

| strategy | side | n | med fwd30 | hit | strong ±5% | top-20 precision |
|---|---|---:|---:|---:|---:|---:|
| model:conservative | buy | 3,412 | 0.00% | 48.1% | 30.9% | 50.3% |
| model:balanced | buy | 44,833 | +0.72% | 56.7% | 23.8% | 52.0% |
| model:aggressive | buy | 160,064 | +1.27% | 62.1% | 25.4% | 52.5% |
| model:balanced | **sell** | 709,197 | **+1.50%** | **19.7%** | 7.3% | **18.2%** |
| near-90d-extreme | buy | 2,340 | 0.00% | 45.8% | 23.5% | 45.8% |
| momentum-30d | buy | 2,340 | +6.77% | 62.3% | 53.0% | 62.3% |
| cohort-median | buy | 2,340 | +2.21% | 66.4% | 32.8% | 66.4% |
| random | buy | 2,340 | +1.08% | 55.8% | 30.6% | 55.8% |
| random | sell | 2,340 | +0.95% | 25.9% | 9.9% | 25.9% |

### Findings

1. **The sell side is worse than random.** 600k–800k sell signals fired (the model
   calls "sell" on a huge share of card-days in a rising market); only ~18–22% were
   followed by a 30-day decline, and the model's top-20 sell precision (18.2%) loses
   to random selection (25.9%). Prices rose a median +1.5% after a "sell". This is the
   strongest possible mandate for P3's Breakout gate and a general sell-side rework —
   near-a-high alone is anti-signal in a rising regime.
2. **Buy-score calibration is inverted.** Balanced Hot Buy hit rate falls
   monotonically with score: 60.3% for scores 58–60 down to 49.8% for 70–97. The
   board's top-ranked buys perform worst — high score means closest to the low with
   the biggest swing, i.e. knife-catching that the distance<0.5 stabilization gate
   does not fully catch. Direct target for P2 robust extremes + P3 regime evidence.
3. **Strictness does not order performance.** Conservative buys (48.1% hit) underperform
   balanced (56.7%) and aggressive (62.1%) — presets need recalibration (P2).
4. **Cohort-median is the strongest buy baseline** (66.4% hit, +2.2% median fwd30):
   buying below the cohort median beat proximity-to-own-low. Endorses P4's cohort
   features, with the single-regime caution (laggards catching up is a bull-market
   pattern).
5. **30-day-loser mean reversion is real** even at the $5 floor (62.3% hit, +6.8%
   median fwd30) — worth folding into P2/P3 thinking as a stabilization-timed entry
   rather than a standalone chase.
6. Buys do beat their nearest baseline: every model tier beats near-90d-extreme
   (45.8%), confirming the adaptive-cutoff/scoring machinery adds value over raw
   proximity — the problem is concentrated in the sell side and the top of the score
   scale.

## Run `full-v2` — 2026-09-01 (challenger: P2 robust percentile extremes)

Same grid as `full-v1` (16,982 products · 117 origins), evaluator `model:"v2"` —
window extremes move from raw min/max to winsorized 10th/90th percentiles (research
§15.1); presets unchanged (a 2,000-product calibration pair, `cal-v1-s2000` /
`cal-v2-s2000`, showed buy coverage already comparable without retuning — the wider
robust capture is offset by more `awaiting-stabilization` holds at the robust floor).
v1 → v2 at the $5 floor:

| strategy | side | n | med fwd30 | hit | top-20 precision |
|---|---|---:|---:|---:|---:|
| conservative | buy | 3,412 → 3,995 | 0.00% → +0.28% | 48.1% → 51.2% | 50.3% → 50.0% |
| balanced | buy | 44,833 → 43,531 | +0.72% → +1.11% | 56.7% → **60.0%** | 52.0% → 51.2% |
| aggressive | buy | 160,064 → 156,728 | +1.27% → +1.61% | 62.1% → **64.8%** | 52.5% → 52.9% |
| balanced | sell | 709,197 → 819,322 | +1.50% → +1.42% | 19.7% → 21.8% | 18.2% → **33.0%** |

### Findings

1. **v2 dominates v1 on the buy side at comparable coverage**: hit +3–4pp at every
   strictness, median fwd30 up ~50%, with n within ±17%. The glitch-mark failure mode
   (one anomalous daily low defining "the low") is gone.
2. **Calibration lifts ~3pp in every score quintile** (63.3% → 53.5% across quintiles
   vs v1's 60.3% → 49.8%) but the shape is **still inverted** — top-ranked buys remain
   the weakest. Robust extremes de-noise qualification; they do not fix top-of-scale
   knife-catching. That stays P3's regime-evidence mandate.
3. **Top-20 buy precision is flat** (~51–53%) and still loses to the cohort-median
   baseline (66.4%) — the P4 mandate is unchanged.
4. **Sell top-20 precision nearly doubles** (18.2% → 33.0%, now above random's ~26%):
   robust highs stop one spiked mark from crowning the "high", so the top-scored sells
   are real overextensions far more often. Overall sell hit (~22%) still trails the
   random base rate because the model calls "sell" on most card-days in a rising
   regime — the volume problem is P3's Breakout gate.
5. Strictness still does not order performance (conservative 51.2% < balanced 60.0% <
   aggressive 64.8%) — unchanged by extremes; revisit with P3 regime gates before
   touching preset weights.

**Verdict:** v2 is the standing challenger — strictly better or equal nearly
everywhere, worse nowhere material. Production keeps serving v1; promotion waits on
the P1b live shadow comparison per the champion/challenger plan.
