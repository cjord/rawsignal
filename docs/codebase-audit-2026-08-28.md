# Codebase audit — 2026-08-28

Successor to the 2026-08-25 refactor program (`refactor-plan.md`, `refactor-results.txt`).
That program's goals were achieved and held; this audit measures the debt re-accumulated by
the three weeks of feature work since (metrics page, scalper rework, navigation rework,
favorites, buy list), maps today's dependencies and hidden couplings, and defines the next
consolidation pass. Orientation lives in [helicopter-view.md](helicopter-view.md); items
needing a product/architecture decision live in
[refactor-decisions-pending.md](refactor-decisions-pending.md).

## Simplified summary

The house is structurally sound — the 2026-08-25 refactor's shared foundations
(query engine, URL codec, leaderboard shell, filter primitives, ingestion runners)
all held. What three weeks of fast feature work re-created is **surface sprawl**:

1. **The two page files re-grew** (~1,150 and ~950 lines) and mirror each other in
   ~27 places (~220 mechanically duplicated lines) — every new feature was pasted
   into both instead of extracted once. A first extraction wave landed on this
   branch; the rest is queued.
2. **CSS re-accumulated an override stack**: 301 `!important`, ~9.5% of the styles
   provably dead (whole removed features still styled), five different greens for
   "up", and one stylesheet (`metrics.css`) that secretly held the slider math the
   home page depends on (fixed on this branch).
3. **The layering is inverted in places**: the database layer imports app logic and
   untyped `.mjs` scripts; three files are all called "catalog repository"; the D1
   adapter secretly does its filtering in memory.
4. **The biggest drag on any cleanup is a test**: `rendered-html.test.mjs` holds 213
   regex pins against 45 raw source files, so almost every refactor is also a test
   edit. Deciding its future (D7) unlocks everything else.
5. A handful of **real bugs** surfaced as by-products: unguarded `localStorage`
   access that throws on the Singles page, a dark-mode basis toggle rendering black
   text on a dark background, detail pages never highlighting their nav item (all
   fixed on this branch), and `?strictness=` deep links that parse but never apply
   (decision D12).

## Baseline and churn

76 commits landed since the refactor program closed on 2026-08-25. Churn concentrates
exactly where the program predicted regressions would pool if extraction discipline
lapsed:

| File | Commits touched | Reading |
|---|---|---|
| `app/page.tsx` | 23 | God file re-grew to ~1,150 lines |
| `app/market-views.css` | 23 | The append-target stylesheet, again |
| `app/SealedView.tsx` | 20 | Second god file, ~950 lines |
| `app/ProductDetailPage.tsx` | 19 | Detail surface absorbed each visual pass |
| `tests/rendered-html.test.mjs` | 17 | Every UI change is a two-file edit — the pin tax, measured |

## Dependency map and layering

`app/domain/` is a true leaf (zero outbound deps). Above it, the intended layering
(`domain ← state/data ← UI`, with `db/` and `worker/` beside) is violated by 21
wrong-way edges:

**db → app (11 edges).** Types-only imports are mild
(`db/repository.ts:1`, `db/catalog-repository.ts:1`). The strong ones import logic:

- `db/catalog-repository.ts:2` — the D1 adapter materializes every row, then hands
  filtering/sorting/pagination to `createMemoryCatalogRepository` (lines 162–185).
  Pagination is O(catalog) per request.
- `db/daily-ingestion.ts:2,4` — `deriveHistoryMetrics` and `marketSignal`: signal
  generation lives in `app/`, invoked from the ingestion writer.
- `db/detail-ingestion.ts:1` (`parseCatalogDetailEnrichments`),
  `db/history-backfill.ts:2` (`mapWithConcurrency`).

**db → scripts (3 edges, all `@ts-ignore`).** `db/live-ingestion.ts:4,7` import the
`.mjs` normalizers and cast the results (`:55,74,76`); `db/peer-anchors.ts:4` the same
(`:30`). These are the only untyped values crossing into D1 writes.

