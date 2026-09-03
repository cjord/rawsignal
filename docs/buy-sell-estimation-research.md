# Buy and sell estimation research

## Scope

This document contains the complete research thread beginning with the following product question:

> Perform research on methods of calculating good estimates for when to buy and sell certain cards. Data points we might want to consider: current price, high sale price, 7-day, 30-day, and 90-day trends, comparisons with other cards of similar rarity, comparison with other cards from the same set, the price of the sealed product that the card is opened from, and the overall market trend.

It incorporates the subsequent findings about:

- market-price semantics and unavailable transaction metrics;
- robust historical-price analysis;
- trend regimes, peer comparisons, and market indexes;
- pull-rate rarity and expected acquisition cost;
- same-character comparisons and aggressive lifecycle tapering;
- set-size and pack-slot dilution;
- the observed Riftbound Overnumbered price distribution;
- Cohort Value, Early Value Estimate, and Rarity Market Index features; and
- the validation required before presenting predictive estimates.

This is a research and implementation-planning document. It does not authorize application changes and does not describe guaranteed profit or financial advice.

> **Baseline revision — 2026-09-01.** This document was originally written before the
> TCGplayer completed-sales integration, the peer-context/index features, and the M-series
> history work landed in Raw Signal. Sections whose factual premises changed are annotated
> inline with **Status (2026-09-01)** notes; §15 analyzes the findings against the current
> baseline as concrete Hot Buy / Hot Sell improvement candidates.

## Executive conclusions

1. **Do not attempt to predict one objectively correct buy or sell date.** Calculate a transparent opportunity score, a separate confidence assessment, evidence for the classification, and eventually a historically calibrated probability of a defined forward outcome.
2. **TCGplayer Market Price is the best current-price anchor available through the existing data path.** It is derived from recent completed transactions, but it is still an estimate rather than an executable bid or offer.
3. **Listing high is not a high sale price.** TCGCSV low, median, and high fields are listing-derived. Listing high can be distorted by parked listings and must not be used as a sell target.
4. **Use robust percentiles and median absolute deviation.** Absolute historical minima, maxima, and simple standard deviations are too sensitive to collectible-market outliers.
5. **Price position and trend regime must be separated.** A new low with an accelerating decline is a Falling/Watch state, not automatically a Hot Buy. A new high with accelerating momentum is a Breakout state, not automatically a Hot Sell.
6. **Relative movement is more useful than raw price comparison.** Compare a card with set, rarity, game, character, and sealed indexes through relative returns and historical ratios.
7. **Effective pull rarity is more informative than printed rarity.** Specific-card probability, eligible cards per slot, packs per expected hit, and acquisition cost better describe structural scarcity.
8. **Sealed prices and card prices are endogenous.** Pull cost, sealed price, set value, and chase-card concentration can describe overlapping effects and must not be double-counted.
9. **Same-character cards are a new-card prior.** Their influence should begin around 20–25% with no reliable target history and taper toward 0–3% after 30–60 reliable observations.
10. **Riftbound Overnumbered cards exhibit a real price cohort near $100.** In the current 91-card snapshot, the median is $97.61 and 73.6% fall between $50 and $150. This is a cohort center, not a price floor.
11. **The safest first features are descriptive.** Implement market indexes and Cohort Position before adding cohort deviation to Hot Buy/Hot Sell scores or publishing predictive Early Value Estimates.
12. **Every model must beat simple baselines out of sample.** For Riftbound Overnumbered estimates, the advanced model should be compared directly with a flat $100 or current cohort-median baseline.

---

## 1. Source semantics and limitations

### 1.1 Current price

TCGplayer describes Market Price as an estimate based on recent completed transactions across its marketplace. It incorporates prices at which products have sold and is designed to reduce the effect of outliers that can distort listing-based low, median, and high values.

Use Market Price as the principal current-price anchor, subject to:

- exact product and printing matching;
- condition consistency;
- source freshness;
- sufficient sales behind the upstream calculation; and
- explicit `N/A` behavior when unavailable.

Market Price is not a guaranteed purchase or liquidation price.

Source: [TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price)

### 1.2 High sale price versus listing high

TCGCSV exposes market, listing low, listed median, and listing high price records. These do not provide a verified high sale price.

TCGplayer notes that listed prices can remain far above prices that actually clear the market. A newly listed copy near Market Price may sell quickly, leaving only unrealistic high listings visible.

Rules:

- Do not label listing high as sale high.
- Do not score listing high as an upside target.
- Do not substitute the maximum visible listing for a completed transaction.
- Individual completed sales are now available (see §1.4). Use their median and 90th/95th percentiles rather than a raw maximum; wiring realized-sale percentiles into scoring is still pending (§15.4).
- Keep listing high as secondary descriptive data with a warning about distortion.

Source: [TCGplayer price-point definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)

### 1.3 TCGCSV history

TCGCSV maintains daily archived price observations from February 8, 2024 onward. These are suitable for dated 7-, 30-, and 90-day market-price calculations.

They do not provide complete transaction-level volume, liquidity, bid/ask depth, or sale-frequency measurements.

Sources:

