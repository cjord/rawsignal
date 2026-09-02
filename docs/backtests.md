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

## Run `full-v2r` — 2026-09-01 (challenger: P3 breakout sell gate added to v2)

Same grid; v2 now carries the `breakout-continuation` sell gate (`core/domain/regime.ts`
classifies price-only Breakout at each origin; a sell near the high with accelerating
momentum is suppressed). Buy side is bit-identical to `full-v2` by construction. Sell
side, v2 → v2r at the $5 floor (balanced):

- n 819,322 → 752,506 (−8.2%; ~67k sells suppressed as breakouts)
- hit 21.8% → 22.0%; median fwd30 after "sell" +1.42% → +1.23% (−14% adverse drift);
  median excursion 2.30% → 2.08%. Same direction at every strictness.
- top-20 precision 33.0% → 32.0% (flat within noise).

### Findings

1. **The gate removes exactly the right sells.** The 66,816 suppressed balanced sells
   were followed by a **median +5.43% further rise** (mean +8.97%) over 30 days; only
   19.8% ever declined. Against the kept pool's +1.23%, the gate is cleanly separating
   breakout continuation from overextension — the research §3.5 distinction, confirmed
   walk-forward.
2. **Aggregate sell metrics move modestly** because the gate trims 8% of an enormous
   pool: the sell side's remaining problem is volume (it still fires on most card-days
   in a rising regime and still trails random's 27.6% hit). The volume fix is
   tightening what counts as a sell candidate at all — P4 cohort evidence and cutoff
   recalibration territory — not more suppression of qualified sells.
3. Regime label distribution on current live data (local build, 16.5k products):
   ~42% steady, ~41% overextended, ~10% falling, ~3% improving, ~2% spike, ~1.5%
   breakout — the Breakout label is appropriately rare.

**Verdict:** the gate earns its place in the challenger (kept sells are strictly less
wrong; what it rejects is demonstrably continuation). v2 = robust extremes + breakout
sell gate going into P1b shadow; labels ship descriptively regardless of promotion.

## Run `full-v2c` — 2026-09-02 (challenger: P4 cohort dampener + breadth qualifier)

