# Local development database (max profile)

Added 2026-09-01 (user decision: the local D1 is a **maximal testbed** — it may hold
MORE data than staging/production, since it lives on the developer's machine at zero
cloud cost). Strictly local: everything lives under gitignored `.wrangler/` and never
enters a deploy bundle or a Cloudflare environment.

## The two profiles

| Profile | Content | Behavior |
|---|---|---|
| `max` | Full catalogs (~17.5k products), detail enrichments, **2.5-year daily price history for every tracked product** (singles AND sealed, parsed from the cached TCGCSV archives), derived metrics + signals, metrics series, readiness markers | Dev serves `source:"database"` everywhere — D1 detail pages, live feeds, persisted signals, metrics, Collectr sealed/fuzzy matching, `import_match_log` |
| `empty` | Zero-byte database | The historical feed-fallback contract — dev serves bundled feeds; D1 paths inactive |

## Commands

```
npm run db:local:parse    # phase 1: parse cached archives → NDJSON (resumable slices,
                          #   --max-minutes 9 default; rerun until remaining: 0)
npm run db:local:build    # phase 2: assemble .wrangler/local-profiles/max.sqlite
npm run db:local:max      # activate the seeded testbed
npm run db:local:empty    # back to the empty feed-fallback contract
npm run db:local:status   # which profile is active + row counts
```

**Stop the dev server before swapping profiles** (miniflare holds the WAL open).
The gate's Playwright specs boot against whichever profile is active; both pass.

## How it works

- Archives: `backups/tcgcsv-archive/` holds all 936 daily TCGCSV price archives
  (2024-02-08 →, downloaded by the M6 backfill; ~3.8 GB, kept for reuse). Extraction
  uses Windows' built-in bsdtar, which reads PPMd 7z natively.
- `parse-archives.mjs` walks categories 3/68/85/89 per day, matching singles to their
  feed printing (`subTypeName`) and sealed through the shared preferred-price rule,
  appending per-day NDJSON (resumable).
- `build-local-db.mjs` runs the REAL ingestion code (`runDailyMarketIngestion`,
  `persistDerivedHistory`, `runMetricsRollup`) against a fresh sqlite: migrations →
  catalog seed → `product_details` chunks → archive observations → per-product derived
  metrics/signals from full history → metrics backfill → readiness markers
  (`daily-market` + `history-signals`). `pragma user_version=2` tags the file.
- `db-profile.mjs` copies profiles over the miniflare D1 file at
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (dev must have run once so the
  file exists).

## Notes

- The max profile is the walk-forward backtest archive: `npm run backtest:walk`
  (`scripts/backtest/walk-forward.mjs`) reads it read-only; raw run reports live under
  `backups/backtests/<run>/` (local-only) and findings in `docs/backtests.md`.
- Rebuild cadence: whenever feeds regenerate or a migration lands, rerun
  `db:local:build` (parse only needs re-running for NEW archive days — it resumes).
- The stale `.wrangler/m12-d1/` experiment dir was deleted 2026-09-01.
- Deferred catalogs (MTG sealed, OP/JP singles — todo L2/L3) join the max profile
  when their normalizers land; the parser picks up whatever the feeds contain.