- [TCGCSV FAQ](https://tcgcsv.com/faq)
- [TCGCSV documentation](https://tcgcsv.com/docs)

### 1.4 Metric availability

**Status (2026-09-01):** the original research treated all transaction metrics as
unavailable. Raw Signal has since integrated TCGplayer completed-sales history
(three-day buckets over the trailing 90 days, merged quarterly and annual series).
Now available and shipped on detail pages:

- units sold (30-/90-day quantities with transaction counts);
- sale frequency (sales per week);
- transaction velocity (bucketed completed-sale counts over time);
- realized sale-price ranges, including shipping-inclusive ("delivered") figures; and
- liquidity gating — Hot Buy/Hot Sell boards require 5 sales/30D and 1 sale/7D
  (`LIQUIDITY_FLOOR` in `core/signal-utils.ts`; unknown counts pass).

Still unavailable and must not be claimed:

- sales rank;
- most-frequently-sold cards; and
- bid/ask depth.

The number of dated price observations is still not transaction volume; only the
completed-sales series is.

---

## 2. Assessment of the current Raw Signal model

The current implementation in `core/signal-utils.ts` (moved from `app/signal-utils.ts`):

- identifies the nearest 30-day, 90-day, or historic low/high;
- measures current-price distance from that extreme;
- estimates recent volatility from robust 30-/90-day price ranges;
- widens the qualifying cutoff for more volatile cards;
- scores proximity, swing from the opposite extreme, and history confidence;
- applies Conservative, Balanced, and Aggressive thresholds (selected in display settings);
- **(added 2026-08)** requires stabilization/bounce evidence on the buy side — an
  accelerating decline returns an `awaiting-stabilization` exclusion instead of a Hot Buy; and
- **(added 2026-08)** enforces the completed-sales liquidity floor (§1.4) with an
  `insufficient-liquidity` exclusion and explanatory detail.

### Existing strengths

- Symmetric and understandable.
- Adaptive cutoffs instead of one universal percentage.
- Explicit evidence and exclusion reasons.
- Separate confidence levels.
- Handles incomplete history without silently inventing values.

### Existing limitations

1. Absolute minima and maxima can be determined by one unusual daily observation. *(Open.)*
2. The nearest of 30-day, 90-day, or historic extrema can dominate without sufficient consideration of window quality. *(Open.)*
3. ~~A falling card can qualify near a low without evidence that the decline is stabilizing.~~ **Resolved 2026-08:** buy signals require a bounce or flattening; falling knives are excluded with an `awaiting-stabilization` reason.
4. A rising card can qualify near a high without distinguishing overextension from breakout continuation. *(Open — the sell side still has no Breakout state; the strongest remaining asymmetry gap.)*
5. Set, rarity, character, sealed-product, and overall-market context are absent. **Partially resolved 2026-08:** peer cohorts (game|set|rarity daily averages with quartiles and rank), per-set and per-game indexes with an S&P 500 benchmark, sealed indexes, and market breadth all ship on detail/metrics surfaces — but none of them feed the signal score yet. Character context remains absent.
6. Buy and sell logic is nearly symmetric even though upside breakouts and downside declines behave differently. *(Partially open: the buy side gained the stabilization gate; the sell side is unchanged.)*
7. History confidence is largely observation-count based and does not fully describe freshness, cadence, exact printing coverage, or gaps. *(Open.)*
8. Weights and thresholds are research heuristics rather than out-of-sample calibrated parameters. *(Open — but now testable; see §15.6.)*
9. Transaction costs, spread, shipping, and actual execution are not incorporated in scoring. *(Open — scalper mode models fees/tax/shipping for sealed scenarios, but signals ignore them.)*

---

## 3. Recommended estimation architecture

The recommended architecture has seven layers:

1. Data-quality eligibility.
2. Robust historical position.
3. Trend and regime classification.
4. Relative value against appropriate cohorts.
5. Pull rarity and sealed/set fundamentals.
6. Explainable opportunity score plus confidence.
7. Walk-forward calibration against future outcomes.

### 3.1 Data-quality eligibility

Before scoring, evaluate:

- exact product ID and printing match;
- matching condition and language where available;
- current-price freshness;
- distinct dated observations;
- 30-/90-day coverage ratio;
- age of the earliest observation;
- unexplained gaps;
- suspicious discontinuities or matching errors; and
- current/history printing consistency.

Suggested confidence states:

| Confidence | Suggested requirements |
| --- | --- |
| High | Exact match, fresh price, dense 90-day coverage, sufficient observations |
| Medium | Exact match with shorter or less frequent history |
| Low | Fallback match, sparse history, or inferred supporting inputs |
| Unavailable | Insufficient trustworthy current price or history |

Confidence must remain separate from the buy/sell score. A strong-looking signal based on weak evidence should remain visibly low confidence.

### 3.2 Robust historical position

Use a winsorized or percentile-based window instead of raw extremes.

For the 90-day window:

```text
Robust range position =
(current log price − 5th percentile log price)
÷
(95th percentile log price − 5th percentile log price)
```

Interpretation:

- 0%: near the robust 90-day low.
- 50%: near the middle of the robust range.
- 100%: near the robust 90-day high.

Continue displaying actual historic low/high as secondary facts, but do not let one extreme observation determine scoring.

### 3.3 Robust volatility

Use daily log returns and median absolute deviation:

```text
Robust volatility = 1.4826 × MAD(daily log returns)
```

NIST describes median absolute deviation and interquartile range as more stable than standard deviation when distributions have extreme tails.

Source: [NIST measures of scale](https://itl.nist.gov/div898/handbook/eda/section3/eda356.htm)

### 3.4 Trend features

Calculate:

- 7-day log return;
- 30-day log return;
- 90-day log return;
- robust 30-day slope;
- robust 90-day slope;
- short-versus-long slope acceleration;
- drawdown from the robust 90-day high;
- recovery from the most recent low;
- percentage of positive observation-to-observation changes; and
- relative return versus cohort indexes.

A Theil–Sen or similarly robust slope is preferable to ordinary linear regression because collectible-price history can contain discontinuities and heavy-tailed observations.

### 3.5 Regime classification

Price position alone cannot determine the action state.

| Position | Trend | Recommended state |
| --- | --- | --- |
| Near low | Decline slowing, flattening, or reversing | Hot Buy candidate |
| Near low | Decline accelerating | Falling — Watch |
| Middle | Positive relative trend | Improving |
| Near high | Momentum weakening | Hot Sell candidate |
| Near high | Momentum accelerating with broad support | Breakout |
| Near high | One-day jump without broad support | Spike/Low confidence |

The distinction between Hot Sell and Breakout is especially important. A new high is not by itself evidence that the price should mean-revert.

---

## 4. Peer, set, and market comparisons

### 4.1 Why raw peer prices are insufficient

Cards in the same printed rarity can have different:

- pull probabilities;
- character demand;
- artwork and treatment appeal;
- playability;
- release age;
- set popularity;
- print quantities; and
- supply stage.

Do not assert that every card in a rarity should have the same price.

### 4.2 Relative return

Use relative movement:

```text
Relative 30-day return =
target 30-day log return
− median 30-day log return of peers
```

Suggested cohort fallback order:

1. Same game, set, effective pull tier, and printing.
2. Same game, set, and printed rarity.
3. Same game, rarity, and release era.
4. Same game and rarity.

Require a minimum cohort size, such as eight cards, before publishing the comparison.

### 4.3 Historical card-to-peer ratio

```text
Relative ratio = target price ÷ peer index
```

Score the target’s current ratio against its own ratio history. This controls for a character that has always traded at a premium or discount.

### 4.4 Market indexes

Create separate indexes for:

- game;
- Singles versus Sealed;
- set;
- rarity/pull tier;
- sealed-product type; and
- character where enough comparable cards exist.

Use a robust median constituent return:

```text
Index return = exp(median constituent log return) − 1
```

Do not use a price-weighted index; a few very expensive chase cards would dominate it.

### 4.5 Market breadth

```text
Breadth =
eligible cards with a positive period return
÷ all eligible cards
```

Useful context:

- target falling while its set rises;
- target rising while its rarity cohort falls;
- set outperforming its overall game;
- a small premium tail driving the apparent index;
- Singles weakening while related Sealed strengthens.

Pokémon and Riftbound require separate indexes.

---

## 5. Preliminary opportunity scores

These are research starting points, not validated production weights.

### Hot Buy

| Component | Starting weight |
| --- | ---: |
| Robust proximity to 30-/90-day low | 30% |
| Volatility-adjusted deviation from own center | 20% |
| Underperformance versus peers | 15% |
| Stabilization or positive reversal evidence | 15% |
| Set and overall-market context | 10% |
| Data quality/confidence | 10% |

### Hot Sell

| Component | Starting weight |
| --- | ---: |
| Robust proximity to 30-/90-day high | 30% |
| Volatility-adjusted overextension | 20% |
| Outperformance versus peers | 15% |
| Weakening momentum after a run-up | 15% |
| Set and overall-market weakness | 10% |
| Data quality/confidence | 10% |

Supply, reprint, rotation, and release events should be explicit modifiers rather than hidden inside price momentum.

---

## 6. Pull rarity

### 6.1 Printed rarity versus effective pull rarity

Printed rarity is a useful category label but a weak standalone scarcity measure.

Specific-card pull odds depend on:

- probability of reaching the relevant pack slot;
- number of cards eligible for that slot;
- equal or unequal sheet weighting;
- multiple possible upgrade slots;
- box and case collation;
- set size;
- language/region; and
- print-run changes.

TCGplayer’s Scarlet & Violet study opened more than 8,000 packs. Illustration Rares appeared approximately once per 13 packs as a category, but a specific Illustration Rare appeared approximately once per 313 packs. A specific Special Illustration Rare appeared approximately once per 318 packs. The two printed rarities therefore had nearly the same specific-card acquisition difficulty in that set.

Source: [TCGplayer Scarlet & Violet pull rates](https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Scarlet-Violet-Pull-Rates/a7702fce-dd64-4a58-beb1-0f871c853215/)

### 6.2 Recommended terminology

- **Printed rarity:** source/catalog label.
- **Pull rarity:** effective scarcity of the target card.
- **Per-pack probability:** probability of the specific card in one pack.
- **Packs per hit:** inverse probability.
- **Acquisition probability:** chance of one or more copies after `n` packs.
- **Gross pull cost:** sealed cost per expected copy before other contents.
- **Net pull cost:** expected cost after realizable value of other contents.
- **Pull-adjusted value:** target price relative to acquisition difficulty and peers.

### 6.3 Core probability calculations

For per-pack probability `q`:

```text
Expected packs per copy = 1 ÷ q
```

For sealed product price `S` and `N` packs:

```text
Cost per pack = S ÷ N
```

```text
Gross expected pull cost = cost per pack ÷ q
```

Probability of at least one copy after `n` packs:

```text
P(at least one) = 1 − (1 − q)^n
```

Display:

- 1-in-X specific-card odds;
- expected packs and boxes;
- packs for a 50% chance;
- packs for a 90% chance;
- gross pull cost at MSRP; and
- gross pull cost at current sealed market price.

Expected pull cost is not fair value because the buyer also receives all other contents.

### 6.4 Net expected pull cost

```text
Net expected pull cost =
(cost per pack − net EV of other contents per pack)
÷ target pull probability
```

Net EV must account for:

- marketplace fees;
- shipping;
- condition and printing;
- cards too inexpensive to sell economically;
- expected value from every other slot; and
- pull-rate uncertainty.

TCGplayer uses the general combination of card Market Prices and observed pull rates when estimating booster-box expected value.

Source: [TCGplayer Evolving Skies booster-box EV](https://www.tcgplayer.com/content/article/What-s-the-Expected-Value-of-an-Evolving-Skies-Booster-Box/53b35b2e-a243-47e2-b8af-8bf516e827ed)

### 6.5 Sealed-price relationship and double counting

The relationship is bidirectional:

```text
Scarce/desirable chase card
→ higher demand to open the set
→ higher sealed demand
→ higher sealed market price
→ higher market cost to pull the chase card
```

Avoid independently applying full weight to:

- sealed price;
- gross pull cost;
- top-card value;
- total set value; and
- chase-value concentration.

Research on sealed trading-card products found that set value, top-card value, age, and original retail price explain substantial variation in sealed box prices. A probabilistic sealed/opened valuation framework further emphasizes transaction costs, variance, and liquidity.

Sources:

- [Sealed collectible-card product research](https://www.igbr.org/wp-content/Journals/2023/GJAF_Vol_7_No_1_2023.pdf)
- [Sealed-product valuation framework](https://papers.ssrn.com/sol3/Delivery.cfm/6429278.pdf?abstractid=6429278&mirid=1)

### 6.6 Pull-rate source hierarchy

1. Official publisher-specific probability.
2. Official pack-slot distribution.
3. Large documented opening study.
4. Auditable community data with pack count and hit count.
5. Inference from rarity-slot probability and eligible-card pool.

Every stored rate should include:

- game and set;
- product and pack type;
- language and region;
- target card or rarity pool;
- packs opened and hits observed;
- probability and interval;
- measured or inferred status;
- source and observation date; and
- collation qualifications.

Riftbound has documented pack-distribution and collation changes. Do not generalize one set or print run to all Riftbound products.

Sources:

- [Riftbound Unleashed pack distribution](https://playriftbound.com/en-us/news/announcements/the-unleashed-overview/)
- [Riftbound Origins launch learnings](https://playriftbound.com/en-us/news/announcements/riftbound-origins-launch-learnings/)

---

## 7. Set-size and pack-slot dilution

### 7.1 Correct calculation

When the cards in a rarity pool are equally distributed:

```text
Specific-card probability =
rarity-slot probability ÷ eligible-card count
```

Example:

| Set | Eligible target-rarity cards | Target-rarity hit rate | Specific-card odds |
| --- | ---: | ---: | ---: |
| Smaller set | 10 | 1 in 100 packs | 1 in 1,000 packs |
| Larger set | 25 | 1 in 100 packs | 1 in 2,500 packs |

If the target can appear through multiple slots:

```text
Specific-card probability =
sum of target probability from each eligible slot
```

### 7.2 Important distinction

Do not use total set size alone. Use:

- eligible cards in the target’s actual slot;
- slot upgrade rate;
- sheet weighting;
- duplicate eligibility across slots;
- box/case guarantees; and
- regional/language collation.

Total set size is only a fallback proxy.

### 7.3 Pull-adjusted comparable price

```text
Adjusted comparable price =
comparable price
×
(target packs per hit ÷ comparable packs per hit)^β
```

Estimate `β` from historical data. Do not assume a proportional one-to-one relationship between pull difficulty and price.

---

## 8. Same-character comparisons

### 8.1 Purpose

Same-Pokémon or same-champion comparisons provide a **character-demand prior** for a new card. They are not a permanent replacement for the target card’s own history.

Useful similarity dimensions:

1. Same character.
2. Similar pull-difficulty band.
3. Similar artwork/treatment.
4. Same language and region.
5. Similar release era.
6. Similar set size and print status.
7. Similar foil/printing treatment.
8. Similar competitive relevance.

### 8.2 Character premium

```text
Character premium =
actual log price
− expected log price based on pull rarity, set, and treatment
```

Use a weighted median across the strongest comparables. Shrink toward zero when:

- the character has few comparable cards;
- cards come from incompatible eras;
- one extreme chase card dominates;
- the new treatment is less desirable; or
- recent releases may be saturating character demand.

### 8.3 Aggressive lifecycle taper

| Reliable exact observations | Same-character influence |
| --- | ---: |
| None or presale only | 20–25% |
| 7 observations | 10–15% |
| 14 observations | 5–10% |
| 30 observations | 2–5% |
| 60+ observations | 0–3% |

Possible decay:

```text
Character weight =
initial weight × 2^(−effective history days ÷ 10)
```

At an initial 24%, the weight is approximately 12% after 10 effective days, 6% after 20 days, and 3% after 30 days.

Once exact history exists, the target’s observed price already contains its character premium. Continuing to add a large external character factor would double-count it.

### 8.4 Lifecycle model

**Price Discovery — first 7 days**

- Use pull-adjusted peers as the foundation.
- Distinguish presale prices.
- Use low confidence.
- Do not issue normal Hot Buy/Hot Sell labels.

**Early Market — days 8–30**

- Increase own-history weight.
- Taper same-character influence quickly.
- Detect release-supply deflation and stabilization.

**Established Market — approximately 30 reliable observations onward**

- Own history dominates.
- Pull rarity remains a structural feature.
- Character comparisons become explanatory context.

### 8.5 Suggested weight transition

| Component | New card | 30+ observations |
| --- | ---: | ---: |
| Own history | 5% | 50% |
| Pull difficulty | 30% | 15% |
| Same-character comparisons | 20% | 3% |
| Same-set peers | 20% | 12% |
| Artwork/treatment | 10% | 5% |
| Sealed/set market | 10% | 10% |
| Overall market | 5% | 5% |

Research supports a distinct rarity effect and exploratory character “superstar” effects, while also showing highly skewed card prices.

Sources:

- [Demand for Rarity](https://onlinelibrary.wiley.com/doi/10.1111/joie.12262)
- [Pokémon sales-characteristics study](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0334289)

---

## 9. Riftbound Overnumbered quantitative analysis

### 9.1 Dataset and limitations

- Local source: `public/data/overnumbered.json`
- Snapshot date: August 24, 2026
- Priced Riftbound Overnumbered records: 91
- Price field: TCGplayer Market Price from the generated TCGCSV-derived feed

This is a cross-sectional snapshot; its statistics (medians, band shares, set medians, correlations) describe August 24, 2026 and drift daily.

**Status (2026-09-01):** the original limitation — no historical feed versions — no longer holds. Tiered daily history runs now cover the whole catalog (M4/M5), and the TCGCSV daily price archives (back to 2024-02-08) are integrated tooling (the M6 archive backfill has been executed; the local max-profile database holds ~13.5M observations). The longitudinal Overnumbered analysis this section calls for is now feasible and should replace this snapshot before any cohort-based scoring ships.

### 9.2 Overall distribution

| Statistic | Market price |
| --- | ---: |
| Minimum | $41.36 |
| 10th percentile | $54.83 |
| 25th percentile | $66.76 |
| **Median** | **$97.61** |
| 75th percentile | $143.04 |
| 90th percentile | $217.59 |
| Maximum | $658.57 |
| Mean | $125.02 |
| 10% trimmed mean | $106.61 |

Price bands:

| Band | Cards | Share |
| --- | ---: | ---: |
| Below $50 | 3 | 3.3% |
| $50–$75 | 26 | 28.6% |
| $75–$100 | 20 | 22.0% |
| $100–$125 | 16 | 17.6% |
| $125–$150 | 5 | 5.5% |
| $150–$200 | 10 | 11.0% |
| $200 or more | 11 | 12.1% |

Interpretation:

- 39.6% are between $75 and $125.
- 73.6% are between $50 and $150.
- 84.6% are between $50 and $200.
- The long premium tail raises the mean well above the median.
- Approximately $100 is a defensible cohort center, not a guaranteed floor.

The log-price robust MAD corresponds to an approximate multiplicative factor of 1.765. Around the $97.61 median, that produces a broad robust band of roughly $55–$172.

### 9.3 Set distributions

| Set | Cards | Median | 25th percentile | 75th percentile | Mean | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Origins | 12 | $124.96 | $86.62 | $174.16 | $154.85 | $67.46 | $384.31 |
| Spiritforged | 30 | $77.77 | $58.62 | $117.18 | $117.28 | $41.36 | $658.57 |
| Unleashed | 18 | $105.04 | $81.89 | $124.42 | $113.60 | $48.05 | $244.42 |
| Vendetta | 31 | $99.84 | $75.53 | $149.17 | $127.60 | $54.69 | $468.18 |

Across four sets, Overnumbered count and set median had an observed correlation of approximately **−0.84**. This is directionally consistent with larger eligible pools diluting specific-card odds, but four observations cannot establish the relationship. Confounders include release age, sealed price, pull structure, set popularity, character selection, print volume, and initial price discovery.

### 9.4 Character persistence

- Repeated characters: 21.
- Cards in repeated-character groups: 43.
- Cross-set comparable observations: 29.
- Leave-one-out correlation between set-adjusted log prices for the same character across sets: approximately **0.695**.

Examples:

- Ahri: $384.31 and $658.57.
- Teemo: $168.97 and $188.28.
- Diana: $154.64 and $244.42.
- Darius: $41.36 and $67.46.
- Yasuo: $63.24 and $83.22.

Important within-character variation:

- Mel: $85.00 and $224.17 in Vendetta.
- Zed: $65.73 and $188.04 in Vendetta.
- Nasus: $62.42 and $165.21 in Vendetta.

Conclusion: character demand appears persistent enough to support a prior, but artwork, treatment, card identity, and other card-specific qualities still create large deviations.

TCGplayer describes Showcase as a broad variant category that includes Alternate Art, Overnumbered, and Signature cards. Broad Showcase counts cannot substitute for the exact Overnumbered eligible pool and slot probability.

Source: [TCGplayer Riftbound set breakdown](https://seller.tcgplayer.com/blog/discovering-riftbound-league-of-legends-trading-card-game)

---

## 10. Proposed product features

### 10.1 Rarity Market Index

For Riftbound Overnumbered and later other well-defined cohorts, track:

- median market price;
- 25th–75th percentile range;
- 7-, 30-, and 90-day median return;
- market breadth;
- set-specific subindexes;
- premium-tail spread; and
- cohort dispersion.

This identifies whether a price change is card-specific, set-wide, or category-wide.

### 10.2 Cohort Position

Display on card detail pages:

- global rarity median;
- set rarity median;
- 25th–75th percentile band;
- target percentile;
- percentage above/below set center;
- pull-difficulty adjustment;
- character premium;
- comparable count; and
- confidence.

Example:

```text
Overnumbered cohort position
Current: $122
Riftbound median: $98
Set median: $100
Typical set range: $76–$149
Percentile: 62nd
Character premium: +18%
Cohort estimate: $108–$142
```

Use “cohort estimate” or “expected market band,” not “fair value” or “floor.”

**Status (2026-09-01):** largely shipped as the peer-context feature — global and
set-scoped cohort medians by game|set|rarity, quartile band, percentile rank
(“Market rank #N of M”, “Top X% of peers”), the peer-spread IQR gauge,
minimum-cohort gating, and target-excluded-from-its-own-cohort all exist on detail
pages. Character premium and pull-difficulty adjustment remain unbuilt.
**Naming decision (2026-09-01, user):** the shipped “Modeled Fair Value” panel keeps
its name — the terminology rule above is amended to permit it (the panel hedges with
“modeled” and carries an explanation hint). “Floor” remains prohibited, and cohort
surfaces continue to use “cohort estimate” / “expected market band.”

### 10.3 Early Value Estimate

For a target without adequate exact history:

```text
Expected log price =
rarity baseline
+ set adjustment
+ character premium
+ pull-difficulty adjustment
+ sealed-price adjustment
+ artwork/treatment adjustment
```

Example:

```text
Early Value Estimate: $42–$51
Based on 1-in-480 estimated pull difficulty, 14 comparable cards,
and current set pricing. Similar-card influence: 18%.
Price history is still developing.
```

### 10.4 Cohort evidence in Hot Buy/Hot Sell

Potential Hot Buy evidence:

- below the set cohort band;
- persistent premium character temporarily near the set median;
- above-average pull difficulty;
- stabilizing decline; and
- stable/rising set or sealed index.

Potential Hot Sell evidence:

- above the cohort estimate without a persistent character premium;
- substantially outperforming set and rarity indexes;
- weakening momentum; and
- pull difficulty insufficient to explain the premium.

Do not automatically classify every inexpensive Overnumbered as a buy or every expensive one as a sell.

### 10.5 Buy versus open

When reliable pull-rate data exists, detail pages can show:

- card market price;
- gross expected pull cost at MSRP;
- gross expected pull cost at sealed market price;
- net expected pull cost after other contents;
- 50% and 90% acquisition pack counts;
- expected boxes per copy; and
- source/confidence for the pull estimate.

This should remain a comparison tool, not a recommendation to open randomized products.

**Status (2026-09-01):** partially shipped — section-keyed pull rates
(`public/data/pull-rates.json`) threaded through D1 to detail pages (“Pull rate
1 in ~X packs” with cost-in-packs and “community estimate” provenance), plus set
pack EV and EV ratio priced from live pack prices. Not yet built: confidence
intervals, the versioned source-hierarchy contract (§6.6), and the 50%/90%
acquisition-count display.

---

## 11. Validation plan

### 11.1 Walk-forward signal validation

For every historical date:

1. Use only observations available on or before that date.
2. Calculate features and scores.
3. Record 7-, 30-, and 90-day forward market returns.
4. Apply reasonable fees, spread, and shipping assumptions where appropriate.
5. Move the historical origin forward and repeat.

Do not use random train/test splits for time series.

Source: [Time-series cross-validation](https://robjhyndman.com/hyndsight/tscv/)

### 11.2 Signal metrics

Measure:

- median forward return after a signal;
- probability of exceeding a defined net-return threshold;
- maximum adverse excursion after a buy;
- avoided decline after a sell;
- precision among the top 20 signals;
- result by game, set, rarity, release age, price band, and confidence;
- score calibration; and
- coverage versus precision for each strictness setting.

Compare against simple baselines:

- near 90-day low/high;
- current 30-day momentum;
- cohort median only; and
- random eligible cards.

### 11.3 Leave-one-set-out new-release validation

For each historical set:

1. Exclude it from training.
2. Build pull, rarity, character, treatment, and market priors from older sets.
3. Predict initial target-set price ranges.
4. Compare with a simple cohort-median baseline.
5. Measure median absolute percentage error and interval coverage.

For Riftbound Overnumbered, compare explicitly with a flat `$100` baseline. The advanced model should not ship unless it consistently improves on that baseline.

### 11.4 Preventing leakage

- Exclude the target card from its peer median.
- Do not use later pull-rate discoveries as if they were known at launch.
- Preserve the source publication date for every pull estimate.
- Do not use later set indexes when simulating a new release.
- Keep presale and released-market periods separate.
- Include cards that later disappear or lose pricing to reduce survivorship bias.

---

## 12. Recommended delivery sequence

### Phase 1 — descriptive market structure *(mostly delivered as of 2026-09-01)*

- Robust percentile and MAD calculations. *(Shipped on detail pages — 10–90th percentile volatility, momentum, drawdown, robust trend slope; not yet in signal scoring.)*
- Rarity/set/game indexes. *(Shipped — per-date index and median rollups, set indexes with sealed overlay, game indexes vs S&P 500.)*
- Market breadth. *(Shipped — 7-/30-day advancer/decliner ratio bars.)*
- Cohort Position on detail pages. *(Shipped as peer context; see §10.2 status.)*
- Falling, Improving, Breakout, and Overextended regime labels. *(NOT shipped — the one remaining Phase 1 item; see §15.2.)*

### Phase 2 — validated signal refinement

- Peer-relative returns.
- Momentum acceleration and stabilization.
- Cohort-deviation evidence.
- Walk-forward strictness calibration.
- Expanded confidence/coverage metadata.

### Phase 3 — pull-rate data foundation

- Versioned pull-rate contract.
- Source hierarchy and provenance.
- Pack-slot and eligible-pool model.
- Confidence intervals.
- Language, region, and print-run boundaries.

### Phase 4 — new-release estimation

- Character-demand prior.
- Pull-adjusted comparable normalization.
- Aggressive lifecycle taper.
- Early Value Estimate with intervals.
- Leave-one-set-out release validation.

### Phase 5 — sealed relationship and expected value

- Set Singles and Sealed indexes.
- Singles/Sealed divergence.
- Gross and net pull-cost comparisons.
- Chase concentration and expected-value contribution.
- Explicit double-counting controls.

### Phase 6 — transaction enrichment *(precondition met early — partially delivered out of order)*

The authorized source arrived (TCGplayer completed-sales history, §1.4), so parts of
this phase shipped ahead of Phases 2–5:

- verified transaction counts; *(shipped)*
- sale-price distributions; *(shipped as realized 30-day ranges incl. delivered figures; percentile targets pending)*
- seller/listing depth; *(not available)*
- liquidity and sell-through estimates; *(shipped as the sales_30/sales_7 liquidity gate)*
- execution-aware return calculations. *(not built)*

---

## 13. Required guardrails

- Missing values remain `null` and render as `N/A`.
- Listing high is never labeled as a sale price.
- Pull rates are never silently estimated.
- Measured and inferred pull rates remain visibly distinct.
- Confidence is separate from opportunity score.
- New cards are labeled Price Discovery until sufficient exact history exists.
- Strong momentum at a high is not automatically a Hot Sell.
- Accelerating decline at a low is not automatically a Hot Buy.
- Same-character comparisons taper quickly as exact history develops.
- Sealed, set value, chase concentration, and pull cost are not double-counted.
- Liquidity and sales-volume claims come only from the integrated completed-sales series; dated price observations are never presented as volume.
- Scores are described as informational market signals, not guaranteed outcomes or financial advice.

---

## 14. Final model direction

The recommended long-term model is a transparent hierarchical estimator:

```text
Scarcity prior
+ rarity/set cohort prior
+ character-demand prior
+ treatment and playability context
+ sealed/set market context
+ target-card history and trend regime
+ data confidence
→ explainable signal and interval
```

The priors make new-card estimates possible. Their influence declines as exact target-card history matures. The historical series then becomes authoritative, while pull rarity remains a structural scarcity input and peer/index comparisons remain relative context.

This design improves on a simple near-low/near-high model without hiding the logic from users and without presenting uncertain collectible-market observations as certainty.

---

## 15. Hot Buy / Hot Sell improvement candidates (2026-09-01 baseline analysis)

This section re-reads the research against what Raw Signal now has. The unifying
observation: **most of the context the original research asked for has been built —
peer cohorts, indexes, breadth, completed sales, robust markers, deep history — but
almost none of it feeds `evaluateMarketSignal` yet.** The score still sees only the
target card's own price series plus a binary liquidity gate. The highest-value work is
wiring existing, already-shipped data into scoring, then calibrating.

Ordered by expected value per unit of effort:

### 15.1 Robust percentile extremes in scoring *(fixes limitations 1–2; data already present)*

Scoring still anchors on raw window minima/maxima, so one anomalous daily observation
can define "the low" a card is judged against. The detail page already computes
10–90th percentile spreads; move the signal's reference extremes to the same
winsorized percentiles (§3.2) and keep raw extremes as displayed secondary facts.
Low effort, no new data, directly de-noises both boards.

### 15.2 Sell-side regime distinction *(fixes limitation 4; the buy side's twin)*

The buy side already refuses falling knives; the sell side still cannot tell
overextension from breakout continuation. The inputs exist — momentum
(current vs trailing-30 average), robust trend slope, drawdown, and the demand trend
(last-30 vs prior-30 sales) are all computed for detail pages. Add the §3.5 states:
near-high + weakening momentum → Hot Sell candidate; near-high + accelerating
momentum with breadth support → Breakout (not a sell); one-day jump → Spike/low
confidence. This is the last unshipped Phase 1 item and the largest remaining
asymmetry in the model.

### 15.3 Cohort-relative evidence *(§4.2/§10.4 — infrastructure shipped, scoring hook missing)*

Peer anchors already maintain game|set|rarity cohort daily averages with history.
Add the relative 30-day return (target minus cohort median) as scoring evidence at
the research's suggested ~15% weight: underperformance strengthens Hot Buy,
outperformance strengthens Hot Sell. Respect the §6.5 double-counting rule — the
Modeled Fair Value panel and peer anchor already express cohort position, so the
signal should consume the *relative return*, not a second copy of the level deviation.
Keep the existing minimum-cohort gate.

### 15.4 Sales-aware scoring beyond the binary gate *(§1.4 data, currently underused)*

Liquidity is a pass/fail floor today. Three cheap upgrades:

- scale confidence continuously with sales velocity instead of only gating at 5/30D;
- use realized-sale medians/percentiles (delivered vs item) as the sell-side
  reference instead of listing-derived values (closing the §1.2 rule properly); and
- use sales acceleration (demand trend) as regime evidence in §15.2 — a price high
  on rising completed-sale volume is breakout-like; on collapsing volume it is
  overextension-like.

### 15.5 Index and breadth context terms *(§4.4/§4.5 — shipped surfaces, unused by signals)*

Set/game indexes and breadth exist. Add the research's ~10% context term:
dampen Hot Sell when the whole set is rising on broad breadth (the move is
market-wide, not card-specific); strengthen Hot Buy when a card falls while its set
and rarity cohort rise. Pokémon, Riftbound, and One Piece stay on separate indexes.

### 15.6 Walk-forward calibration is now actually possible *(fixes limitation 8)*

The original blocker — thin history — is gone: TCGCSV archives reach to 2024-02-08
and the local max-profile database (~13.5M observations) makes backtesting free and
fast on local hardware. Before shipping any reweighting from §15.1–15.5, build the
§11.1 walk-forward harness against that database: score historical dates with
only-then-known data, record 7/30/90-day forward returns, and compare every change
against the simple baselines (near-extreme, momentum, cohort median, random
eligible). Weights stay research heuristics until they beat baselines out of sample;
strictness presets (Conservative/Balanced/Aggressive) become calibrated
coverage-vs-precision points instead of guesses.

### 15.7 Explicitly deferred

Character-demand priors, Early Value Estimates, pull-difficulty score adjustments,
and execution-aware net returns remain future work (Phases 3–5): their data
foundations are absent or partial, and §15.1–15.6 neither depend on them nor
double-count them later.

### Suggested sequencing

**Planning decisions (2026-09-01, user):** harness-first sequencing adopted; regime
states ship as **full regime labels** (boards + detail pages, with board filters), with
descriptive labels shipping on staging review while regime-driven qualification changes
stay harness-gated; **no scoring change reaches production until it beats the current
model and the simple baselines out of sample**; the “Modeled Fair Value” panel name
stays (§10.2). Implementation plan: RawSignal `docs/todo.md` §P (P1–P7 shipped 2026-09-01 → 09-03; build notes in `docs/todo-completed.md`).

1. §15.6 harness first (cheap, local, de-risks everything after it).
2. §15.1 robust extremes and §15.2 sell-side regimes — validated on the harness.
3. §15.3 cohort-relative and §15.5 index/breadth terms — one at a time, each
   required to beat the prior model out of sample.
4. §15.4 sales-aware refinements alongside whichever of the above they support.

Each step keeps the existing guardrails: evidence and exclusion reasons stay
user-visible, confidence stays separate from score, and nothing ships that fails to
beat the baseline it replaces.

