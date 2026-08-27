# AGENTS.md

## Project overview

Raw Signal is a mobile-friendly trading-card market dashboard for raw singles and sealed products. It currently covers Pokémon and Riftbound singles plus Pokémon, Riftbound, and selected One Piece sealed products. Magic: The Gathering support is intentionally paused. The application is a React 19 + TypeScript site built with vinext and deployed through OpenAI Sites on Cloudflare.

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
- `app/domain/detail.ts`, `app/domain/detail-metrics.ts`, `app/data/load-detail.ts`: detail formatting, similarity scoring, and the D1 → scalping-feed → generated-feed detail resolution cascade.
- `app/not-found.tsx`: shared 404 surface.
- `app/domain/`: shared market types, runtime feed contracts, and display formatters.
- `app/data/catalog-query.ts`, `app/data/catalog-repository.ts`: shared Singles/Sealed query semantics and repository contract.
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
- `product_details` (migration `0002`) stores detail-page enrichments read by `db/catalog-repository.ts`. Known gap: no ingestion path calls `upsertProductDetail` yet, so D1 detail enrichment stays empty until one exists.
- `worker/staging-jobs.ts`: staging-only, bearer-protected, checkpointed catalog/history execution adapter. It must remain hidden outside staging and must not gain a production route.
- `drizzle/`: generated, committed D1 migrations and schema snapshots.
- `docs/adr/`: accepted architecture decisions, including the Sites-to-Cloudflare path.
- `docs/architecture.md`, `docs/data-sources.md`: maintained system boundaries and source semantics.
- `docs/cloudflare-cutover.md`, `cloudflare/environments.json`, `scripts/cloudflare/`: direct-Cloudflare staging contract, generated-config preparation, and catalog parity checks.
- `sync-tcgcsv.mjs`: generates Singles market data and `tcg-index.json` from TCGCSV.
- `sync-sealed.mjs`: generates normalized Pokémon sealed-product data.
- `sealed-product-utils.mjs`: market validation, deduplication, and product-type classification.
- `scripts/clients/`, `scripts/normalize/`, `scripts/validate/`, `scripts/io/`: retrying source clients, pure normalization, validation manifests, and last-good publishing.
- `scripts/scalper/`: the Scalper allowlist pipeline — `reconcile.mjs` and `build-feed.mjs` produce `public/data/sealed-scalping.json` from `approved-variants.json`, `supplemental-products.json`, and the review process in `docs/scalper-variant-review.md`.
- Known gap: `scripts/details/build-detail-feeds.mjs` (npm `data:build:details`) is referenced but has never been committed. The detail feeds it produced (`public/data/detail-manifest.json` plus `public/data/details/`) are rescued copies of earlier build output; recreate the generator before regenerating them.
- `public/data/`: generated market feeds consumed by the application.
- `tests/`: Node test suite covering history, search, rendering, market validation, sealed classification, and signal scoring.
- `.openai/hosting.json`: OpenAI Sites project configuration. Preserve its opaque `project_id`.

## Source control and GitHub

- Local commits are normal workflow. Pushing to GitHub is an external action: never run `git push` (or create remote branches, tags, or pull requests) unless the user explicitly requests a push in the active task.
- A request to publish or deploy the site does not authorize a push, and a push request does not authorize a deployment.
- Never force-push `main`, and never rewrite history that has already been pushed.

## Hosting and environment policy

- OpenAI Sites is the default environment for ongoing development, testing, previews, and production publishing. Preserve the Sites-compatible vinext build and the logical bindings in `.openai/hosting.json`.
- Continue to keep direct Cloudflare compatibility in the shared source, migrations, repository interfaces, Worker entry point, and deployment-preparation scripts. Do not introduce a Sites-only application fork or a separate Cloudflare UI implementation.
- Deploy to direct Cloudflare only when the user explicitly requests a Cloudflare deployment in the active task. A linked Cloudflare account, an available Wrangler login, or a general request to publish the website does not authorize a Cloudflare deploy.
- Unless explicitly authorized, do not create or mutate direct-Cloudflare Workers, D1 databases, routes, schedules, secrets, Workflows, Queues, or production bindings. Read-only inspection is acceptable when needed for planning or diagnosis.
- A normal request to publish or deploy Raw Signal means publish through the existing OpenAI Sites project. If the target is ambiguous and direct Cloudflare would materially change external state, keep Sites as the target or ask for clarification.

