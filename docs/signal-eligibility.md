# Hot Buy and Hot Sell eligibility

Hot Buy and Hot Sell are qualification views, not alternate catalog feeds. A card can be
present on the Leaderboard and absent from a signal view for a coverage reason or a
qualification reason. `core/signal-utils.ts` (`evaluateMarketSignal`) is the single
implementation behind the boards, the detail signal panel, the batch writer, and the
walk-forward backtest harness; every surface passes the same `SignalContext`
(liquidity, demand trend, model variant — absent fields are neutral).

## Qualification checks (production model, v1)

An evaluated item is omitted when any of these checks fails, in order. Each failure
carries a user-visible reason (shown on the detail page's signal panel):

1. **Current price unavailable** (`missing-current-price`). Signals require a positive
   current market value.
2. **Insufficient liquidity** (`insufficient-liquidity`). Boards require at least 5
   completed sales in 30 days AND 1 in the last 7 (`LIQUIDITY_FLOOR`). Unknown counts
   pass — absence of data is not proof of illiquidity. The detail panel applies the
   same floor from its history fetch's sale buckets (P2 fix), so a thin-market card
   cannot look qualifying on its own page.
3. **Insufficient history** (`insufficient-history`). At least two usable positive
   observations are needed to identify a low or high.
4. **Awaiting stabilization** (`awaiting-stabilization`, Hot Buy only). A price sitting
   on its running low with no bounce (distance < 0.5%), or down more than 5% on the
   week, is a falling knife — buys wait for bounce evidence.
5. **Outside the adaptive cutoff** (`outside-adaptive-cutoff`). The current price is too
   far from the nearest 30-day, 90-day, or historic extreme. The cutoff widens with
   robust volatility (q10–q90 range) and is capped by the strictness preset.
6. **Score below the strictness minimum** (`below-minimum-score`). Proximity to the
   extreme, the swing from the opposite extreme, and history confidence form the score;
   Conservative demands more than Balanced, which demands more than Aggressive.
7. **Normal user filters.** Market, rarity, set, price, movement, and regime filters
   apply before signal qualification.

Low-confidence history is not automatically excluded; it receives less confidence
weight but can still qualify.

## Regime labels (descriptive)

Every product with usable history carries a market-regime label — Falling, Improving,
Breakout, Overextended, Spike, or Steady — classified by `core/domain/regime.ts` from
momentum, weekly/monthly change, drawdown, and (when sale buckets exist) the demand
trend. Labels appear as chips on board signal cells, row history popovers, and the
detail page, and are filterable (URL param `regime=`). They are context, never
recommendations, and do not change v1 qualification.

## Champion / challenger (v2)

A challenger model (`SignalContext.model: "v2"`) exists behind the same evaluator and
does NOT serve production until it earns promotion via the walk-forward harness plus a
live shadow comparison (todo §P, P1b):

- **Robust percentile extremes** — window extremes are winsorized 10th/90th
  percentiles, so one anomalous daily mark cannot define "the low"; reasons read
  "typical low/high".
- **Breakout sell gate** (`breakout-continuation`) — a price accelerating through its
  high is a breakout in progress, not overextension; v2 sells wait for momentum to
  fade, mirroring the buy side's stabilization gate.

Backtest evidence for both lives in [docs/backtests.md](backtests.md).

## Transitional coverage (fallback path)

When persisted signals are not yet published (fresh database, or before the
`history-signals` marker), the browser evaluates a bounded fallback: at most 400
candidates, allocated proportionally across the selected rarities or product types and
sampled evenly through each group's price order, with the interface disclosing the
evaluated-candidate count. Production has served complete persisted coverage since
2026-08-28; the fallback remains for fresh environments and outages.

## Important interpretation

A card that fails qualification is not a recommendation in the opposite direction; it
only means the available data does not meet the current side and strictness rules.
