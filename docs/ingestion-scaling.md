# Ingestion scaling, cost, and bulk-data research (2026-08-31)

Research from the sealed-expansion sessions: what limits catalog growth, what the
Cloudflare bill actually exposes, and whether TCGCSV's bulk archives beat per-group
requests. Companion to `docs/sealed-market-expansion.md` (per-market gap numbers) and
todo §M (the actionable fix list distilled from this document).

## 1. The capacity model — three budgets govern every expansion

1. **Cron ticks: 720/day (`*/2`), ~500–520 used** after the One Piece + Japanese
   sealed batches. This is the binding constraint. Remaining headroom (~200 ticks)
   fits roughly ONE of: OP curated singles (+~80), MTG sealed (+~77), or JP curated
   singles (+~80–105) — not two.
2. **History calls: one TCGplayer call per product per day (~16.8k/day).** The
   structural cost — a permanent per-product daily tax (~1 tick per 60 products).
   The walk itself is cheap by comparison.
3. **Group fetches: capped at 12/tick.** For sealed-only categories tick cost scales
   with *group count*, not product count (MTG: 455 groups for ~2,450 keeps). The cap
   is calibrated for heavy singles groups; sealed-only groups yield ~1 record each.

Subrequests to TCGCSV are **free** on Workers and TCGCSV is explicitly built for bulk
pulls — request count is never the cost; ticks and the daily history tax are.

## 2. Cloudflare billing findings (dashboard, Aug 27–31 observed)

| Meter | 5-day usage | Projected cycle | Included | Verdict |
|---|---|---|---|---|
| **D1 rows written** | **9.82M (~1.96M/day)** | **~61M** | **50M** | ⚠️ only real exposure (~$11/cycle at $1/M) |
| D1 rows read | 2.7B | ~16.7B | 25B | fine (overage $0.001/M anyway) |
| Workers CPU | 1.77M ms | ~11M | 30M | fine |
| Requests | 20.8k | ~129k | 10M | noise |
| Browser Run (Collectr) | 0.05 hrs | — | 10 hrs/day | rate limiter working |

**Root cause of the writes:** the daily history job re-upserts each product's ENTIRE
fetched point series (~90–150 points) via `upsertHistory` — D1 bills every
`INSERT…ON CONFLICT` row even when unchanged, so ~98% of writes re-save existing
data (~1.5–2M/day recurring). The Aug 27–28 production seeding inflates the 5-day
average, but steady state still hugs the 50M line and grows with every expansion
(+~2.8M/mo from OP+JP alone; MTG sealed would add ~11M/mo on this pattern).

**Fix (M1):** delta-only history writes — only persist points newer than the stored
max `observed_date` per product/variant. Cuts writes ~97% (to <200k/day, ~10% of
quota) and makes billing independent of catalog size.

**Cron `*/1` costs nothing:** +~22k requests and ~2M row reads per month (0.2% and
0.008% of quotas), zero writes — it doubles the *pace* of the same daily work, and
post-completion ticks are idle no-ops.

## 3. TCGCSV bulk archives vs per-group requests

Verified facts:
- One daily archive exists: `archive/tcgplayer/prices-YYYY-MM-DD.ppmd.7z` — **~4 MB,
  ALL categories**, internal layout `<date>/<category>/<group>/prices`, history back
  to **2024-02-08**. **Prices only** — there is no products/groups bulk; product
  metadata (names, extendedData, images — everything the normalizers key on) still
  needs per-group `products` requests.
- 7-Zip **PPMd solid** compression: the stream must be decompressed as a whole.
  Infeasible inside a Worker (128 MB memory, no native 7z) — consuming it means an
  external job (local script / GitHub Action / container) feeding D1 or R2.

**Verdict for daily ops at our scale: not worth it.** Requests are free; the tick
relief bulk would buy is available from config levers (M2+M3) with zero new
infrastructure; and bulk replaces only the prices half of each group fetch anyway.
Bulk becomes the right architecture at MTG-singles scale (~thousands of groups).

**Where the archive IS a clear win:**
1. **One-shot sealed history backfill (M6):** the 587 new OP/JP sealed products have
   no D1 history depth and TCGplayer's history API is thin on sealed. ~570 daily
   archives (~2.3 GB total) hold exact daily prices back to Feb 2024 — a local job
   can rebuild 2½ years of `price_observations` for categories 68/85 once.
2. **Local sync-script speedup (minor):** one 4 MB download could feed the ~720
   price fetches the sync scripts make per run.

Discovered en route: `buildWorkList` re-fetches all five category group indexes
**every live tick** (~1,250 requests/day). Free but pointless — cacheable per run.

## 4. Fix catalog

See todo §M for status tracking. Ordered by recommended sequence:

| # | Fix | Effort | Unlocks |
|---|---|---|---|
| M1 | Delta-only history writes | S–M | removes the only billing exposure; catalog-size-independent bill |
| M2 | Cron `*/2` → `*/1` | XS (config) | 2× tick budget, $0 cost |
| M3 | Raise sealed-only groupFetchCap (12→~40) | XS | ~3× sealed-walk speed (~80 subrequests of 1,000 allowed) |
| M4 | Tiered history cadence (hot daily, tail 3–7d) | M | catalog can ~3× without history cost tripling |
| M5 | History targets from D1 (not bundled feeds) | M | expansions stop requiring bundled-feed regen; coverage automatic |
| M6 | Archive-based sealed history backfill (one-shot) | M | 2.5y daily history for 587 OP/JP sealed |
| M7 | Category registry (walk+sync+tests share one config) | M | next game = config entry + normalizer, not a five-file change |
| M8 | Widen `catalog_products` game CHECK once (mtg/yugioh/lorcana) | S (migration) | batches the per-game table-rebuild tax |
| M9 | Sealed-group cache (walk only groups holding sealed) | M | ~30–40% off sealed walks; only needed if MTG revives |
| M10 | Archive-based daily bulk ingestion (external job) | L | only at MTG-singles / track-everything scale |
| M11 | Cache buildWorkList per run | XS | drops ~1,250 pointless index fetches/day |
| M12 | Rejected-stats review report | S | catches taxonomy drift (walk already records reasons) |
| M13 | §L4 retailer-exclusive classifier audit (Costco PE 653892) | S | likely a name-pattern miss, not a scope gap |

**Sequencing:** M1 first (billing), M2+M3 next (both OP curated singles AND MTG
sealed would then fit); M4+M5 before the next singles expansion; M7+M8 with the next
new game; M6 whenever chart depth for the new sealed matters; M9/M10 parked until
MTG revives.