### Current direct-Cloudflare capability

- The linked Cloudflare account has an isolated `raw-signal-staging` Worker and an isolated, migrated `raw-signal-staging` D1 database. The staging URL is `https://raw-signal-staging.raw-signal-watch.workers.dev`.
- The staging Worker supports the vinext application, static assets through `ASSETS`, D1 through `DB`, Cloudflare Images through `IMAGES`, Worker version metadata, and an explicit `ENVIRONMENT=staging` boundary.
- `POST /__ops/staging-jobs` is staging-only, bearer-protected, non-cacheable, and checkpointed. Catalog batches are capped at 80 records to remain within the limits verified on the current plan. Do not expose its token or convert it into a public production API.
- Catalog and history ingestion have been proven with bounded live batches. The D1 bootstrap and history backfill are incomplete, so staging public APIs intentionally retain the bundled-feed fallback until atomic readiness markers exist.
- No Cloudflare Cron Trigger, Queue, Workflow, production Worker route, production D1 database, or custom production hostname is active. Full database-backed catalog/signal parity has not yet passed.
- The anticipated paid-plan continuation is a durable Cloudflare Workflow with resumable catalog and history steps, monitoring, and explicit usage limits. Implement or deploy it only after a specific user request.
- Before any future Cloudflare production cutover, complete staging backfills, prove API and UI parity against Sites, create backups, validate rollback, obtain approval for the production hostname, and keep Sites available as the rollback target.

## Data rules

- Treat TCGCSV product and pricing records as the current catalog/price source. Standard price fields are market, listing low, median, and listing high; they are not transaction counts.
- Treat `package-lock.json` as the only dependency lockfile and `npm run check` as the complete release gate.
- Sales volume is presented only from the TCGplayer history endpoint's completed-sale buckets (`quantitySold`, `transactionCount`, realized low/high sale prices with and without shipping, per variant/condition SKU). Label the window and bucket size wherever volume appears, keep it scoped to the selected printing/condition, and render missing sales data as unavailable.
- Never derive volume from price observations, listing counts, or history-point counts, and do not label anything as TCGplayer sales rank; rank remains unavailable.
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

Note that `tests/rendered-html.test.mjs` and `tests/scalper-mode.test.mjs` include characterization assertions that regex-match raw component source. When reformatting or restructuring a matched file, update those regexes deliberately (keep them whitespace-tolerant) rather than weakening or deleting the assertion.

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

- This repository's current production and default deployment target is OpenAI Sites because `.openai/hosting.json` is present.
- Build and test before publishing.
- Commit and push the exact validated source state before saving a Site version.
- Package deployments with the Sites packaging helper; never commit the resulting archive.
- Reuse the existing Sites project and source branch. Do not create a new Site or alter the stored project ID.
- Prefer the existing private deployment workflow and poll until it succeeds or fails.
- Publishing is an external action: do it only when the user asks to publish/deploy or when the active site-building workflow explicitly requires deployment.
- Do not deploy the direct Cloudflare staging or production targets unless the user specifically requests Cloudflare deployment. Sites publication does not imply Cloudflare publication.
- After publishing, report the production URL and the user-visible changes. Do not expose credentials, repository tokens, or internal deployment IDs.

## Change checklist

Before handing off a change, confirm:

1. Singles and Sealed remain consistent where appropriate.
2. Dark/light and desktop/mobile behavior remain usable.
3. Missing data remains explicitly unavailable.
4. Generated feeds were not hand-edited accidentally.
5. Sorting, filters, URL state, pagination, and hover/touch behavior still compose correctly.
6. `npm test` passes; lint was run when relevant.
7. Only intended source and generated-data changes are staged.
