# Signal model — known gaps, accepted limits, and review calendar

Companion to `docs/backtests.md` (evidence) and `docs/todo.md` §P (plan of record).
Status as of 2026-09-02: champion v1 serving; challenger v2.2 in the live shadow.
This file is the honest register of what the model does NOT know, what we have decided
to accept, and when each open item gets re-examined.

## Gaps (ordered by potential damage)

1. **Single-regime training.** All backtest evidence comes from one broadly rising
   market (Feb 2024 →). Turn confirmation has a specific bear-market failure mode:
   most bounces in a downtrend are dead-cat bounces, so the buy gate's "confirmed
   bounce" will admit more losers. Unmeasurable until the live shadow crosses a real
   downturn. *Mitigation: shadow + the monthly review calendar below; regime labels
   already classify Falling and can be watched as an aggregate.*
2. **Marks, not money.** Returns are TCGplayer market-price marks. Selling pays
   ~10–15% in fees/shipping and thin cards carry wide spreads; a +3.45% median mark
   gain is not a net trading profit claim. *Mitigation path: realized-sale range
   columns now persist (P5); an execution-aware evaluation is future work.*
3. **Event blindness.** Price-only inputs: reprint announcements, rotation, bans,
   tournament results, and supply drops are invisible. A roll-over caused by a reprint
   is a structural repricing, not overextension. *Partial future answer: the Riftbound
   tournament feature below; Pokémon stays collector-driven by design.*
4. **Liquidity is unbacktestable.** Archives carry no sales; every historical run used
   a $5 floor as proxy. The live liquidity floor and the ≥20-sales confidence bump are
   shadow-validated guesses until ~90 days of production sales history accrues
   (columns filling since 2026-09-02).
5. **Survivorship at the harness edge.** Forward returns need a future observation;
   cards that crash and stop trading drop out of evaluation instead of counting as
   losses. Inflates results by an unmeasured (likely small at the $5 floor) amount.
6. **New releases get no signal.** Turn confirmation needs 30–90 days of history, so
   the most-traded segment — fresh sets — is silent. *Being fixed: §"New-release
   predictions" below (todo P7), targeted ahead of Pokémon's Delta Reign release.*
7. **Confidence measures quantity, not quality.** Dense stale marks score like dense
   real trading; thin-card mark drift passes through.
8. **Fixed 30-day lens.** Optimized solely for 30-day forward returns — the chosen
   priority. 90-day / 1-year model plans are documented below but deliberately queued
   behind the 30-day goal.
9. **Board-level concentration is unmanaged.** Signals are judged one card at a time;
   nothing stops the top of a board from being 20 highly-correlated cards (one hot
   set, one rarity wave). Per-signal precision can be excellent while the board as a
   *portfolio* carries one concentrated bet: a set-level reversal flips many picks at
   once, so realized board-level outcomes are lumpier than per-signal hit rates
   suggest. The cohort dampener's removal (v2.2) slightly increases this tendency —
   cohort-wide recoveries now score well by design. *Not addressed in scoring;
   candidate answers: a board-composition cap (max N per set/cohort), a diversity-aware
   display grouping, or simply surfacing "n of top 20 from one set" as context.*
10. **Residual archive overfit.** Two fit-confirm rounds on one archive; the
    cross-market run added new segments but the same era. Governed by the refit policy
    below — NOT by ad-hoc monthly refitting (see policy rationale).

## Accepted limitations (documented, not planned for fixing)

- **Strategic buyouts / market manipulation.** A coordinated buyout produces a real
  price move that is indistinguishable, in price data, from organic demand until it
  unwinds. No credible prediction is possible from our inputs; the spike regime label
  and the sales-backing note are the only guardrails. Accepted per user decision
  2026-09-02: signals may be wrong around manipulated moves, and that is okay —
  the site's framing ("informational qualification checks, not guarantees") carries
  the disclaimer.
- **Pokémon is collector-driven; play data is out of scope for it.** Tournament-based
  features apply to Riftbound (below), not Pokémon.

## Future feature: Riftbound tournament-driven predictions (separate feature)

Riftbound's market is substantially player-driven: competitive viability moves card
prices in ways collector dynamics do not. Planned as a SEPARATE feature from the
price-signal model (different inputs, different failure modes, different UI):

- Ingest tournament results (winning decklists, top-cut appearance rates) from
  whatever structured sources exist as the competitive scene matures.
- Features: appearance/win-rate deltas week-over-week per card; new-archetype
  detection (a card jumping from 0 to N decklists).
- Predictions: "tournament momentum" flags on Riftbound cards, initially descriptive
  (like regime chips), harness-validated against forward returns before any scoring
  weight (same gated-middle-model discipline).
- Explicitly NOT applied to Pokémon.
- Prerequisites: a usable results source, card-name→productId mapping, and enough
  history to validate. Unscheduled; revisit at the 3-month review.

## New-release predictions (todo P7) — prepare before Delta Reign

Goal: give fresh cards (and the set page) useful expectations from day one, when the
turn-confirmation model is rightly silent. Three parts, in order:

