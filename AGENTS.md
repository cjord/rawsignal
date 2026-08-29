# AGENTS.md

## Project overview

Raw Signal is a mobile-friendly trading-card market dashboard for raw singles and sealed products. It currently covers Pokémon and Riftbound singles plus Pokémon, Riftbound, and selected One Piece sealed products. Magic: The Gathering support is intentionally paused. The application is a React 19 + TypeScript site built with vinext, developed against the local dev server on port 3000 and published as a Cloudflare Worker.

Keep the product focused on clear market intelligence: sortable leaderboards, historical price movement, Hot Buy/Hot Sell signals, responsive card views, and transparent data provenance. Missing source data must display as unavailable rather than being estimated silently.

## Working conventions

- Use Node.js 24 when available; the declared minimum is Node.js 22.13.
- Use `npm` and preserve `package-lock.json`. Do not switch package managers or add another package-manager lockfile unless explicitly requested.
- Use TypeScript and existing React patterns. Keep components accessible and keyboard-friendly.
- Preserve user changes and unrelated working-tree edits.
- Use `rg`/`rg --files` for repository searches and `apply_patch` for source edits.
- Do not edit build output or tool state in `.next/`, `.vinext/`, `dist/`, `.wrangler/`, or `node_modules/`.
- Do not commit `site-package*.tar.gz` archives. They are deployment artifacts, not source.
- Do not commit Cloudflare account IDs, D1 UUIDs, API tokens, generated Wrangler environment configs, D1 exports, or database backups.
- Prefer small shared utilities and components over duplicated Singles/Sealed implementations.
- Do not add route-level `loading.tsx` files: vinext 1.0.0-beta.2 leaves their Suspense fallbacks unresolved on a cold dev server, freezing the route. Use in-page loading states instead until a vinext upgrade is verified to fix this.

## Repository map

