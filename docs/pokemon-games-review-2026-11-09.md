# Games review and Pokémon daily expansion

November 9, 2026. This is a reproducible simulation review, not player telemetry.
Run `node scripts/games/game-review.mjs 500` against the bundled feeds. No artwork
probes, upstream ingestion or paid APIs are used by that script. The auction
scenario has three NPCs and a human who always passes; it does not measure real
players' results, purchase opportunities or market profitability.

## Price Showdown difficulty

500 seeded rounds per row; comparisons use the winner and runner-up's frozen
market prices. “Within 25%” means the winner is at most 1.25 times the runner-up.

| Game / pool | Mode | Median winner / runner-up | Within 25% | Winner at least 5× |
|---|---|---:|---:|---:|
| Pokémon / all eras | Normal | 3.73× | 10.4% | 41.6% |
| Pokémon / all eras | Hard | 2.92× | 14.0% | 31.4% |
| Pokémon / modern | Normal | 2.79× | 12.4% | 31.0% |
| Pokémon / modern | Hard | 2.19× | 19.0% | 22.2% |
| Riftbound | Normal | 2.28× | 18.8% | 28.6% |
| Riftbound | Hard | 2.03× | 22.0% | 27.2% |

Hard adds a third choice and tends to close the top-price gap, but does not
consistently create a close contest. A worthwhile experiment is to favor comparable
price bands in Hard, while retaining some surprising mismatches. Avoid penny-level
near-ties: volatile prices and ordinary source lag make those arbitrary. Trial a
minimum meaningful gap and roughly 10–60% top-two differences, then measure the
result rather than declaring a target inherently fun.

Keep rarity preferences and exact set/printing labels. A separate “same Pokémon,
different sets” practice option could be interesting; the shared sampler currently
requires distinct names and artwork. Any relaxation needs clear identity labels
and must preserve existing Riftbound behavior and frozen daily rules.

## Riftbound NPC auctions

500 seeded auctions per tier; bundled catalog, no artwork rejection. “Sale value”
is gross collection value less the fixed 10% selling fee. Results describe the
existing virtual economy, not a real resale estimate. Paid entry costs and player
investigations are separate from the winner's modeled sale-value comparison.

| Tier | Median collection | Round-one NPC buyout | Winner bid / gross, median | Winner bid / sale value, median | Winner over sale value |
|---|---:|---:|---:|---:|---:|
| Free | $389.79 | 24.0% | 73.2% | 81.3% | 27.6% |
| Paid | $1,522.01 | 21.0% | 63.0% | 70.0% | 24.6% |

There were no unsold lots in these runs. Roughly one in four winning NPCs loses
against the after-fee value, which provides the intended loss-sharing moments.
That is a baseline, not a proposed increase. Paid bidding still covers a smaller
fraction of value than free. Do not blindly raise all paid bids: the value
distribution has a long chase-card tail, and average bids already exceed medians.

### Opening bids by personality

Means and medians are per appearance, in virtual dollars. The rich profile's
smaller sample and uncommon appearance make its estimates less stable.

| Rival | Free mean | Free median | Paid mean | Paid median |
|---|---:|---:|---:|---:|
| Analyst | $214 | $127 | $614 | $445 |
| Archivist | $214 | $101 | $534 | $381 |
| Bargain Hunter | $203 | $73 | $417 | $306 |
| Closer | $243 | $114 | $560 | $400 |
| Collector | $182 | $90 | $469 | $304 |
| Dealer | $212 | $111 | $432 | $334 |
| Follower | $153 | $66 | $350 | $296 |
| Gambler | $233 | $100 | $477 | $357 |
| Opportunist | $136 | $69 | $339 | $274 |
| Playset Builder | $268 | $126 | $538 | $420 |
| Skeptic | $203 | $87 | $378 | $293 |
| Trust Fund Kid | $252 | $137 | $731 | $568 |

Differences are intentional: investigations, personalities, speculation and public
bid influence all contribute. A low bid alone is not evidence of a faulty bot.
The Closer won most often here (79/500 free and 100/500 paid), while lower-margin
profiles such as the Follower won much less often. This merits review across
player strategies and collection themes before changing personality weights.

Recommended auction experiments, in order:

1. Track round-one endings by theme and winning personality, then test slightly
   narrower ordinary-bot risk tails. Preserve rare extravagant behavior and
   lucky information advantages. More baseline bidding everywhere could remove
   the player's early-discovery reward.