**worker → app (5 edges).** Includes the smell that `worker/live-feeds.ts:1` and
`worker/staging-jobs.ts:4` depend on `allowedRarities` from `app/state/market-query.ts`
— Worker asset enumeration keyed off a UI URL-state module.

**One directory-level cycle:** `app/data ⇄ db` (`app/data/load-detail.ts:2-3` and
`app/data/metrics-service.ts:6-7` import `db/*`, while `db/catalog-repository.ts:2-3`
imports `app/data/*`). A `core/` layer (domain + pure calculators + in-memory repo +
query engine + typed normalizers) would break every cycle cleanly; that is a DECISION
item because it moves ~15 files and must update 4 path-pinned test reads in lockstep.

Deploy config is insensitive to file moves: `scripts/cloudflare/prepare-deployment.mjs`
reads only `cloudflare/environments.json` and `dist/server/wrangler.json` — the bundle
is defined by the import graph from `worker/index.ts`, not by directory layout. Only
moving `drizzle/` or changing the dist layout would touch it.

## Frontend duplication and hidden couplings

### The page.tsx ↔ SealedView.tsx mirror

≈210–240 mechanically duplicated lines across 27 mirrored blocks. The heavy hitters:

| Block | Locations | Lines |
|---|---|---|
| History metric list (Market/30D low/30D high/Hist low/Median/7-30-90) + local `movement()` closure | **4 copies**: `page.tsx:149-168`, `SealedView.tsx:428-467`, `detail-tables.tsx:34-46`, `MetricsView.tsx:171-183` (last two line-for-line identical) | ~39 |
| History+signals hook stack (`usePriceHistoryBatch` + `usePersistedSignals` + `signalFor` + derived memo) | `page.tsx:369-440` ↔ `SealedView.tsx:198-321` | ~30 |
| Fallback candidates + history prefetch | `page.tsx:514-543` ↔ `SealedView.tsx:390-414` | ~20 |
| Per-page select | `page.tsx:1052-1069` ↔ `SealedView.tsx:923-940` (only aria-label differs) | 18 |
| One-shot history hook | `MetricsView.tsx:187-200` `useMoverHistory` ≡ `detail-tables.tsx:19-32` `useDetailHistory` | 14 |
| Search input | `page.tsx:865-875` ↔ `SealedView.tsx:651-661` | 11 |
| `usd`/`pct` formatter aliases | 4 copies (page, SealedView, detail-tables, MetricsView), differing only in `"—"` vs `"N/A"` fallback | 12 |
| `updatedLabel` date helper | 4 variants: `page.tsx:100-104`, `SealedView.tsx:117`, `buylist/page.tsx:19`, `domain/formatters.ts:23-30` (only the last is UTC-safe) | 5 |
| Favorites scoping, set→market memo, sort handler, view toggle, full-view card wrap, row star | pairwise copies | ~35 |

### Latent defects found while mapping

- `page.tsx:601,610,620,625` are the **only raw `localStorage` accesses with no
  try/catch** in the app — the Singles page throws on mount where every other surface
  degrades gracefully (fixed on this branch).
- `?strictness=` deep links are **parsed but never applied**: `market-query.ts:26`
  parses, serialize deliberately drops it, and `restoreQuery` never calls
  `setStrictness`. `favoritesOnly` is never serialized at all — reload/share loses the
  Favorites tab. (Decision D12.)
- `MarketTabs.tsx:9` clamps `findIndex` with `Math.max(0,…)`, so a value outside the
  options highlights the **first tab** — visible for one frame as "All highlighted,
  Pokémon data" when leaving scalper mode. (Decision-adjacent; queued.)
- `SealedView.tsx:171` coerces an out-of-mode sort for the query and URL but keeps the
  stale value in local state, so the first click on the displayed-active column sorts
  the wrong direction. (Queued as a behavior fix.)