- `app/page.tsx`: application shell and Singles leaderboard orchestration.
- `app/SealedView.tsx`: Sealed leaderboard, calculations, filtering, sorting, and views.
- `app/MarketUI.tsx`: shared pagination, segmented view controls, and sortable headers.
- `app/leaderboard/`: the shared Singles/Sealed leaderboard shell — `MarketLeaderboard.tsx`, `MarketRow.tsx`, `HistoryPopover.tsx`, `FullMarketCard.tsx`, `ProductIdentity.tsx`, `ActiveFilterSummary.tsx`, `LeaderboardHeader.tsx`, `LeaderboardControls.tsx`, and the `mode-adapter.ts` sort/derivation contract. Compose new list behavior here, not in the page files.
- `app/filters/`: filter primitives — `CheckboxGrid.tsx` (+`SearchableCheckboxGrid`), `RangeFilter.tsx`, `FilterButton.tsx`, `FilterActions.tsx`, `selection.ts`, `useDismissibleDetails.ts`.
- `app/HistoryPanel.tsx`, `app/PriceChart.tsx`: shared historical-price presentation and interactive charts.
- `app/CardFilters.tsx`, `app/SealedFilters.tsx`, `app/MultiSelectField.tsx`: filter and multi-select controls.
- `app/SignalControls.tsx`, `app/signal-utils.ts`: Hot Buy/Hot Sell controls and scoring.
- `app/SaleScenario.tsx`: the sale-scenario what-if strip (keep-after-fees, shipping, tax, profitable-only) shared by Scalper mode and the sealed detail page.
- `app/market-utils.ts`, `app/history-utils.ts`: shared search, history, range, concurrency, and popover utilities.
- `app/hooks/useDisclosurePopover.ts`: the shared hover/touch/keyboard disclosure behavior for row history popovers.
- `app/cards/[productId]/`, `app/sealed/[productId]/`, `app/ProductDetailPage.tsx`, `app/detail-route.ts`: product detail pages and their server-route metadata/validation helpers.
- `app/detail-tables.tsx`: the sealed detail page's Chase cards and same-set sealed tables, reusing the leaderboard row shell in Medium/Text views. Chase cards are set cards priced above the set's cheapest plain booster-pack market price (top cards by value when no pack price exists), capped at twelve.
- `core/domain/detail.ts`, `core/domain/detail-metrics.ts`, `app/data/load-detail.ts`: detail formatting, similarity scoring, and the D1 → scalping-feed → generated-feed detail resolution cascade.
- `app/not-found.tsx`: shared 404 surface.
- `core/domain/`: shared market types, runtime feed contracts, and display formatters.
- `core/catalog-query.ts`, `core/catalog-repository.ts`: shared Singles/Sealed query semantics and repository contract.
- `app/data/feed-catalog-repository.ts`, `app/data/catalog-service.ts`: bundled-feed adapter and transport-neutral catalog service.
- `app/data/tcgplayer-history-client.ts`: shared annual/quarterly TCGplayer history loading used by the public API and staging backfill.
- `app/data/usePersistedSignals.ts`, `app/api/signals/route.ts`: persisted Hot Buy/Hot Sell readiness gate and compact signal records.
- `app/data/signal-coverage.ts`: proportional, price-stratified transitional signal sampling.
- `app/state/`: the authoritative Singles/Sealed URL-state parser, serializer, and browser synchronization hook.
- Styles load as a layered chain in `app/layout.tsx`: `app/styles/tokens.css` (design tokens) → `app/globals.css` (original global layout, minified-era) → `app/market-views.css` (later shared view/filter/signal refinements) → `app/styles/market-controls.css` and `app/styles/market-content.css` (extracted shared control and row presentation) → `app/detail.css` (self-contained detail-page styles). Check the whole chain before adding overrides; later files intentionally override earlier ones.
- `app/api/history/route.ts`: normalized TCGplayer market-history access.
- `app/api/catalog/route.ts`: compact catalog query endpoint with D1-readiness checks and bundled-feed fallback.
- `app/api/catalog/detail/route.ts`: JSON detail endpoint mirroring `loadCatalogDetail`; the detail pages currently load directly on the server instead of calling it.
- `db/schema.ts`, `db/repository.ts`: D1 persistence schema and idempotent ingestion/read boundary.
- `db/catalog-repository.ts`: D1 catalog adapter using the shared catalog query contract.
- `db/daily-ingestion.ts`, `db/history-backfill.ts`: idempotent daily snapshots, derived metrics/signals, and resumable history backfill.
- `product_details` (migration `0002`) stores detail-page enrichments read by `db/catalog-repository.ts`, ingested by the checkpointed chunk runner in `db/detail-ingestion.ts` (staging job `details`; guard-cron action `details` once each snapshot's catalog run completes, respecting the foreign key to `catalog_products`).
- `worker/staging-jobs.ts`: staging-only, bearer-protected, checkpointed catalog/history execution adapter. It must remain hidden outside staging and must not gain a production route.
- `drizzle/`: generated, committed D1 migrations and schema snapshots.
- `docs/adr/`: accepted architecture decisions, including the Sites-to-Cloudflare path.
- `docs/architecture.md`, `docs/data-sources.md`: maintained system boundaries and source semantics.
- `docs/roadmap.md`: agreed-but-deferred work (D1 backfill continuation, daily feed scheduling decisions, graded-sync rotation, fair-value peer anchor). Keep it current as items land.
- `docs/design-baseline.md`: aesthetic source of truth; UI changes conform to it or update it deliberately.
- `docs/todo.md`: UI/platform plan of record with resolved decisions.
- `docs/cloudflare-cutover.md`, `cloudflare/environments.json`, `scripts/cloudflare/`: direct-Cloudflare staging contract, generated-config preparation, and catalog parity checks.
- `sync-tcgcsv.mjs`: generates Singles market data and `tcg-index.json` from TCGCSV.
- `sync-sealed.mjs`: generates normalized Pokémon sealed-product data.
- `core/sealed-product-utils.ts`: market validation, deduplication, and product-type classification.
- `core/clients/`, `core/normalize/`, `scripts/validate/`, `scripts/io/`: retrying source clients, pure normalization, validation manifests, and last-good publishing.
- `scripts/graded/sync-graded.mjs`: budgeted PokemonPriceTracker sync producing `public/data/graded-prices.json` (eBay graded-sale snapshots for the most valuable Pokémon singles, stalest-first rotation).
- `scripts/scalper/`: the Scalper allowlist pipeline — `reconcile.mjs` and `build-feed.mjs` produce `public/data/sealed-scalping.json` from `approved-variants.json`, `supplemental-products.json`, and the review process in `docs/scalper-variant-review.md`.
- `scripts/details/`: the detail-feed generator — `build-detail-feeds.mjs` (npm `data:build:details`, IO and flags) and `enrichment.mjs` (pure construction). It rebuilds `public/data/detail-manifest.json` plus `public/data/details/` from the bundled feeds, fetching TCGCSV per-group metadata and printing prices with `--enrich` and pruning stale chunks; `--require-fresh` exits with code 3 when TCGCSV has not published since the last sync.
- `public/data/`: generated market feeds consumed by the application.
- `tests/`: Node test suite covering history, search, rendering, market validation, sealed classification, and signal scoring.
- `.openai/hosting.json`: OpenAI Sites project configuration. Preserve its opaque `project_id`.

## Source control and GitHub

- Local commits are normal workflow. Pushing to GitHub is an external action: never run `git push` (or create remote branches, tags, or pull requests) unless the user explicitly requests a push in the active task.
- A request to publish or deploy the site does not authorize a push, and a push request does not authorize a deployment.
- Never force-push `main`, and never rewrite history that has already been pushed.

## Hosting and environment policy

- The environments of record (2026-08-27 decision, production split completed 2026-08-28) are the local dev server (`npm run dev`, port 3000) and the production Cloudflare Worker `raw-signal` serving `https://rawsignal.cards` (custom domain; its workers.dev URL is disabled), backed by the `raw-signal-production` D1 database. The `raw-signal-staging` Worker (`https://raw-signal-staging.raw-signal-watch.workers.dev`) with its own `raw-signal-staging` D1 is the sandbox and rollback path.
- Staging is deliberately low-priority and low-cost (user rule 2026-08-28): it carries no cron schedule and no daily ingestion, its data goes stale by design, and it is updated only when deliberately testing ingestion changes before they touch production. Production alone runs scheduled ingestion.
- OpenAI Sites hosting is dormant: do not package `site-package-vN.tar.gz` handoffs or publish through Sites unless the user explicitly revives it. Preserve `.openai/hosting.json` (opaque `project_id` included) and the Sites-compatible vinext build as the rollback path — no Cloudflare-only application fork.
- Unless explicitly authorized, do not create or mutate direct-Cloudflare Workers, D1 databases, routes, schedules, secrets, Workflows, Queues, or production bindings. Read-only inspection is acceptable when needed for planning or diagnosis.
- A normal request to publish or deploy Raw Signal means the production Worker: run the full gate, then `node scripts/cloudflare/prepare-deployment.mjs --environment production --route rawsignal.cards --cron "*/2 * * * *"` (production D1 UUID in `RAW_SIGNAL_D1_DATABASE_ID`), inspect the generated `dist/server/wrangler.production.json`, then `npx wrangler deploy --config dist/server/wrangler.production.json`. Staging deploys use `npm run cloudflare:prepare:staging` (staging D1 UUID, no `--cron`). Deploy only when the user asks in the active task — a linked account or an available Wrangler login does not authorize one.

### Current direct-Cloudflare capability

- The linked Cloudflare account runs two Workers with isolated, migrated D1 databases: production `raw-signal` (`rawsignal.cards`, D1 `raw-signal-production`, guard Cron `*/2`, `ENVIRONMENT=production`, workers.dev off) and sandbox `raw-signal-staging` (workers.dev URL, D1 `raw-signal-staging`, no cron, `ENVIRONMENT=staging`).
- Both Workers support the vinext application, static assets through `ASSETS`, D1 through `DB`, Cloudflare Images through `IMAGES`, and Worker version metadata; the `ENVIRONMENT` variable is the behavioral boundary between them.
- `POST /__ops/staging-jobs` is staging-only, bearer-protected, non-cacheable, and checkpointed. Catalog batches are capped at 80 records (the per-invocation binding-call ceiling, identical on every plan); history batches at 60 with six concurrent upstream fetches (sized for the Workers Paid subrequest budget, adopted 2026-08-27); detail-enrichment batches at 10 chunk files; the `live` job walks TCGCSV groups with a record cursor and the `graded` job spends at most its credit budget. Do not expose its token or convert it into a public production API.
- Production D1 was fully seeded 2026-08-28 (fresh backfill: catalog, detail enrichments, history at 97.9%-with-data coverage, graded carry-over, metrics rollup); readiness markers are published and public APIs/feeds serve `source:"database"`. The bundled-feed fallback remains in the build for environments without a seeded database. History batches skip snapshot targets missing from the catalog (`skippedMissingCatalog`) rather than failing — a fresh catalog always drifts from the build-time target snapshot.
- The guard Cron Trigger (`*/2`) runs on the production Worker and advances checkpointed ingestion only when work is due; staging has no schedule. No Queue or Workflow is active. Cutover parity passed 2026-08-28 (all six representative categories, database-backed on both sides) against the pre-cutover `rawsignal.cards`.
- Commissioning pattern (used for the 2026-08-28 split): a new Worker may temporarily deploy with `ENVIRONMENT=staging` and workers.dev enabled so the ops adapter can seed its database, then flip to production shape (custom domain, cron, `ENVIRONMENT=production`, workers.dev off) — the flip itself disables the adapter.
- Landed ingestion slices: live TCGCSV fetch (`db/live-ingestion.ts` — the probe timestamp is the snapshot identity; each publish ingests exactly once) and graded rotation (`db/graded-ingestion.ts` — 90 credits/day against PokemonPriceTracker; the `POKEMONPRICETRACKER_API_KEY` secret exists ONLY on the production Worker, the single spender — do not also run the local graded sync the same day). Peer accumulation is derive-on-read (`db/peer-anchors.ts`): the fair-value anchor's cohort daily averages come straight from `price_observations` at each card's primary printing — no second accumulator table; the local feed script remains only for the bundled fallback feeds.
- Production promotion completed 2026-08-28 (parity, D1 exports, and Time Travel bookmarks taken pre-cutover; see `backups/`). Rollback paths, in order: re-attach `rawsignal.cards` to the intact `raw-signal-staging` Worker/D1; restore from the 2026-08-28 exports or Time Travel bookmarks; the dormant Sites project remains tertiary.

## Data rules

- Treat TCGCSV product and pricing records as the current catalog/price source. Standard price fields are market, listing low, median, and listing high; they are not transaction counts.
- Treat `package-lock.json` as the only dependency lockfile and `npm run check` as the complete release gate.
- Sales volume is presented only from the TCGplayer history endpoint's completed-sale buckets (`quantitySold`, `transactionCount`, realized low/high sale prices with and without shipping, per variant/condition SKU). Label the window and bucket size wherever volume appears, keep it scoped to the selected printing/condition, and render missing sales data as unavailable.
- Never derive volume from price observations, listing counts, or history-point counts, and do not label anything as TCGplayer sales rank; rank remains unavailable.
- Pull rates are curated community-measured estimates in `public/data/pull-rates.json` (packs per hit of any card of the rarity; per-card odds multiply by the set's rarity count). Every derived value must be labeled an estimate, uncurated rarities render as unavailable, and rates are never inferred from prices or card counts alone.
- Graded prices come only from the PokemonPriceTracker API (eBay completed sales per grade), synced by `scripts/graded/sync-graded.mjs` into `public/data/graded-prices.json` under a per-run credit budget (free tier: 100/day, 2 per card). Label the provenance and update date wherever graded values appear, keep ungraded/graded data unblended, and render cards without a snapshot as unavailable. The API key lives in `.secrets/` (gitignored) or `POKEMONPRICETRACKER_API_KEY`; never commit it.
- Modeled fair value is the documented transparent blend in `core/domain/detail-metrics.ts`: 90-day median 40%, 30-day median 24%, current median listing 16%, and set-rarity peer anchor 20%, renormalized over available components (exactly 50/30/20 while the anchor is unavailable). The anchor activates only once its cohort has 14 daily observations in `public/data/peer-context.json`, accumulated per TCGCSV publish date by `scripts/details/build-peer-context.mjs`. It must always be labeled a model, never a valuation guarantee, and renders nothing when no component exists. Do not add opaque or predictive components without an explicit user decision.
- Calculate 7-, 30-, and 90-day changes from dated history observations using the nearest observation at or before the cutoff.
- Calculate displayed 30-day low/high from the historical market series, not listing extremes.
- Keep variants/printings explicit. Do not merge records solely because their names match.
- Preserve `null` for unavailable MSRP, market prices, historical metrics, or regional products. Render these values as `N/A` or the established unavailable label.
- Enforce market validation when syncing sealed products. Pokémon feeds must exclude Lorcana, One Piece, Riftbound, and other cross-market records.
- Preserve meaningful release variants when deduplicating.
- Product-type classification order matters: cases and multi-unit displays must be classified before collections. Booster bundle displays belong to Cases; ordinary booster bundles do not.
- Prefer updating sync/normalization code and regenerating feeds over hand-editing files in `public/data/`.

## UI and interaction rules

- Dark mode is the default; every change must remain legible in light mode.
- Maintain parity across Singles and Sealed where the concepts match: search, filters, sorting, pagination, view selectors, signal controls, hover history, and responsive feedback.
- Keep the supported Singles views: Large, Medium, Text, and Full.
- Keep the supported Sealed views: Medium, Text, and Full.
- Use column headers as the primary sorting controls. Active sort direction must be visible and accessible.
- Keep filters and view state encoded in the URL where the existing architecture supports it.
- Render text and market data before lazy-loaded images. Preserve image fallbacks.
- Card artwork must use its natural aspect ratio and must not be cropped unless a specific view explicitly requires it.
- Desktop Medium/Text history panels are interactive. Keep a continuous pointer path between the row and panel, and use viewport-aware placement.
- Touch interactions must not depend on hover. Preserve the established tap-to-reveal/tap-again-to-open behavior.
- Avoid layout shifts when filters become active. Reserve summary space or update content in place.
- Respect `prefers-reduced-motion` for added animation.
- Use semantic controls, visible focus states, `aria-label`, `aria-pressed`, and `aria-sort` consistently.
- Scalper mode is a stored preference (`raw-signal-scalper-mode`) that gates the `scalping` sealed market and its sale-scenario controls. Enabling it must not navigate away from the current view, and `market=scalping` in a shared URL must still round-trip.
- Detail pages live at `/cards/[productId]` and `/sealed/[productId]` (Sealed threads `?market=` through). They must render correctly from feed-only data when D1 detail enrichment is unavailable, keep the leaderboard's provenance and `N/A` rules, and keep the back control functional on direct loads.

## Signal rules

- Hot Buys identify cards/products near a historic or 30-/90-day low; Hot Sells are the inverse near highs.
- Preserve the Conservative, Balanced, and Aggressive strictness presets.
- Lower-confidence records may remain eligible only when clearly marked with their confidence level.
- Every signal needs human-readable evidence such as “new 30-day low” or “within X% of 90-day high.”
- Signal sorting should default to strongest qualifying score on Hot Buy/Hot Sell views.
- Price signals are informational and must not be described as guaranteed profit or financial advice.

## Validation

Run the narrowest relevant tests during development, then run the complete check before handoff:

```powershell
npm test
```

`npm test` performs the production build and runs all `tests/*.test.mjs` tests. Prefer the complete gate:

```powershell
npm run check
```

It also runs lint and the Chromium browser suite (install its browser once with `npm run test:browser:install`). Fix new warnings introduced by the change; do not broaden scope to unrelated legacy warnings without approval.

Note that `tests/source-contracts.test.mjs` and `tests/scalper-mode.test.mjs` include characterization assertions that regex-match raw component source. When reformatting or restructuring a matched file, update those regexes deliberately (keep them whitespace-tolerant) rather than weakening or deleting the assertion.

Add or update tests when changing:

- market validation or sealed classification;
- deduplication keys;
- history/range calculations;
- fuzzy search or server pagination;
- signal qualification/scoring;
- rendered accessibility labels or core controls.

For visual changes, verify at least one representative Singles view and one Sealed view, at desktop and mobile widths when responsiveness is affected. Check dark and light themes when colors, shadows, borders, or overlays change.

## Data refresh commands

These scripts access external data and can rewrite generated feeds. Run them only when the task requires a data refresh:

```powershell
node sync-tcgcsv.mjs
node sync-sealed.mjs
```

Review generated counts, market validation, duplicates, and diffs before committing regenerated data. Never treat `research.mjs` or `cards.json` as the production leaderboard source; they are legacy research artifacts.

## Deployment

- The deployment target is the production Cloudflare Worker `raw-signal` at `rawsignal.cards` (see Hosting and environment policy). OpenAI Sites is dormant — if the user revives it: package with the Sites helper, never commit the archive, reuse the existing Site project without altering the stored project ID.
- Build and test before publishing: the full gate (`npm run check`, dev server stopped) must be green.
- Commit and push the exact validated source state before deploying.
- Deploy via the prepared config: `node scripts/cloudflare/prepare-deployment.mjs --environment production --route rawsignal.cards --cron "*/2 * * * *"` (production D1 UUID in `RAW_SIGNAL_D1_DATABASE_ID`), inspect it, then `npx wrangler deploy --config dist/server/wrangler.production.json`. Staging: `npm run cloudflare:prepare:staging` with the staging D1 UUID and no `--cron`, then deploy `dist/server/wrangler.staging.json`.
- Publishing is an external action: do it only when the user asks to publish/deploy or when the active workflow explicitly requires deployment.
- After publishing, verify the deployed URL responds and report the version ID and user-visible changes. Do not expose credentials, repository tokens, or internal deployment IDs.
- A same-day redeploy preserves ingestion checkpoints; the guard cron ingests each new deploy's feed snapshot once at the next midnight-UTC re-key.

## Change checklist

Before handing off a change, confirm:

1. Singles and Sealed remain consistent where appropriate.
2. Dark/light and desktop/mobile behavior remain usable.
3. Missing data remains explicitly unavailable.
4. Generated feeds were not hand-edited accidentally.
5. Sorting, filters, URL state, pagination, and hover/touch behavior still compose correctly.
6. `npm test` passes; lint was run when relevant.
7. Only intended source and generated-data changes are staged.