2. Calibrate paid speculation to the selected pool's distribution and information
   quality; compare gross and after-fee ratios as well as dollars. Pokémon eras
   and sets need their own calibration before auction release.
3. Run alternative simulated humans: conservative, information-led and aggressive.
   Always-pass results omit precisely the player's influence we want to evaluate.
4. Evaluate investigations by information gained, redundancy and chance of zero
   results. Do not give every NPC undocumented automatic private samples again.
   Personality-specific bonuses remain a separate, explicit design decision.

No NPC, auction weighting or Showdown price-band balance changes were activated by
this review. Existing outcomes and archived Riftbound rules stay unchanged.

## Performance and availability

Local Node sampler medians were about 4.2–4.4 ms for all-era Pokémon, 1.6 ms for
modern Pokémon and 0.1 ms for Riftbound. These are diagnostic desktop timings,
not Worker CPU or device/browser latency. Catalog transport, artwork and cold
initialization are more valuable optimization targets than rewriting scoring.

The first staging deployment of practice (`e37ab4b8`, source `70b8ffa`) exposed a
reader defect: the complete published 19,245-row catalog was hidden by 11 unrelated
unpublished Pokémon rows. The corrected reader admits only the published run and
still checks complete published coverage and matching price rows. New tests prove
extra pending rows remain excluded and overwritten/missing published rows still
fail closed. No database cleanup or ingestion was needed. Read-only inspection
confirmed the corrected query can read the database catalog.

Keep the existing metadata-first/selected-pool flow, no per-round pricing calls,
bounded caches and independent artwork loading. Before real bulk admission,
measure scoped query size, CPU, memory, row reads/writes and history/metrics parity.
The producer remains disconnected and staging still has no cron.

## Pokémon daily implementation

- Reuses daily answers, expiry, presentation, history, difficulty controls and
  result sharing, with independent Pokémon document keys.
- Mostly era themes and occasional single-set spotlights. Only viable pools are
  selected, with at least 60 priced eligible cards to support 50 distinct choices
  and some artwork replacements. Normal and Hard do not reuse a card between
  modes, so finishing Normal cannot directly reveal Hard's card prices.
- One immutable market/date archive. Conditional insertion and rereading the
  winner keep concurrent first visitors on the same lineup. Image failures are
  repaired inside the assigned scope before publication. Midnight during
  generation rejects an expired new snapshot. Historical misses never regenerate.
- New versioned result links include Pokémon identity and catalog version;
  existing v1 Riftbound links keep their routes and meaning. Results pages do not
  write progress or reward accounts. Scores remain self-reported.
- Additive migrations `0030` and `0031`; no changes to existing daily tables,
  account identities, game wallets or market analytics. Bulk ingestion stays off.

## Artwork choices

The standard English card-back reference was found through image search and
visually checked: [AKC Emporium card-back image](https://akcemporium.com/cdn/shop/products/Pokemon_TCG_Card_Back_c389ec6b-c7c2-4c12-ac2d-75fed78e5fcd_720x.jpg?v=1639428695).
Static blue and warm-graphite options use the actual reference, without generating
replacement logos. Preview files are under ignored `outputs/pokemon-art-options/`.
They are compositions, not AI-generated renders. The built-in generator rejected
the initial requests. The user authorized trying the separate API fallback and
will configure its local key. Images remain review choices until selected.

Pokémon Auction House, its independent economy, daily auctions, rivals and
community pages remain the next implementation batch; preparing cover art is not
an auction release.

## Validation notes

The daily browser fixtures now let rendering frames run after setting the test
date. Pausing the clock froze React effects on the result screen; that was a test
harness issue rather than a change to game expiry rules. The legacy result-link
checks remain separate from the ten-round play journey, with the same assertions.

The existing auction review test combined bidding, ranking and eighteen
width/theme layout combinations in one thirty-second case. Those checks now run
as four focused scenarios, retaining the end-to-end bid-to-settlement journey,
all layout assertions and the existing per-test timeout. The focused four-case
run passed. A complete release gate and live staging verification are still
required before claiming the follow-up release is ready.

The inventory-sale journey also waits for entry actionability and the Inventory
route before checking its sale controls. Its cold-start failures stopped at
different loading stages; the explicit readiness waits passed in isolation while
retaining sale assertions and the thirty-second case limit. The four-round
settlement journey passed unchanged on its isolated rerun.