- `ProductDetailPage.tsx:175` passed an out-of-union `active` to TopBar, so detail
  pages never highlighted a nav item (fixed on this branch).
- **`metrics.css` is load-bearing for the home page**: the only generic
  `var(--view-count)` slider math for `.signal-tabs` lived in `metrics.css:4-5`,
  overriding hardcoded 3-column math in `market-views.css:104,111`. The 4- and 5-tab
  sliders on `/` worked only because a metrics-named stylesheet loads later (fixed on
  this branch — the math moved to `market-views.css`).

### State ownership

URL state has one codec (`market-query.ts`) — except `MetricsView.tsx:250-266`, which
hand-parses and hand-writes `history.replaceState`, so metrics changes are not
back-navigable, never populate `raw-signal-last-list-url`, and silently miss any new
market added to the codec. Ten `raw-signal-*` storage keys exist (theme, font-size,
strictness, scalper-mode, market, hover-previews, favorites, buylist, buylist-size,
last-list-url); strictness hydrate/write is copied in 4 files. Sealed list state lives
in **two homes with a one-frame lag** (SealedView local state mirrored back into
`page.sealedState` via `onQueryChange`), reconciled by the `sealedRevision` remount
key — which also fires on browser Back and scalper toggle, discarding all sealed local
state unintentionally. The render-captured landing state in `page.tsx:572-586` is
load-bearing against two effects that would otherwise clobber market memory; nothing
tests it.

### Other couplings

`scalping` is special-cased across **10 files**; the "Obey Products" label has two
owners (`page.tsx:146` and `formatters.ts:41`). TopBar has two sources of truth for
scalper mode (prop on `/`, internal localStorage elsewhere) — toggling on `/metrics`
doesn't affect an open `/` tab. `SealedView.tsx:4` imports the whole `tcg-index.json`
for one string and duplicates the freshness fetch already made by `page.tsx`.
`page.tsx:331-336` hardcodes injecting `japanese-promos` into rarities while a test
asserts the JSON does *not* contain it — regenerating the index flips the guard
silently. `useFavorites` is a module-level singleton: one star toggle re-renders every
row on the page.

## CSS findings

Nine sheets, ~1,660 lines, loaded in a pinned order where later files deliberately
out-rank earlier ones. The full audit (selector-level, grep-verified) found:

- **301 `!important`** — globals 86, market-views 119, market-controls 38,
  market-content 52. ~35 fight *dead* markup (22 of them in one select-chrome block
  at `globals.css:62` targeting selects that no longer exist — deleted on this
  branch). ~64 form two "arms races": the `.set-filters>div` wrapper hijack
  (32, incl. one input un-styled declaration-by-declaration in
  `market-controls.css:67-83`) and defensive `!important` on specificity ties the
  import order already wins (32).
- **~9.5% of the styles are verified dead** (~168 rules / ~15,100 chars): the
  removed `.market-strip` family (36 rules), the pre-rework profit lab, old sealed
  controls/filter panels, `.touch-open`, `.mode-tabs`, `.game-switch`,
  `.sealed-history-*`, plus dead-by-cascade grid templates in `globals.css` whose
  winners live in later sheets. Grep evidence per family lives in the consolidation
  queue below.
- **Duplication**: a 47-line media block existed twice verbatim in
  `market-content.css` (merged on this branch, with the three narrow-only rules kept
  scoped); the custom checkbox is implemented three times; popover chrome five ways
  with five different shadows; the up/down tone colors exist as **five different
  green/red pairs** (`#29b878/#e05454` ×61, plus `#16845b/#d24242`,
  `#16875f/#c64747`, `#28a873`, and the profit-pill pair `#087451/#b83131`).
  Audit correction (wave 2): the original sweep flagged `.profit-pill`/
  `.profit-positive`/`.profit-negative` as dead — they are live (the scalper
  columns) and were kept.