1. **Release-curve priors (backtestable NOW).** Study every set released inside the
   archive window: median price path by rarity for days 0→90 after release (launch
   premium, supply-absorption decay depth/length, stabilization point). Output:
   per-game per-rarity decay curves. These become displayed guidance ("new releases
   of this rarity typically settle X% below week-one prices within Y weeks").
2. **Early Value Estimate (EVE).** Anchor a new card's expected settled price on its
   ladder cohort median (game|set-siblings-of-era|rarity → game|rarity), the research
   Phase-4 design: the Overnumbered cohort clusters regardless of pull rates, so the
   cohort median is the anchor; display as an expected range (25th–75th band) next to
   presale/launch prices, labeled over/under. Validation: retrospective — for sets
   released mid-archive, does EVE at day 0 predict the day-60 price better than the
   day-0 price itself does?
3. **New-release regime label.** Cards under ~30 days old get a "New release" chip
   (suppressing Falling/Overextended labels that merely describe normal
   supply-absorption decay) with the curve-based guidance attached.

Delta Reign readiness checklist: era mapping covers the new set on release; catalog
pickup is automatic via the daily walk; EVE + release curves shipped and validated
retrospectively BEFORE launch; day-0 monitoring of EVE vs actual added to the first
monthly review after release.

## Longer horizons: 90-day and 1-year models (documented, queued behind 30-day)

The 30-day market remains the strategic priority. Steps when a longer horizon is
taken up:

1. **Data:** the harness already computes fwd90; add fwd365 to pass A and the feature
   dump. 1-year outcomes only exist for origins ≥ 365+tolerance days before the
   archive edge (~65 weekly origins today) — thin, and growing ~4/month.
2. **Refit per horizon, don't reuse:** re-run the feature deciles against fwd90/fwd365.
   Expect different physics: short-term turn confirmation should fade; trend context
   (change90), cohort/era membership, drawdown depth, and value-style terms likely
   dominate. Gates and scores get fitted per horizon with the same sweep protocol.
3. **Independence discipline:** 1-year forward windows overlap ~52× across weekly
   origins — naive aggregation wildly overstates confidence. Use block-spaced origins
   (non-overlapping or near-independent windows) for judgement; report effective N.
   Honest expectation: with a 2.5-year archive, a 1-year model is directional research
   only (~2 independent periods) until more archive accrues; 90-day is fittable now
   (~10 independent periods per series).
4. **Product surface:** a separate "Long Hold" lens (or horizon toggle) rather than
   mixing horizons in one score; separate shadow track before serving.

## Review calendar — evaluate monthly, refit on evidence

**Standing monthly review (first week of each month):**
- Shadow scoreboard (`npm run shadow:scoreboard` on a fresh backup): champion vs
  challenger forward returns, overlap days, exclusive-picks split.
- Live-vs-backtest drift: rolling 30-day hit rate of served signals vs the backtest
  expectation band.
- Regime mix: share of Falling/Overextended labels vs the archive baseline (~10%/41%)
  — an early regime-change tripwire.
- Data health: sales columns fill rate, cohort_stats coverage, ingestion completeness.

**Month 1 (early Oct 2026):** first 30-day shadow verdict → v2.2 promotion decision
(promotion = harness verdict + shadow agreement, per P1b; after promotion v1 becomes
the reverse shadow). First ~30 days of real sales data: sanity-check the ≥20-sales
bump and the 5/30D floor. If Delta Reign has launched: EVE vs actual day-0/30 check.

**Month 2 (Nov 2026):** promoted-model live metrics vs backtest expectations; 90-day
horizon feature study (fwd90 deciles) if capacity allows; second sales-data checkpoint.

**Month 3 (Dec 2026):** ~90 days of sales history → empirically recalibrate the
liquidity floor and sales bump (their first real measurement); first quarterly
walk-forward re-run on the extended archive (append-only: new months added, same
protocol); revisit Riftbound tournament feature feasibility.

**Quarterly thereafter:** walk-forward re-run on the extended archive; threshold
re-tuning ONLY if triggers fire (below); annual: reassess 1-year model viability as
independent windows accumulate.

**Refit triggers (any of these justifies an out-of-cycle recalibration):**
- Live rolling hit rate falls below the backtest expectation band for 4+ weeks.
- A baseline (cohort-median, momentum, random) beats the served model on the live
  scoreboard.
- Regime mix shifts materially (e.g., Falling share doubles) — then refit ON the new
  regime's data rather than continuing to average it away.

**Why not refit monthly (decision + rationale, 2026-09-02):** monthly refitting was
considered and rejected as the default cadence:
1. It breaks the promotion protocol — champion/challenger needs a FROZEN challenger
   for ~30 days of shadow; a monthly-moving target never accrues a clean comparison.
2. One month adds ~4 weekly origins (~3% more data) — refits at that cadence mostly
   chase noise and churn the boards without information.
3. Every refit re-reads the same archive: repeated tuning inflates apparent backtest
   performance (data snooping) and makes the published numbers less meaningful.
4. Regime whiplash: monthly refits during a bull market bake bull assumptions in
   deepest exactly at the turn. Trigger-based refits on regime shift adapt WHEN
   something changed rather than perpetually to the recent past.
5. Track-record integrity: `signal_history` must stay interpretable; each promotion
   should stamp a model version (TODO: add a version marker at the next promotion) so
   the public record never silently mixes models.
So: **evaluate monthly, always; refit quarterly or on triggers, with a frozen shadow
window around every candidate.**