Same grid; v2 adds the cohort confidence dampener (a ≥5% own move within 3% log of the
cohort's median move drops confidence one tier) and cohort breadth as the Breakout
qualifier (<40% of the cohort rising vetoes Breakout, so such spikes stay sellable).
v2r → v2c at the $5 floor (balanced):

| | n | med fwd30 | hit | top-20 precision |
|---|---:|---:|---:|---:|
| buy | 43,531 → 43,218 | +1.11% → +1.12% | 60.0% → 60.1% | 51.2% → **51.8%** |
| sell | 752,506 → 757,373 | +1.23% → +1.21% | 22.0% → 22.1% | 32.0% → 32.2% |

Aggressive buy top-20 52.9% → 53.6%; everything else flat or marginally better;
nothing regressed.

### Findings

1. **The dampener demotes exactly the right buys.** The 758 balanced buys it dampened
   but left qualifying hit only **46.6%** (median fwd30 −0.54%) vs the pool's 60.1% —
   cohort-wide dips masquerading as card-specific value. The 312 it pushed below the
   score minimum hit 54.2% (median +0.83%) — also below-average picks. Confidence is
   now doing ranking work the raw score could not.
2. **Aggregate lift is small by design** — the gated middle model moves one confidence
   tier for a minority of signals rather than reweighting every score. The top-20 gain
   (+0.6pp at balanced and aggressive) comes from the weak rows sinking in rank.
3. **The cohort-median baseline still leads model buys** (66.4% vs ~52% top-20). The
   dampener narrows nothing structural: it removes cohort-driven false positives but
   does not chase cohort laggards. Closing that gap is the contingent v3 (weighted
   cohort term) — which this archive's single regime still cannot calibrate safely.

## Run `full-v21` — 2026-09-02 (challenger recalibration: v2.1 turn confirmation)

A feature dump (3,000 products, ~337k near-extreme card-days, `--features` +
`scripts/backtest/calibrate.mjs`) showed proximity-to-the-extreme is ANTI-predictive
(sitting on the low: 40% hit; 1–12% off it: ~70%) while turn confirmation, cohort
breadth, and confidence order forward returns cleanly. v2.1 therefore: hardened buy
gate (≥1% off the robust low AND week ≥ 0), NEW mirror sell gate `awaiting-rollover`
(≥0.4% off the robust high AND week ≤ 0), and an evidence-weighted score replacing
the proximity-led one (turn strength 25 + 30-day turn 15 + breadth 25 + confidence
20/10 + swing 15 [+ pull-back 10 for sells]); minScores 55/45/35. Confirming full run
(formula fitted on the sample, confirmed out-of-sample on the full grid), v2c → v2.1
at the $5 floor (balanced):

| | n | med fwd30 | hit | top-20 precision |
|---|---:|---:|---:|---:|
| buy | 43,218 → 59,115 | +1.12% → **+2.79%** | 60.1% → **71.0%** | 51.8% → **60.7%** |
| sell | 757,373 → **19,156** | +1.21% → **0.00%** | 22.1% → **47.5%** | 32.2% → **50.6%** |

### Findings

1. **Buys now beat every baseline on hit rate** (71.0% vs cohort-median 66.4%,
   momentum 62.3%, random 51.7%) with 2.5× the median forward return and MORE
   coverage — the gate drops knife-catchers while the score admits confirmed bounces
   the proximity score under-ranked. Aggressive top-20 64.7% closes to within 1.7pp of
   the cohort-median baseline.
2. **The sell side is finally a signal**: 97.5% volume cut, hit rate more than
   doubled to ~47–49% at every strictness (best baseline: 31.2%), top-20 precision
   50.6%, and zero median adverse drift after a "sell".
3. **Calibration is nearly flat-and-high instead of inverted** (72.6/73.2/73.4/71.2/
   64.6% by quintile). The top quintile still dips — maxed-out turn terms select
   overheated bounces — and conservative (which selects exactly those rows via
   minScore 55) underperforms balanced (62.9% vs 71.0%). Remaining work: soften the
   7-day-term saturation or rank conservative differently.
4. Same standing caveats as ever: single rising regime, no historical liquidity, marks
   not executions — and one round of formula-fitting on a subsample of this same
   archive (mitigated by the full-grid confirmation, the coarse round-number weights,
   and the live shadow, which now runs v2.1 and provides the true out-of-sample test).

## Run `full-v22` — 2026-09-02 (challenger: calibration sweeps → v2.2)

Sweeps on an extended feature dump (`features-s3000b`: +change90, +winsor-variant
distances) settled the open items: a **hump-shaped weekly term** (peak reward ≈ +3%,
decaying for overheated bounces) replaces the linear cap; gates harden to buy week ≥
+0.5% and sell ≥0.8% off the high with week ≤ −0.5%; breadth weight rises to ×.35; a
small change90 trend-context term joins both sides; winsor stays q10/90 (q15/85 gained
only ~0.3pp); the **P4 cohort dampener is removed** — its sign inverted under
turn-confirmation gates (dampened rows hit 79% vs 70%: co-moving with a recovering
cohort is strength, which breadth already rewards); minScores become per-side, at the
75th/45th/15th calibrated score percentiles. Confirming full run, v2.1 → v2.2
(balanced, $5 floor):

| | n | med fwd30 | hit | top-20 precision |
|---|---:|---:|---:|---:|
| buy | 59,115 → 24,110 | +2.79% → **+3.45%** | 71.0% → **73.3%** | 60.7% → **70.5%** |
| sell | 19,156 → 12,095 | 0.00% → **−0.23%** | 47.5% → **51.0%** | 50.6% → **52.1%** |

### Findings

1. **Score calibration is finally monotone** — hit 72.1% → 74.3% AND median fwd30
   +2.73% → +4.55% rising by quintile. The hump term did exactly what the sweep
   promised: overheated bounces no longer crowd the top.
2. **Top-20 buy precision (70.5% balanced, 75.8% aggressive) now clearly beats every
   baseline** including cohort-median (66.4%) — the last baseline gap is closed.
3. **Sells now have negative median drift at every strictness** (conservative −1.23%,
   54.6% hit, 53.7% top-20) — the model's sells precede actual declines in a market
   that mostly rises.
4. Strictness ordering: conservative ≈ balanced on top-20 (71.0 vs 70.5) with the flat
   top-of-scale expected from monotone quintiles; the inversion is gone.
5. Caveats unchanged (single regime, marks not fills, two fit-confirm rounds on this
   archive). The live shadow — which now runs v2.2 — and the cross-market extension
   database (JP chase rarities + MTG mythics/day-one rares, in build) are the
   remaining independent checks before promotion.

## Run `ext-v22` — 2026-09-02 (cross-market generalization: JP Pokémon + Magic)

New local-only validation universe (`max-ext.sqlite`, `scripts/local-db/build-ext-db.mjs`):
18,828 products / 21.98M observations from the cached archives — Japanese Pokémon
chase rarities (2,844: SAR/AR/SR/UR/HR/CHR/CSR + vintage specials) and Magic (15,984:
all Mythics + Rares that were ≥$5 on the FIRST archive day, a pre-window cut with no
survivorship bias). v2.2 was calibrated entirely on English Pokémon/Riftbound/OP —
these markets are pure out-of-domain. Same grid, same $5 floor (balanced):

| | n | med fwd30 | hit | top-20 | best baseline (this universe) |
|---|---:|---:|---:|---:|---:|
| buy | 17,642 | +2.46% | **69.2%** | **66.8%** | cohort-median 63.3% |
| sell | 18,649 | **−1.78%** | **59.8%** | **61.1%** | random 37.8% |

### Findings

1. **The turn-confirmation edge generalizes.** Buy hit 69.2% (home: 73.3%) against a
   weaker universe base rate; sells actually IMPROVE out-of-domain (59.8% vs 51.0%,
   median −1.78%) — MTG's rotation-driven declines give confirmed roll-overs more to
   catch. Every strictness beats every baseline on both sides.
2. **The baselines collapse where the model doesn't**: momentum-loser chasing — the
   strongest simple strategy in English Pokémon (62%) — hits only 38.6% here, and
   near-extreme buying 23.9%. The model's mechanism survives a market where the
   simple heuristics die, which is the strongest evidence yet that it is mechanism,
   not archive artifact.
3. Calibration holds out-of-domain (67.9→70.0% hit, +2.06→+3.14% median by quintile),
   slightly flatter than at home — expected without refitting.
4. Caveat: same time window and broadly the same macro backdrop as the home archive;
   the segments are new but the era is not. The live shadow remains the only test of a
   different regime.

## Program summary — v1 → v2 (P1–P5 complete, 2026-09-02)

All runs on the identical grid (16,982 products × 117 weekly origins, $5 floor).
Final challenger v2 = winsorized q10/q90 extremes + breakout sell gate + cohort
dampener + breadth qualifier (+ sales bump, shadow-only). Champion v1 unchanged.

| balanced | v1 | final v2 |
|---|---:|---:|
| buy hit | 56.7% | **60.1%** |
| buy median fwd30 | +0.72% | **+1.12%** |
| buy top-20 precision | 52.0% | 51.8% |
| sell hit | 19.7% | **22.1%** |
| sell top-20 precision | 18.2% | **32.2%** |
| adverse drift after "sell" (med fwd30) | +1.50% | **+1.21%** |
| calibration top quintile hit | 49.8% | 53.7% |

Conservative buys 48.1% → 51.3%, aggressive 62.1% → 64.8%. Unbacktestable additions
(sales bump; live liquidity gating) validate through the P1b shadow — promotion
requires ~30 days of shadow overlap on top of this harness verdict. Open items for a
future v3: score calibration is still not monotone (proximity remains over-weighted at
the top of the scale), and a cohort-laggard term could chase the cohort-median
baseline's 66% buy hit — both need either multi-regime data or the live shadow to
calibrate without overfitting this rising-market archive.