- **Tokens defined but unused**: `--control-height` and `--control-radius` have zero
  consumers while their literal values appear 3× and 27×; `.16s` appears 58× beside
  `--motion-fast`; 21 literal focus outlines beside `--focus-ring`. 17 distinct
  breakpoint pairs exist, including an overlapping `max-width:760px` vs
  `min-width:760px` seam.
- **Bugs found**: dark-mode `.price-basis button.active` rendered `#111827` text on
  a transparent dark background (globals' dark rule vs market-views' later
  transparent override — fixed on this branch); `.section-aside` is `display:none`
  below 760px because of the broad `.section-heading>span` rule, so phone users lose
  the ranked/updated stats (queued as a decision — hiding may or may not be
  intended).

## Backend and data-layer findings

### Three "catalog repositories"

| File | Actual role |
|---|---|
| `app/data/catalog-repository.ts` | The `CatalogRepository` **interface** + in-memory implementation + the whole `getDetail` payload builder |
| `app/data/feed-catalog-repository.ts` | Loader/decorator: fetches `/data/*.json`, builds a memory repo, wraps `getDetail` with enrichment cache |
| `db/catalog-repository.ts` | D1 adapter — which loads full result sets and **delegates querying back to the memory repo** |

Hazards: two files share the basename `catalog-repository.ts` and
`app/data/load-detail.ts` imports both (lines 2 and 7); `readSectionFeed`/
`readSealedFeed` live in the *D1* file despite the "feed" name; unit conversion is
duplicated as inverse pairs (`dollars`/`percent` in `db/catalog-repository.ts:48-49` vs
`toCents`/`toBasisPoints` in `db/repository.ts:15-16`). `app/data/metrics-service.ts`
(~200 lines of raw SQL, the largest SQL surface in the repo) is a `db/` module wearing
an `app/data/` name.

### Duplicated orchestration

- `worker/staging-jobs.ts` vs `worker/scheduled-ingestion.ts`: the five job-dispatch
  bodies plus the asset-fetch helper are ≈35 duplicated lines (~55% of each function).
  A job registry (`Record<JobName, {defaultBatch, run}>`) collapses both callers.
- Inside `db/`, five runners re-implement the same checkpoint skeleton
  (cursor read → stats parse → clamp → slice → checkpoint → complete-or-fail): four
  independent `parseStats` helpers, four clamps, four identical failure tails
  (`daily-ingestion.ts:142-175`, `live-ingestion.ts:101-159`,
  `history-backfill.ts:20-57`, `detail-ingestion.ts:22-50`).

### Pure logic duplicated between `.mjs` scripts and TS

- **Sealed taxonomy exists twice.** `sealed-product-utils.mjs` emits one vocabulary
  (Riftbound: "Boosters", "Booster boxes", "Decks"…); `app/data/catalog-query.ts:82-115`
  defines the canonical list plus `categoryAliases` — a bridge that exists only because
  the two normalizers disagree. The "Cases" bucket is a string literal in 4 files.
- **Profit math three times, two roundings.** `scripts/normalize/sealed.mjs:25,38` and
  `scripts/scalper/build-feed.mjs:61,76` round (`.toFixed`); `db/catalog-repository.ts:76,89`
  doesn't — the same product's `profitPct` differs between the bundled feed and the D1
  feed in the last decimal.
- **`compactGrades`/`money`/`count` duplicated verbatim** (~24 lines):
  `scripts/graded/sync-graded.mjs:23-44` ↔ `db/graded-ingestion.ts:13-36`.
- **Retry policy is accidental.** `scripts/clients/http-json.mjs` is the only retry
  implementation; call sites that didn't happen to import it (`probeTcgcsvUpdatedAt`,
  graded fetch, Alpha Vantage, feed asset loads) have none.

### API route divergence (6 routes)

