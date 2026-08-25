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

## Repository map

- `app/page.tsx`: application shell and Singles leaderboard orchestration.
- `app/SealedView.tsx`: Sealed leaderboard, calculations, filtering, sorting, and views.
- `app/MarketUI.tsx`: shared pagination, segmented view controls, and sortable headers.
- `app/HistoryPanel.tsx`, `app/PriceChart.tsx`: shared historical-price presentation and interactive charts.
- `app/CardFilters.tsx`, `app/SealedFilters.tsx`, `app/MultiSelectField.tsx`: filter and multi-select controls.
- `app/SignalControls.tsx`, `app/signal-utils.ts`: Hot Buy/Hot Sell controls and scoring.
- `app/market-utils.ts`, `app/history-utils.ts`: shared search, history, range, concurrency, and popover utilities.
- `app/domain/`: shared market types, runtime feed contracts, and display formatters.
- `app/data/catalog-query.ts`, `app/data/catalog-repository.ts`: shared Singles/Sealed query semantics and repository contract.
- `app/data/feed-catalog-repository.ts`, `app/data/catalog-service.ts`: bundled-feed adapter and transport-neutral catalog service.
- `app/data/usePersistedSignals.ts`, `app/api/signals/route.ts`: persisted Hot Buy/Hot Sell readiness gate and compact signal records.
- `app/data/signal-coverage.ts`: proportional, price-stratified transitional signal sampling.
- `app/state/`: the authoritative Singles/Sealed URL-state parser, serializer, and browser synchronization hook.
- `app/globals.css`: original global layout and component styles.
- `app/market-views.css`: later shared view, filter, signal, and responsive refinements. Check both stylesheets before adding overrides.
- `app/api/history/route.ts`: normalized TCGplayer market-history access.
- `app/api/catalog/route.ts`: compact catalog query endpoint with D1-readiness checks and bundled-feed fallback.
- `db/schema.ts`, `db/repository.ts`: D1 persistence schema and idempotent ingestion/read boundary.
- `db/catalog-repository.ts`: D1 catalog adapter using the shared catalog query contract.
- `db/daily-ingestion.ts`, `db/history-backfill.ts`: idempotent daily snapshots, derived metrics/signals, and resumable history backfill.
- `drizzle/`: generated, committed D1 migrations and schema snapshots.
- `docs/adr/`: accepted architecture decisions, including the Sites-to-Cloudflare path.
- `docs/architecture.md`, `docs/data-sources.md`: maintained system boundaries and source semantics.
- `docs/cloudflare-cutover.md`, `cloudflare/environments.json`, `scripts/cloudflare/`: direct-Cloudflare staging contract, generated-config preparation, and catalog parity checks.
- `sync-tcgcsv.mjs`: generates Singles market data and `tcg-index.json` from TCGCSV.
- `sync-sealed.mjs`: generates normalized Pokémon sealed-product data.
- `sealed-product-utils.mjs`: market validation, deduplication, and product-type classification.
- `scripts/clients/`, `scripts/normalize/`, `scripts/validate/`, `scripts/io/`: retrying source clients, pure normalization, validation manifests, and last-good publishing.
- `public/data/`: generated market feeds consumed by the application.
- `tests/`: Node test suite covering history, search, rendering, market validation, sealed classification, and signal scoring.
- `.openai/hosting.json`: OpenAI Sites project configuration. Preserve its opaque `project_id`.

## Data rules

- Treat TCGCSV product and pricing records as the current catalog/price source. Standard price fields are market, listing low, median, and listing high; they are not transaction counts.
- Treat `package-lock.json` as the only dependency lockfile and `npm run check` as the complete release gate.
- Do not label price observations as sales volume or sales rank. A frequency metric requires a separate transaction source and confidence/coverage metadata.
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

It also runs lint. Fix new warnings introduced by the change; do not broaden scope to unrelated legacy warnings without approval.

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

- This repository is hosted with OpenAI Sites because `.openai/hosting.json` is present.
- Build and test before publishing.
- Commit and push the exact validated source state before saving a Site version.
- Package deployments with the Sites packaging helper; never commit the resulting archive.
- Reuse the existing Sites project and source branch. Do not create a new Site or alter the stored project ID.
- Prefer the existing private deployment workflow and poll until it succeeds or fails.
- Publishing is an external action: do it only when the user asks to publish/deploy or when the active site-building workflow explicitly requires deployment.
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
