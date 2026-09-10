# eBay integration and marketplace links — implementation plan (2026-09-04)

**Status 2026-09-10.** Tiers A and B are live. Tier C's first rotation-based version shipped
on 2026-09-05, but the production strategy is now superseded by the cost-efficient option A
implementation on `EnhancementTrial`: a lazy `/api/ebay/listings` detail-page request, hard
six-hour D1 snapshots, an atomic 4,000-call daily interactive budget, per-product leases,
and an image listing grid. Production cron no longer dispatches the catalog-wide rotation.
Migration 0018 and the Worker secrets still require the validated deployment; credentials
are never stored in this repository. The required account-deletion callback is implemented
at `/api/ebay/account-deletion` with GET challenge handling, signed POST validation, and a
one-hour eBay public-key cache. Tier D's PokemonPriceTracker upgrade remains open.

**Live listings on every page — decided 2026-09-09: option B rejected, option A is the
target.** Option B, an EPN Smart Placement in the eBay panel (eBay-rendered cards under
eBay's "Ad" label, keyed by our search query), was tried on staging and pulled the same
day because ad blockers hide it. Option A — a Browse-API grid with images, Listings/Graded
tabs with counts, and an on-demand fetch cached for six hours under a daily call budget so
card and sealed pages show listings for real visitors. The search and sold links stay either
way.

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
| C. eBay active-listing snapshot (O2 API half) | On-demand Browse request after the detail grid nears the viewport; six-hour `ebay_listings` cache; image grid; shared D1 call budget and lease | Worker secrets `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | fresh view: 1 PK read; stale view: bounded target/budget/lease reads plus one snapshot write; ≤ 4,000 Browse calls/day |
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
name, set, number, section})}`; the eBay query rules — game word first, no set codes, commas,
or ampersands, collector number for Pokémon only — live in `core/domain/marketplace-links.ts`.
Single-card searches also resolve a language there: English by default, Japanese for the
Japanese-promo section/number families, and an explicitly named language for multilingual
promos. The Browse request sends that value as eBay's category-specific `Language` aspect,
and outbound search/sold links carry the equivalent facet.)

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
- As built, `ebayAffiliateUrl` now places the campaign, US market, event, channel, and tool
  parameters directly on every search/sold URL; Smart Links remains a catch-all rather than
  the sole attribution path. Browse calls send `affiliateCampaignId` plus the product-scoped
  `affiliateReferenceId`; returned `itemAffiliateWebUrl` wins, and raw `itemWebUrl` is tagged
  locally as a defensive fallback.
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
  `samples_json` text NOT NULL DEFAULT '[]', -- up to 50 normalized listings from the first Browse page
  `fetched_at`   text NOT NULL,
  `updated_at`   text NOT NULL               -- YYYY-MM-DD, the rotation's staleness key
);
CREATE INDEX `idx_ebay_listings_updated` ON `ebay_listings` (`updated_at`);
```

Aggregates plus the normalized first Browse page, not full listing payloads. The larger JSON
row is the storage/response-size tradeoff that makes pagination free of additional eBay
calls. Snapshots expire after six hours; confirm any future retention-policy change against
eBay's API licence before extending that lifetime.

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

### C3. On-demand resolver — `db/ebay-ingestion.ts`

- A fresh D1 snapshot returns without an eBay call. A stale or missing product resolves its
  current catalog identity and market price, then performs one Browse search.
- `ebay_api_usage` admits at most 4,000 on-demand calls per UTC day with one atomic
  `INSERT ... ON CONFLICT ... WHERE ... RETURNING` statement. This preserves 1,000 calls of
  headroom inside the default 5,000-call allowance.
- `ebay_fetch_leases` gives one caller a 30-second product lease. Concurrent misses return a
  short retry signal instead of duplicating the search. The resolver rechecks the cache after
  winning the lease to close the race.
- Migration 0018 adds `accepted_count`, `expires_at`, the quota table, and the lease table.
  Existing snapshots expire immediately because their original fetches predate this policy.
- The former rotation helper and `{"job":"ebay"}` staging adapter remain for deliberate
  operator trials. The scheduled action and production cron dispatch are removed.

### C4. Read path and interface

- The cached server-rendered detail payload no longer embeds eBay data. `EbayMarketPanel`
  uses an `IntersectionObserver` to request `/api/ebay/listings?productId=` only as the panel
  nears the viewport.
- The route is `private, no-store`. It returns a fresh/refreshed snapshot, `202` plus a short
  retry interval when another request owns the lease, `429` at the local daily ceiling, and
  an honest unavailable response on configuration or upstream failure. It never returns an
  expired snapshot.
- The responsive grid retains up to 50 image cards with title, ask, shipping, condition,
  and the eBay-provided affiliate URL. It paginates the cached array at five per desktop page
  and three per mobile page. Aggregate lowest/median asks require at least three accepted
  results. The UI identifies the total result count, accepted sample count, exact UTC fetch
  time, six-hour lifetime, and asks-not-sales limitation.
- Hover and board eBay figures remain deferred. A batch endpoint is unnecessary until such a
  surface is approved.

### C5. Cost and quota model

| Event | D1 work | eBay calls | Notes |
|---|---|---|---|
| Detail grid inside six hours | one snapshot PK read | 0 | page HTML remains independently cacheable |
| First stale detail grid | snapshot + target + quota/lease checks; one snapshot write | 1 | one call supplies aggregates and up to 50 pageable cards |
| Listing-grid page change | 0 | 0 | slices the cached first Browse page in the browser |
| Concurrent stale views of one product | snapshot + failed lease checks | 0 for losing callers | callers retry after the winning refresh |
| Section feed / page render above the fold | 0 eBay-specific work | 0 | no feed joins and no server-rendered eBay lookup |

The hard ceiling is 4,000 on-demand Browse calls per UTC day. Actual spend is bounded by
distinct products whose eBay panel reaches the viewport after their six-hour snapshot
expires, not by page requests or catalog size.

### C6. Failure behaviour

- Missing credentials → `503`; the panel keeps its ordinary search and sold-search links.
- Token/auth failure → `503`; eBay rate limiting or the local daily ceiling → `429`; other
  upstream failures → `502`. The UI exposes a retry control without substituting stale data.
- Ambiguous matches remain inspectable through the query and samples. The price guard removes
  obvious lots/proxies, and active asks never enter modeled fair value or signals.

## Tier D — sold comps without eBay's closed APIs (superseded)

- Do not upgrade PokemonPriceTracker. Its partial graded/raw completed-sale path is scheduled
  for rollback-safe removal under `pokemonpricetracker-removal-plan-2026-09.md`.
- Keep eBay Browse data strictly as active asks. Do not relabel it as sold comps or feed it
  into modeled fair value and signals.
- Do not build: sold-page scraping, logged-in session automation, third-party "sold API"
  resellers (they are one of the three things the login-wall report describes).

## Sequence and estimates

| Step | Wave | Status | Blocked on |
|---|---|---|---|
| A1–A5 links in hover charts + eBay search link | 16 | shipped `d7de3b9` (2026-09-05, production `ea6fdbaf`); tiles moved under the artwork with an eBay tile in `6e5e6f0` | — |
| B affiliate tagging + disclosure | 16b | shipped: TCGplayer Impact links `2ffe444` (production `7132dd9e`), EPN Smart Links `6e5e6f0` (production `9f30fee8`) | — |
| C1–C3 original schema, client, rotation, ops job | 17 | shipped `d7de3b9`; migration 0016 applied to production, staging, and local; automatic rotation later superseded | — |
| C3–C6 on-demand quota/lease, route, lazy image grid | 17b | implemented on `EnhancementTrial`; migration 0018 and production activation pending | validated deploy, migrate, attach Worker secrets, smoke-test one card and one sealed page |
| C7 account-deletion compliance callback | 17b | implemented on `EnhancementTrial`; registration pending | attach `EBAY_DELETION_VERIFICATION_TOKEN`, exempt the exact path from managed challenges, pass eBay's GET challenge and test POST |
| D PPT tier | — | open | purchase decision (user, todo O4) |

Activation order: pass the full release gate, commit and push the exact source, deploy the
Worker, apply migration 0018, attach the three production Worker secrets without echoing them,
add an exact-path Cloudflare security exception for the signed compliance callback, complete
eBay's endpoint challenge and test notification, then smoke-test one card and one sealed
product. Do not add `ebay-listings` to `PUBLISH_KEYS`:
the no-store client island is intentionally independent of cached page HTML.
