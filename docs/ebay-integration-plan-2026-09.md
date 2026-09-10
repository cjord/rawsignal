# eBay integration and marketplace links — implementation plan (2026-09-04)

**Status 2026-09-10.** Tiers A and B shipped (commits `d7de3b9`, `2ffe444`, `6e5e6f0`;
production `9f30fee8`): TCGplayer and eBay tiles under the artwork of every popover, the
Impact affiliate wrapper on every TCGplayer link, EPN Smart Links loaded from the root
layout, `rel="sponsored"` on the anchors, and the disclosure in both footers. Tier C is
partly shipped: the `ebay_listings` table (migration 0016), Browse client, rotation job,
cron action, ops job, and the detail-page eBay panel exist, and the panel shows the
PokemonPriceTracker raw eBay sale as the sold data point (tier D's display half). Still
open in C: the hover route `/api/ebay/listings` (C4) and adding `ebay-listings` to
`PUBLISH_KEYS` (C3). Blocked on the user: the eBay developer keyset (`EBAY_CLIENT_ID`,
`EBAY_CLIENT_SECRET`) so the rotation fills the table; tier D's PokemonPriceTracker tier
upgrade (todo O4).

**Live listings on every page — decided 2026-09-09: option B rejected, option A is the
target.** Option B, an EPN Smart Placement in the eBay panel (eBay-rendered cards under
eBay's "Ad" label, keyed by our search query), was tried on staging and pulled the same
day because ad blockers hide it. Option A — a Browse-API grid with images, Listings/Graded
tabs with counts, and an on-demand fetch cached a day under a daily call budget so every
card and sealed page shows listings for real visitors — waits on the keyset. The search
and sold links stay either way.

Scope: todo §O1 (affiliate tagging), §O2 (eBay links and data), and the new §O3 (a
TCGplayer link inside every hover chart). Written after the wave 14–15 D1 audit
(review §15), so every step carries its D1 cost in the same units (`rows_read` per event).

Facts this plan rests on (verified 2026-09-04; re-check the flagged ones at implementation):

- Every catalog row already carries its TCGplayer URL: `catalog_products.source_url` is set
  on all 18,361 production rows and is the exact `/product/<id>/<slug>` form on 18,355 (the
  six exceptions are supplemental sealed products with search-style URLs). The domain types
  expose it as `Card.url` / `SealedProduct.url`, and the bundled fallback feeds carry `url`
  too. `https://www.tcgplayer.com/product/<productId>` is canonical and redirects to the
  slug form, so a product id alone is enough for a link.
- eBay Browse API (`item_summary/search`) is open to any developer keyset with a default
  limit of 5,000 calls a day per application; higher limits need eBay's Application Growth
  Check. It returns **active listings** (asks), never sales. Application tokens come from the
  client-credentials grant (`POST https://api.ebay.com/identity/v1/oauth2/token`, scope
  `https://api.ebay.com/oauth/api_scope`) and live 7,200 s.
- eBay sold data is closed: the Marketplace Insights API is a limited release "not open to
  new users", Terapeak has no API, and since late August 2026 the public sold/completed search
  (`LH_Sold=1`, `LH_Complete=1`) redirects signed-out visitors to sign-in (one published
  report, verified 2026-08-30 — re-check before relying on it). Active-listing searches still
  render signed out. We do not scrape and do not automate logged-in sessions.
- eBay Partner Network (EPN) links are plain URL parameters:
  `&mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=<campaign id>&toolid=10001&customid=<sub id>`
  (US rotation id shown). *Flag:* the Browse API can return `itemAffiliateWebUrl` when the
  request carries `X-EBAY-C-ENDUSERCTX: affiliateCampaignId=<campid>` — confirm the header
  syntax in the Browse reference before use.
- The eBay sold-price signal we already have: PokemonPriceTracker's `salesByGrade.ungraded`
  is eBay completed sales for raw cards, stored in `graded_prices` for the top-600 rotation
  pool and rendered on the detail page as "Raw (eBay)". That is the realistic sold-comps path
  (todo O4: the ~$9.99/mo tier lifts the 100-credit ceiling).
- Pool sizes in production (current price ≥ $20 / ≥ $50 / ≥ $100): Pokémon singles
  5,379 / 2,868 / 1,522; Riftbound singles 163 / 139 / 89; Pokémon sealed 1,745 / 1,285 / 914;
  One Piece sealed 252 / 178 / 131; Riftbound sealed 42 / 30 / 20. Total ≥ $20 ≈ 7,600.

## Tiers

| Tier | What ships | External dependency | D1 cost |
|---|---|---|---|
| A. Links (O3 + O2 link half) | TCGplayer link in every hover chart and full-view card; eBay active-listings search link on the detail page and in the hover charts | none (EPN campaign id optional) | **0 additional rows read** |
| B. Affiliate tagging (O1) | One link builder tags TCGplayer (Impact template) and eBay (EPN parameters); disclosure line | program approvals: EPN, TCGplayer/Impact (user) | 0 |
| C. eBay active-listing snapshot (O2 API half) | Daily cron rotation over the ≥ $20 pool via the Browse API → `ebay_listings`; detail-page panel; hover tile; `/api/ebay/listings` | eBay developer keyset (user); secrets `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | +1 row per detail view, +1 row per first hover reveal; ≤ 1,500 row writes a day |
| D. Sold comps | Widen the PokemonPriceTracker rotation; surface "Raw (eBay)" in the hover for covered cards | PPT tier upgrade (user, todo O4) | 0 new reads (the detail page already reads `graded_prices`); +1 PK row per hover reveal if surfaced there |

Order: A → B → C. D is a purchase decision, not code. Sold comps through eBay's own APIs are
not available to us; the plan does not pretend otherwise.

## Tier A — links (one wave, no data changes)

### A1. Shared link builder — `core/domain/marketplace-links.ts` (pure)

```ts
export type MarketplaceLinks = { tcgplayer: string; ebay: string; ebaySold?: string };
export function tcgplayerProductUrl(productId: number, sourceUrl?: string | null): string
  // exactTcgplayerUrl(sourceUrl) ? sourceUrl : `https://www.tcgplayer.com/product/${productId}`
export function ebaySearchUrl(item: { kind: "single" | "sealed"; name: string; set: string; number?: string }, campaign?: EpnCampaign | null): string
  // https://www.ebay.com/sch/i.html?_nkw=<name set number>&_sacat=<183454 singles | sealed category>&LH_BIN=1  (+ EPN params when a campaign is configured)
export function withEpn(url: string, campaign: EpnCampaign, customId: string): string
```

- `exactTcgplayerUrl` already exists in `core/domain/detail.ts`; the builder reuses it.
- Query text: singles `"<name>" <set> <number>` (quotes keep multi-word names together; the
  number disambiguates reprints); sealed `<name> <set>`. Category ids: 183454 is "CCG
  Individual Cards" (confirmed); the sealed category (261044 appears as "Pokémon TCG Sealed
  Boxes" on eBay's browse pages) must be confirmed against the Taxonomy API before shipping —
  if in doubt, omit `_sacat` for sealed and rely on the query.
- The sold-listings URL (`&LH_Sold=1&LH_Complete=1`) is built only for the detail page and is
  labelled "eBay sold (sign-in) ↗" because of the login wall.
- Tests (`tests/marketplace-links.test.mjs`): exact source URL preferred, id fallback,
  search URL escaping (`&`, `'`, `é`), EPN parameters present only with a campaign, custom id
  equals the product id, sold URL only when asked.

### A2. Hover chart link slot — as built: `app/leaderboard/HistoryPopover.tsx`

*As built (2026-09-09):* the slot is a `links?: HistoryMetric[]` prop on `HistoryPopover`,
rendered as `<span className="hover-card-links">` under the artwork (not after the stats),
with two tiles from `marketplaceLinkMetrics(productId, sourceUrl, item)` — TCGplayer and an
eBay buy-it-now search — each `target="_blank" rel="noopener noreferrer sponsored"`.
`HistoryPanel` only gained anchor rendering for metrics that carry `href`. The original
proposal follows for the record: an optional `links` prop rendered after `.history-stats`
(`target="_blank" rel="noopener noreferrer"`; affiliate links add `sponsored`). The popover already sits above
the row's cover link (`.market-row-popover` z-index 6 over `.market-row-detail-link` z-index
4) and outside the `<summary>`, so a click in the slot neither toggles the disclosure nor
navigates the row. On touch the popover opens on tap and the links are ordinary tappable
anchors; the existing "View details →" button stays.

Style: a single row of two small pill links matching `.pricecharting-button` on the detail
page; hidden when `links` is empty. Reduced motion and dark theme need nothing new.

### A3. Wire the six surfaces

(As built, every surface passes `links={marketplaceLinkMetrics(productId, url, {kind, game,
name, set, number})}`; the eBay query rules — game word first, no set codes, commas, or
ampersands, collector number for Pokémon only — live in `core/domain/marketplace-links.ts`.)

| Surface | File | Source of the URL | Notes |
|---|---|---|---|
| Singles leaderboard popover | `app/page.tsx` `HoverCard` | `card.url` / `card.productId` | pass `links={marketplaceLinkMetrics(…)}` |
| Full-view card (chart inline) | `app/page.tsx` `FullCard` | same | the large panel gets the same slot |
| Sealed leaderboard popover | `app/SealedView.tsx` `rowDetails` | `product.url` / `product.productId` | scalping market included |
| Detail tables (chase cards, related sealed) | `app/detail-tables.tsx` | `card.url`, `product.url` | |
| Metrics movers | `app/MetricsView.tsx` `MoverRow` | `mover.productId` (no `url` on `MetricsMover`) | id-form link; optionally add `p.source_url` to `loadMovers` — a column, not a row |
| Collectr import table | `app/CollectrImportView.tsx` | `match.productId` | id-form link |
| Detail page hero | `app/ProductDetailPage.tsx` `detail-actions` | `detail.url` (already linked) | add the eBay button beside PriceCharting |

The architecture rule "rows and artwork are non-navigational; a marketplace action can be
added later as an explicit button" is satisfied: the links are explicit buttons inside the
inspection popover, never on the row itself. Amend the sentence in `docs/architecture.md`
§Reliability boundaries to say so.

### A4. Gate

- Node tests: the builder tests above; a `HistoryPanel` render test is unnecessary (no
  DOM tests in this repo) — the Playwright journey covers it.
- Playwright (`tests/e2e/critical-ui.spec.ts`): hover the first leaderboard row, assert the
  popover contains an anchor whose `href` matches `^https://www\.tcgplayer\.com/product/\d+`
  and one whose host is `www.ebay.com`; with hover previews off, assert no popover renders
  (existing behaviour, unchanged).
- `npm run check` with the :3000 dev server stopped.

### A5. D1 cost of the hover-chart TCGplayer link — zero

`rows_read` counts rows and index entries scanned, not columns returned. Every hover surface
already has the data it needs in memory:

| Surface | Today's reads behind the popover | Added by the link |
|---|---|---|
| Leaderboard / sealed rows | feed query already selects `p.source_url` (18–24 k rows per uncached section feed, route-cached 5 min per colo) | 0 |
| Detail tables | set-scoped rows already carry `url` | 0 |
| Metrics movers | `loadMovers` scans `catalog_products p` already; `p.source_url` would be an extra column | 0 (id-form link needs nothing at all) |
| Collectr import | matches carry `productId` | 0 |
| The reveal itself | one `/api/history` ≈ 85 rows (mean 89 observations per product; route-cached 1 h per colo), or nothing when already loaded | 0 |

No new route, no new query, no new table. The bundled fallback feeds also carry `url`, so the
non-D1 deployment renders the same links. Daily D1 volume is unchanged by the links (the
current baseline and its crawler-driven swings are tracked in todo Q9/S2, not here).

If the eBay link is later rendered with data (tier C) the costs are in C5 below.

## Tier B — affiliate tagging (half a wave once the credentials exist)

- Configuration: `EBAY_EPN_CAMPAIGN_ID` (a public identifier that appears in every outbound
  URL, so a Worker var, not a secret) and `TCGPLAYER_IMPACT_TEMPLATE` (the Impact tracking
  URL with a `{url}` placeholder, if TCGplayer's programme issues one). Both are read
  server-side in the root layout and handed to the client as a `data-links` JSON attribute
  on `<body>` (one place; no bundle constant). Neither value is committed.
- `withEpn` appends the parameters from A1; `customid` = product id so EPN reports say which
  products convert. The TCGplayer template wraps the product URL.
- Links carrying a tag get `rel="noopener noreferrer sponsored"`.
- Disclosure: one sentence in `app/SiteFooter.tsx` and the methodology section, rendered only
  when a campaign is configured ("As an eBay Partner, Raw Signal may earn from qualifying
  purchases.") — EPN's terms require it.
- Alternative considered and not recommended: a `/go/ebay/<id>` redirect route would hide
  the campaign id and count clicks, at the price of a Worker invocation per click and a PK
  read to rebuild the query; the id is public anyway.
- User actions: EPN sign-up (needs the live site), TCGplayer affiliate application (Impact).

## Tier C — eBay active-listing snapshot (two waves)

### C1. Storage — `db/schema.ts` + `drizzle/0016_ebay_listings.sql`

```sql
CREATE TABLE `ebay_listings` (
  `product_id`   integer PRIMARY KEY NOT NULL REFERENCES `catalog_products`(`product_id`) ON DELETE cascade,
  `query`        text    NOT NULL,           -- the search string sent, for auditing matches
  `category_id`  integer,
  `listing_count` integer NOT NULL,          -- eBay's `total` for the filtered search
  `lowest_cents` integer,                    -- lowest fixed-price ask inside the price guard
  `median_cents` integer,                    -- median of the returned asks (≤ 50)
  `samples_json` text NOT NULL DEFAULT '[]', -- up to 5 {itemId,title,cents,url,shipping,condition} for the panel (shipped as EBAY_SAMPLE_COUNT = 5)
  `fetched_at`   text NOT NULL,
  `updated_at`   text NOT NULL               -- YYYY-MM-DD, the rotation's staleness key
);
CREATE INDEX `idx_ebay_listings_updated` ON `ebay_listings` (`updated_at`);
```

Aggregates plus three sample items, not full listing payloads: keeps the row ≈ 1 KB (7,600
rows ≈ 8 MB) and stays well inside eBay's API licence on caching listing content (*flag:*
confirm the retention terms in the licence before storing samples for more than a day; if
they forbid it, store aggregates only).

### C2. Client — `core/clients/ebay-browse.ts` (fetch) + `core/ebay-summary.ts` (pure)

- Token: client-credentials mint, cached in module memory per isolate with its expiry;
  at most one mint per tick. Secrets `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` via
  `wrangler secret put` (production only; staging keeps none and runs the job by hand).
- Search: `GET /buy/browse/v1/item_summary/search?q=<query>&category_ids=<id>&filter=buyingOptions:{FIXED_PRICE},conditionIds:{<4000 singles|1000 sealed>},priceCurrency:USD,price:[<0.25×market>..<4×market>]&sort=price&limit=50`
  with `X-EBAY-C-MARKETPLACE-ID: EBAY_US` and, once B ships, the affiliate context header.
  The price guard around the TCGplayer market price drops lots, proxies, and mispriced
  listings before they reach the median; the query mirrors A1 so the link and the data agree.
- `summarizeListings(items, market)` is pure and fixture-tested: lowest, median, count,
  samples; returns `null` when fewer than 3 listings survive (thin markets render "N/A", never
  a number built from one ask).
- Honest labelling everywhere: "eBay asks (active listings)" — the AGENTS rule that listing
  prices are never described as sales applies; the panel says "asks", the tile says "eBay low
  ask", the note names the fetch date.

### C3. Rotation job — `db/ebay-ingestion.ts`, modelled on `runGradedRotationBatch`

- Pool: `catalog_products ⋈ current_prices` where `market_cents ≥ 2000`, left-joined to
  `ebay_listings`, stalest first (never-fetched sorts ahead), ≈ 7,600 products.
- Budget: `EBAY_DAILY_BUDGET = 1,500` (30 % of the 5,000 default, leaving room for retries and
  the token mints) split into ticks of `EBAY_TICK_CALLS = 40` with 250 ms spacing (≈ 20–25 s
  wall per tick, far inside the 1,000-subrequest limit; fetch wall time is not CPU time).
  1,500 a day refreshes the pool every ≈ 5 days; a ≥ $50 pool (≈ 4,500) every 3. Stop on 429
  or on the rate-limit headers; five consecutive HTTP failures end the run as `http-<status>`.
- Run identity `ebay-listings:<today>`, checkpointed by cursor in `refresh_state` like the
  history run, so the day's calls spread across ticks; completion writes `last_success_at`.
- Cron policy (`worker/scheduled-decision.ts`): new action `"ebay"` **after** the history
  gate — as built, `ebayKeyConfigured && ebayPublishedRunId !== ebayTodayRunId`, relying on
  statement order rather than an explicit `historyDoneForLive` conjunct: the live, details,
  graded, metrics, and history gates all return first when due, so eBay takes only idle
  ticks (≈ 40 a day) once the daily chain has landed. One consequence: with no published
  live run at all, the metrics/history gates are skipped and eBay can claim the tick.
  Tests: policy table rows for "not configured", "history still running", "run due",
  "run complete".
- Ops: `__ops/staging-jobs` gains `job: "ebay"` for staging trials (staging stays cheap: no
  cron, secrets set only for the trial and removed after).
- Publish signature: add `ebay-listings` to `PUBLISH_KEYS` so detail pages re-render after a
  run completes (one signature change a day; without it the 36 h page cache would serve
  yesterday's asks). **Not yet done** — `worker/page-signature.ts` still lists five keys;
  do it when the keyset lands and the rotation starts writing.
- `docs/data-ingestion.md`: a section on the rotation, its budget, and how to read
  `ingestion_runs` stats (`targets`, `updated`, `calls`, `stopped`).

### C4. Read paths

- Detail page: `getDetail` adds `readEbayListings(db, productId)` to its `Promise.all`
  (one PK row) and renders an "eBay asks" panel beside the graded section: lowest ask,
  median ask, listing count, five sample listings (affiliate-tagged by Smart Links), fetch
  date, and the search link from A. Cards outside the pool render the link only. *(Shipped.)*
- Hover charts: `GET /api/ebay/listings?productId=` (PK lookup, `CACHE_TIERS.hour`, route
  edge cache) fetched by `usePriceHistoryBatch().ensure`'s sibling on first reveal; the panel
  appends one tile, "eBay low ask", when data exists. Keeping it out of `/api/history` leaves
  the `PriceHistory` contract untouched.
- Boards (optional, later): a `/api/ebay/batch?ids=` 40-id route mirroring the history batch
  if an "eBay low" column is wanted; not in this plan's cost table.

### C5. D1 cost

| Event | Rows read today | Added | Notes |
|---|---|---|---|
| Detail view | ~5,000 set-scoped + memoized whole-game | +1 | PK lookup in `Promise.all`; ~2,700 views/day → +2.7 k rows/day |
| First hover reveal of a product (per colo per hour) | ≈ 85 (`/api/history`) | +1 | separate route; bounded above by today's `/api/history` request count |
| Uncached section feed | 18–24 k | 0 | the snapshot is deliberately **not** joined into feeds: a left join would add ≈ 1 row per product row (+9–12 k per feed load, every 5 min per colo per section) |
| Cron tick (ebay) | — | ≈ 40 pool rows + 40 PK upserts | the pool query is `Pg`-scoped (~7.6 k rows) once per run, then cursor-sliced |
| Rows written | — | ≤ 1,500/day | inside the 50 M/month allowance by four orders of magnitude |

Net: well under 0.1 % of the site's daily reads (todo Q9 carries the current figure). The
external constraint is the eBay call budget, not D1.

### C6. Failure behaviour

- No key → the action never fires and every panel renders the search link only.
- Token mint failure → the tick logs `ebay_token_failed` and retries next tick; nothing is
  marked failed until five consecutive search failures.
- Ambiguous matches (query returns another card): the price guard removes most; the panel
  shows the query string and the samples so a reader can judge, and the "eBay asks" number is
  never blended into modeled fair value or signals (roadmap idea only, behind the harness).

## Tier D — sold comps without eBay's closed APIs

- Upgrade PokemonPriceTracker (todo O4) and widen `runGradedRotationBatch`'s pool from 600
  toward the ≥ $20 singles pool; the detail page already renders the raw eBay sale price from
  `graded_prices.grades_json.ungraded`.
- Optionally surface that "Raw (eBay) sold" value as a hover tile for covered cards: +1 PK row
  per first reveal, same route pattern as C4 (or the same route, returning both blocks).
- Do not build: sold-page scraping, logged-in session automation, third-party "sold API"
  resellers (they are one of the three things the login-wall report describes).

## Sequence and estimates

| Step | Wave | Status | Blocked on |
|---|---|---|---|
| A1–A5 links in hover charts + eBay search link | 16 | shipped `d7de3b9` (2026-09-05, production `ea6fdbaf`); tiles moved under the artwork with an eBay tile in `6e5e6f0` | — |
| B affiliate tagging + disclosure | 16b | shipped: TCGplayer Impact links `2ffe444` (production `7132dd9e`), EPN Smart Links `6e5e6f0` (production `9f30fee8`) | — |
| C1–C3 schema, client, rotation, cron policy, ops job | 17 | shipped `d7de3b9`; migration 0016 applied to production, staging, and local | eBay developer keyset (user) before the rotation writes; `PUBLISH_KEYS` entry then |
| C4–C6 detail panel, hover tile, route | 17b | detail panel shipped `d7de3b9`; hover tile and `/api/ebay/listings` open | keyset, one full rotation observed |
| D PPT tier | — | open | purchase decision (user, todo O4) |

When the keyset lands: set the two secrets on production, watch the first
`ebay-listings:<date>` run in `wrangler tail`, then add `ebay-listings` to `PUBLISH_KEYS`.