Four response shapes (flat-with-source, bare, `{rows}` wrapper, ready-envelope), six
distinct `Cache-Control` literals plus two more in `worker/live-feeds.ts`, the
`env.DB as unknown as D1DatabaseLike` cast repeated 5×, three import-extension styles
(`.ts`, extensionless, both mixed in `api/history/route.ts`), and **four different
definitions of "D1 is ready"** (`readyDatabaseCatalog` count check; one or two
`publishedIngestion` keys; bare `publishedIngestion(db)`). `api/signals` returns
**200 `{ready:false}` on exception** — a D1 outage is indistinguishable from "no data
yet" to the client.

## Test blast-radius map

Which tests execute behavior (safe under refactor) vs regex-pin raw source text
(break on any move/reformat):

| Test | Pins | Nature |
|---|---|---|
| `rendered-html.test.mjs` | **45 files, 213 regex assertions** — components, CSS, hooks, API route bodies, `sync-tcgcsv.mjs` | String pin (dominant refactor tax) |
| `scalper-mode.test.mjs` | `page.tsx`, `SealedView.tsx` (14 pins) | Mixed — 4 behavioral tests + pins |
| `css-architecture.test.mjs` | `layout.tsx` import order + 6 stylesheets (24 pins) | String pin |
| `maintainer-docs.test.mjs` | docs, `.gitignore`, exact `package.json` script strings, `research.mjs` | String pin |
| `critical-journey`, `mode-adapter`, `domain-contracts`, `cloudflare-cutover` | none (domain-contracts pins 1 index name) | **Behavioral — the safe zone** |

Consequences: renaming or moving anything pinned requires a coordinated test edit;
`rendered-html.test.mjs:163` even pins the exact text of an expression in
`app/api/catalog/route.ts:24`, so a pure reformat fails the gate. Root scripts
`sync-tcgcsv.mjs`/`sync-sealed.mjs` must keep their paths (pinned via `package.json`
assertions).

## Refactor backlog

### Landed on this branch (`refactor/consolidation`)

- Shared `SlidingTabs` primitive behind `MarketTabs` and `SignalTabs` (one slider
  implementation instead of three near-copies; SignalTabs buttons gain the missing
  `type="button"`).
- Shared `standardHistoryMetrics`/`movementMetric` (HistoryPanel) replacing the
  4-way copied popover tile list; per-surface unavailable labels preserved.
- Shared `useHistoryOnce` hook replacing the line-identical `useDetailHistory` /
  `useMoverHistory` pair.
- Shared `PerPageSelect`, `LeaderboardSearch`, `useFavoriteScope`, `useSetGroups`,
  `formatFullDate` replacing pairwise copies in the two page files.
- Deleted the dead `marketStrip` prop surface (MarketLeaderboard) and the
  unreferenced `positionRowPopover` DOM helper (making `market-utils.ts` DOM-free —
  the prep for a Worker-safe `core/`).
- `try/catch` around every remaining raw `localStorage` access (page.tsx was the
  only surface that could throw; TopBar/metrics/buylist/detail hydrates hardened
  too).
- Detail pages highlight **Cards** in the top bar (was an out-of-union value that
  never matched).
- CSS: deleted the 22-`!important` dead select-chrome block; merged the twin 47-line
  media block in `market-content.css` (narrow-only rules kept scoped); moved the
  generic `--view-count` slider math from `metrics.css` into the slider's own rules
  in `market-views.css` (removing the hidden cross-page dependency); fixed the
  dark-mode price-basis contrast bug.
- API route import extensions normalized (`catalog/detail`, `history`).
- Docs: this audit, [helicopter-view](helicopter-view.md),
  [refactor-decisions-pending](refactor-decisions-pending.md), and a de-staled
  [architecture.md](architecture.md).
- Test pins updated deliberately alongside: per-page labels, the 90-day movement
  contract (now asserted in HistoryPanel), and the signal-slider markup pin (now
  asserted in SlidingTabs).

