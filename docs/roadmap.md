# Roadmap and deferred work

Status notes captured 2026-08-27. This file records agreed plans and open decisions that are
not yet implemented, so future sessions can resume without re-deriving them. Update or remove
entries as they land.

## 1. D1 staging backfill continuation

The staging Worker (`raw-signal-staging`) and its migrated D1 database exist; ingestion is
proven with bounded live batches, but the bootstrap is incomplete and both readiness markers
are absent, so every public API intentionally serves bundled feeds. The full runbook is
`docs/cloudflare-cutover.md`; the remaining sequence is:

1. **Catalog ingestion to completion** — repeat `POST /__ops/staging-jobs` with
   `{"job":"daily","batchSize":80}` until `done: true`. Checkpointed per batch; publishes the
   `daily-market` readiness marker (with row-count integrity check) only when complete.
2. **History backfill to completion** — `{"job":"history","batchSize":20}` against its durable
   cursor until all eligible products are processed; publishes `history-signals`. This is one
   TCGplayer fetch per product/printing (~13k singles), so it spans hundreds of resumable
   invocations over days.
3. **Parity proof** — `npm run cloudflare:parity` against the Sites production baseline; must
   match records, counts, and facets with the candidate reporting `source: "database"`.
4. **Durable continuation** — the anticipated paid-plan Cloudflare Workflow (resumable steps,
   monitoring, usage limits) replaces manual staging-job invocations. Implement only on
   explicit request, per AGENTS.md.

Blocked on: user-supplied Wrangler login and `STAGING_JOB_TOKEN`, plus explicit authorization
to mutate Cloudflare state. Payoff: D1-served catalog/history/signals, accumulating per-day
observation history (unblocks item 4 below), and data refreshes without redeploys.

## 2. Daily detail-feed regeneration (plan validated 2026-08-26)

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

## 3. Graded-price sync scheduling

`npm run data:sync:graded` rotates stalest-first through the top-400 Pokémon singles pool
under the free-tier budget (100 credits/day, 2 per card → ~46 cards/run, full pool ≈ 9 days).
A daily scheduled run (same host decision as item 2) keeps the rotation moving. The paid API
tier would cover the pool daily. Population/GemRate data requires the provider's Business
plan and stays rendered as unavailable.

## 4. Fair-value set-rarity anchor

`modeledFairValue` currently blends the card's own history (90-day median .5, 30-day median
.3, current median listing .2, renormalized). A set/rarity peer anchor was designed but
collapses algebraically without historical peer averages, which need the D1 per-day
observation history from item 1. Revisit once `daily-market` has accumulated history.
