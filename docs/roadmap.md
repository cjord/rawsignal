# Roadmap and deferred work

Status notes captured 2026-08-27; header refreshed 2026-09-01. This file records agreed
plans and open decisions that are not yet implemented, so future sessions can resume
without re-deriving them. Update or remove entries as they land. The signal-model roadmap
(walk-forward harness, champion/challenger promotion, regimes, cohort evidence) lives in
`docs/todo.md` §P (open steps, priorities, scheduled tasks) and `docs/todo-completed.md`
(shipped steps P1–P7 with build notes), with run evidence in `docs/backtests.md`.

## 1. D1 backfill and cutover — DONE (production live 2026-08-28+)

Production (`raw-signal` @ rawsignal.cards, minutely guarded cron) serves catalog,
history, and signals from D1 with both readiness markers published; daily live ingestion
and the tiered history cadence run on the checkpointed cron (`docs/ingestion-scaling.md`).
Bundled feeds remain the automatic fallback path only. Staging (`raw-signal-staging`)
stays cheap: no cron, deliberately stale D1, used for pre-production review. The paid-plan
Cloudflare Workflow idea from the original sequence remains not implemented — the plain
cron + checkpointed jobs approach replaced it (decision G1).

## 2. Daily detail-feed regeneration — SUPERSEDED (D1 detail ingestion, 2026-08-28)

The production cron's `details` action ingests product details into D1 after each
snapshot's catalog run (`db/detail-ingestion.ts`), so detail pages refresh daily without
deploys or feed regeneration; the bundled detail feeds are now only the readiness
fallback and are regenerated on deploys. The scheduling questions below are kept for the
record — they only matter if bundled-feed freshness becomes a goal again. The generator
and freshness probe exist (`scripts/details/build-detail-feeds.mjs`), so this item is now
purely the scheduling and publish-path decisions below. Until it lands, feeds (and the peer
history in item 4) refresh only when a data-refresh task runs the scripts manually.

Cadence: TCGCSV publishes daily at 20:00 UTC (`https://tcgcsv.com/last-updated.txt` is the
cheap freshness probe). First attempt at ~20:10 UTC, retrying every 10 minutes until the
stamp advances past the value recorded in `tcg-index.json` (`sourceUpdatedAt`).
`scripts/details/build-detail-feeds.mjs --require-fresh` implements the probe: exit code 3
means "no new publish yet; retry later".

Open decisions before scheduling:

- **Scheduler host.** Sites has no cron and Cloudflare Cron is deliberately unused. The
  realistic host is a GitHub Actions scheduled workflow (20:10 UTC, in-run 10-minute retries
  capped at ~6 attempts). An automated workflow that commits regenerated feeds needs an
  explicit AGENTS.md carve-out — it is a standing authorization, distinct from the
  "no unrequested pushes" rule for agents.
- **The production-freshness gap.** `public/data/` is baked into the Sites bundle at deploy
  time; regenerated feeds refresh the repo, not production, until a new Site version is
  published (currently a manual upload). Daily-fresh production requires either (a)
  automating the Sites publish after regeneration or (b) completing the D1 path (item 1),
  which refreshes without redeploys and is the architecture's intended answer.
- **Single download pass.** The detail generator and `sync-tcgcsv.mjs`/`sync-sealed.mjs`
  fetch the same TCGCSV group payloads. The nightly job should run them back-to-back today;
  a shared-download refactor is a later optimization if request volume matters.

## 3. Graded-price sync scheduling — SUPERSEDED (cron `graded` action, 2026-08-28)

The production cron runs `db/graded-ingestion.ts` once daily after live+details (the
`raw-signal` Worker is the sole spender of the API key), rotating the stalest of the
top-400 Pokémon singles; no separate scheduler is needed. The local script remains for
manual runs. `npm run data:sync:graded` rotates stalest-first through the top-400 Pokémon singles pool
under the free-tier budget (100 credits/day, 2 per card → ~46 cards/run, full pool ≈ 9 days).
A daily scheduled run (same host decision as item 2) keeps the rotation moving. The paid API
tier would cover the pool daily. Population/GemRate data requires the provider's Business
plan and stays rendered as unavailable.

## 4. Fair-value set-rarity anchor — implemented via feed accumulation (2026-08-27); D1 derive-on-read since 2026-08-28

On D1-served pages the anchor is derived on read from `price_observations` by
`db/peer-anchors.ts` (same pure `core/peer-history.ts` summarizer), so it activates
immediately where the history is deep enough; the feed accumulator below remains the
fallback path. Rather than waiting on D1 history (the original plan), per-day set/rarity peer averages now
accumulate in `data-history/peer-averages.json` (committed, not bundled) each time
`scripts/details/build-peer-context.mjs` runs after a singles sync; the bundled summary is
`public/data/peer-context.json`. The anchor component is
`peer current average × (card 90-day median ÷ peer 90-day average)` and activates only once
a cohort has 14 daily observations — until then fair value renormalizes to exactly the
original 50/30/20 blend and the panel notes that the anchor is still accumulating. History
accrues one observation per TCGCSV publish date, so activation needs the daily job from
item 2 (or manual refreshes) to run consistently. D1 remains a future upgrade path for
deeper retroactive history.

## 5. Fair-value model improvements — BACKLOG (added 2026-08-27; now testable)

Candidate refinements to evaluate once the peer anchor has activated and its behavior can be
observed against real cohorts. As of 2026-09 the walk-forward harness
(`scripts/backtest/`, `docs/backtests.md`) and the local max-profile D1 make the
"validate the anchor empirically" step below runnable offline; the 40/24/16/20 weights
have never been measured. Each stays within the AGENTS.md rule: transparent,
documented, labeled a model, no opaque or predictive components without an explicit user
decision.

- **Validate the anchor empirically** before tuning anything else: once cohorts hit 14+
  observations, compare anchored vs unanchored fair value against subsequent realized sale
  prices (TCGplayer completed-sale buckets) to see whether the 20% weight helps or hurts.
- **Weight calibration** from that same backtest — the 40/24/16/20 split was chosen for
  exact backward compatibility, not measured accuracy.
- **Sales-weighted components**: blend in realized sale prices (quantity-weighted median of
  completed-sale buckets) as a component, since listings and market estimates can diverge
  from what buyers actually pay.
- **Volatility-aware banding**: widen the "near fair" band for high-volatility printings so
  the premium/discount label doesn't overstate precision on thin markets.
- **Graded-market coupling (singles)**: where PokemonPriceTracker raw-card eBay sales exist,
  consider them as a cross-marketplace sanity component for the raw price.
- **Sealed peer anchor**: the current anchor is singles-only; a set-scoped sealed-category
  cohort (e.g., ETBs of the same set generation) could anchor sealed fair value the same way.
- **Cohort robustness**: median instead of mean for cohort averages (a single spiking chase
  card currently moves its whole cohort), and a minimum cohort size before the anchor
  applies.