### Landed in wave 2 (same branch)

- **Dead-CSS families sweep**: `.market-strip` (incl. its multi-select block), the
  profit lab (`.profit-tools`/`.sealed-kpis`/`.input-*`/`.check-control`),
  `.mode-tabs`, `.game-switch`, `.touch-open`, old sealed controls/search/view-row,
  `.sealed-checks`/`.sealed-core-filters`/`.sealed-assumptions`/
  `.sealed-market-strip`, `.sealed-history-*`, `.ranked-stat`, `.category-rail` —
  every family independently re-verified by grep before deletion (which caught the
  profit-pill false positive above). ~13,000 chars and ~55 `!important` removed.
- **`db/ingestion-batch.ts`**: shared stats parsing, batch-size clamps, resume-read,
  and failure tail across all five runners. The runners' loops deliberately stay
  separate — integer cursors, chunk cursors, and the live `group:offset` budget walk
  are genuinely different machines.
- **Worker job runners**: one exported implementation per job body in
  `staging-jobs.ts` (`runLiveJob`…`runHistoryJob`), shared by the ops adapter and
  the cron tick; the triple asset-fetch helper is now one `fetchAssetJson`.
- **`FullViewCardWrap`** replacing the copied full-view badge/star/link wrapper.
- **Sealed sort fix**: clicking the displayed-active column right after leaving
  scalper mode now toggles its direction instead of restarting at descending
  (`changeSort` compares against `effectiveSort`).
- **Adversarial verification pass**: four independent verifiers (ingestion
  runners, worker jobs, CSS sweep, frontend fixes) attempted to refute
  behavior-preservation. Verdict: preserved, no must-fix findings. Two of their
  observations were applied before commit — `groupFetchCap` keeps its historical
  un-floored clamp, and two leftover dead `.sealed-controls input` selector arms
  were pruned from live rules. Accepted divergences on record: unified
  "Asset source … unavailable" error text in ingestion diagnostics, invalid ops-job
  names now 400 without pre-loading the snapshot (improvement), and fractional
  graded budgets are floored in `stats_json` (fetch/spend behavior identical).

### Ready to execute — safe, no decision needed

1. **Fallback-candidates + prefetch extraction** (page/SealedView, ~20 lines —
   parallel-but-divergent, needs parameterizing the two variants).
2. **Dead-by-cascade grid template deletions** in globals (verified winners in later
   sheets) — pair with Playwright screenshots at 620/760/900/1000px.

### Behavior-adjacent — do with a dedicated gate loop

- `useCatalogHistory` bundling the history/signals hook stack (R3 — 6 pins).
- `useSortState` unifying the page/sealed sort handlers (R6 — 4 pins).
- `usePreference` hook replacing the 4-site strictness hydrate/write copies (D15).
- Market option catalog module unifying page vs metrics tab lists (R14 — 2 pins).
- SealedView dropping its `tcg-index.json` import + duplicate freshness fetch (R15).
- `MarketTabs` rendering no selection when value ∉ options (R19 — fixes the
  one-frame "All highlighted, Pokémon data" flash).
- The `.set-filters>div` hijack fix + dropping the 64 arms-race `!important`
  (CSS S7/S8 — highest value/risk ratio in the CSS queue).

### Needs a decision first

See [refactor-decisions-pending.md](refactor-decisions-pending.md): the `core/`
layer (D1), `.mjs`→TS conversion incl. the `compactGrades` verbatim duplicate (D2),
sealed taxonomy unification (D3), metrics SQL relocation (D4), D1 SQL pushdown (D5),
API response/readiness standardization (D6), the `rendered-html.test.mjs` strategy
(D7 — highest leverage), fetch/retry policy (D8), Sites rollback artifacts (D9),
`scalping` rename (D10), sealed state lifting (D11), URL contract gaps (D12),
scalper-mode ownership (D13), MetricsView URL codec (D14), `usePreference` (D15).
