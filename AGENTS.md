# AGENTS.md

## Read first

- `docs/helicopter-view.md`: one-page orientation — repo map, layering, data lifecycle, environments, release gate, and the sharp edges that have already cost time. Read it before touching the repo.
- `docs/architecture.md`, `docs/data-sources.md`, `docs/data-ingestion.md`: system boundaries, source semantics, and ingestion operations.
- `docs/todo.md` (open work, priorities, scheduled tasks), `docs/todo-completed.md` (shipped items and resolved decisions), `docs/roadmap.md` (agreed-but-deferred decisions; most early items are done and marked so).
- `docs/design-baseline.md`: aesthetic source of truth; UI changes conform to it or update it deliberately.
- `docs/cloudflare-cutover.md`: the staging/production contract, backup and rollback boundaries, and the record of the 2026-08-28 cutover.
- `docs/adr/`: accepted architecture decisions, including the Sites-to-Cloudflare path.

## Project overview

Raw Signal is a mobile-friendly trading-card market dashboard for raw singles and sealed products. It currently covers Pokémon and Riftbound singles plus Pokémon, Riftbound, and selected One Piece sealed products. Magic: The Gathering support is intentionally paused. The application is a React 19 + TypeScript site built with vinext, developed against the local dev server on port 3000 and published as a Cloudflare Worker backed by D1.

Keep the product focused on clear market intelligence: sortable leaderboards, historical price movement, Hot Buy/Hot Sell signals, responsive card views, and transparent data provenance. Missing source data must display as unavailable rather than being estimated silently.

## Working conventions

- Use Node.js 24 when available; the declared minimum is Node.js 22.13.
- Use `npm` and preserve `package-lock.json`. Do not switch package managers or add another package-manager lockfile unless explicitly requested.
- Use TypeScript and existing React patterns. Keep components accessible and keyboard-friendly.
- Preserve user changes and unrelated working-tree edits.
- Do not edit build output or tool state in `.vinext/`, `dist/`, `.wrangler/`, or `node_modules/`.
- Do not commit `site-package*.tar.gz` archives. They are deployment artifacts, not source.
- Do not commit Cloudflare account IDs, D1 UUIDs, API tokens, generated Wrangler environment configs, D1 exports, or database backups.
- Prefer small shared utilities and components over duplicated Singles/Sealed implementations.
- Do not add route-level `loading.tsx` files: vinext 1.0.0-beta.2 leaves their Suspense fallbacks unresolved on a cold dev server, freezing the route. Use in-page loading states instead until a vinext upgrade is verified to fix this.
- Never edit this file without prompting the user first, even for factual corrections.

## Repository map

### Layers

`core/` is pure TypeScript with no React, Worker, or Node imports; `app/`, `db/` + `worker/`, and the node scripts all depend downward on it and never on each other. Node scripts import core directly, so every node-reachable relative import inside `core/` carries an explicit `.ts` extension. The one accepted exception is `app/data/load-detail.ts`, a server-only RSC loader that reads `db/` directly.

- `core/domain/`: market types, runtime feed contracts, display formatters, history metrics, regime classification, eras, pack EV.
- `core/catalog-query.ts`, `core/catalog-repository.ts`: the single Singles/Sealed query engine (search, filters, sorting, facets, pagination) and its repository contract, run identically in the browser and on the server.
- `core/signal-utils.ts`: the single Hot Buy/Hot Sell scoring implementation (v1 champion, v2 challenger behind `model:"v2"`), used by ingestion, the detail page, row badges, and the backtest harness.
- `core/market-state.ts`, `core/market-utils.ts`, `core/sealed-product-utils.ts`, `core/clients/`, `core/normalize/`, `core/msrp/`, `core/graded.ts`, `core/collectr.ts`, `core/peer-history.ts`: market registry, shared utilities, sealed validation/classification, retrying source clients, pure normalizers, MSRP matching, graded and Collectr parsing, peer cohorts.
- `app/`: pages and shared UI. `app/leaderboard/` is the shared Singles/Sealed leaderboard shell (`MarketLeaderboard`, `MarketRow`, `HistoryPopover`, `FullMarketCard`, `ProductIdentity`, `ActiveFilterSummary`, `LeaderboardHeader`, `LeaderboardControls`, and the `mode-adapter.ts` sort/derivation contract) — compose new list behavior here, not in the page files. `app/filters/` holds the filter primitives; `app/state/` is the authoritative URL-state parser, serializer, and browser-history hook; `app/data/` holds repositories, services, and data hooks (including the bundled-feed fallback repository and the persisted-signal readiness gate); `app/api/` holds the routes and their shared cache tiers.
- `db/`: `schema.ts` (types only; migrations are hand-written, see Data rules), `repository.ts` (statement builders and the idempotent read/write boundary), `readiness.ts`, the ingestion modules (`daily-ingestion`, `live-ingestion`, `detail-ingestion`, `graded-ingestion`, `metrics-ingestion`, `benchmark-ingestion`, `history-backfill`, `history-targets`), the page services (`metrics-service`, `sets-service`, `early-value`, `peer-anchors`), and `run-id.ts` for the `prefix:date` ingestion run-id format.
- `worker/`: `index.ts` (fetch + cron entry), `scheduled-ingestion.ts` and `scheduled-decision.ts` (the guard-cron tick and its pure policy), `staging-jobs.ts` (the ops adapter), `live-feeds.ts` (D1-backed `/data/*` feeds with bundled fallback).
- `drizzle/`: hand-written, contiguously numbered D1 migrations applied by wrangler in filename order, plus the early drizzle-kit snapshots kept as history.
- `sync-tcgcsv.mjs`, `sync-sealed.mjs`, `scripts/`: feed generation — Singles and `tcg-index.json` from TCGCSV; normalized Pokémon sealed; `scripts/validate/` and `scripts/io/` for validation manifests and last-good publishing; `scripts/details/` (detail-feed generator, `npm run data:build:details`); `scripts/graded/sync-graded.mjs` (budgeted PokemonPriceTracker sync); `scripts/scalper/` (the Scalper allowlist pipeline, reviewed per `docs/scalper-variant-review.md`); `scripts/cloudflare/` (deploy-config preparation and catalog parity); `scripts/backtest/` (walk-forward harness); `scripts/local-db/` (local max-profile D1 build/swap).
- `public/data/`: generated market feeds — the bundled fallback the app uses whenever D1 readiness markers are absent. Regenerate them; do not hand-edit.
- `tests/`: ~243 node tests in 52 suites plus 4 Playwright journeys. Several suites regex-match raw source (`source-contracts`, `scalper-mode`, `css-architecture`, `maintainer-docs`, `cloudflare-cutover`) and fail on moves until their pins are updated deliberately; `signal-characterization` pins 627 real-data evaluator outputs; `derived-history` and `scheduled-ingestion` pin the ingestion pass and the cron dispatch.
- `.openai/hosting.json`: dormant OpenAI Sites project configuration. Preserve its opaque `project_id`.

### Route surfaces

| Route | Entry | Notes |
|---|---|---|
| `/` | `app/page.tsx` | App shell + Singles leaderboard; renders `app/SealedView.tsx` for `mode=sealed` |
| `/metrics` | `app/metrics/page.tsx` → `MetricsView` | Movers, indexes, momentum, category/set leaderboards |
| `/sets`, `/sets/[game]/[slug]` | `app/sets/` → `SetsView`, `SetDetailView` | D1 only via `db/sets-service.ts`; 404 when unpublished |
| `/buylist` | `app/buylist/page.tsx` | Favorites-driven list + fullscreen mode |
| `/import` | `app/import/page.tsx` → `CollectrImportView` | Collectr showcase/CSV import matched against D1 |
| `/cards/[productId]`, `/sealed/[productId]` | `ProductDetailPage` via `detail-route` + `data/load-detail` | Shared detail surface; `detail-tables.tsx` holds the sealed page's Chase cards (set cards priced above the set's cheapest plain booster-pack market price, top by value when no pack price exists, capped at twelve) and same-set tables |
| `/api/catalog`, `/api/catalog/detail`, `/api/history`, `/api/signals`, `/api/metrics`, `/api/set-ev`, `/api/collectr` | `app/api/**/route.ts` | Read D1 first, bundled feeds as fallback; the detail pages load on the server instead of calling `/api/catalog/detail` |

Styles load as a layered chain from `app/layout.tsx` (eleven sheets, order pinned by `tests/css-architecture.test.mjs` and listed in `docs/architecture.md`). Later sheets intentionally override earlier ones: check the whole chain before adding an override, and put new rules in the owning component sheet using the shared tokens.

## Source control and GitHub

- Local commits are normal workflow. Pushing to GitHub is an external action: never run `git push` (or create remote branches, tags, or pull requests) unless the user explicitly requests a push in the active task.
- A request to publish or deploy the site does not authorize a push, and a push request does not authorize a deployment.
- Never force-push `main`, and never rewrite history that has already been pushed.

## Hosting and environment policy

| | Dev | Staging | Production |
|---|---|---|---|
| Where | `npm run dev`, port 3000 | Worker `raw-signal-staging` on workers.dev | Worker `raw-signal` at `https://rawsignal.cards` (custom domain; workers.dev off) |
| D1 | placeholder binding (`npm run db:local:max` swaps in the local max-profile copy) | `raw-signal-staging` — stale by design | `raw-signal-production` — daily ingestion |
| Cron | none | none | `*/1` guard cron: one checkpointed batch per tick, only when due |
| `ENVIRONMENT` | — | `staging` (enables the ops adapter) | `production` (adapter refuses) |
| Secrets | none | `STAGING_JOB_TOKEN` | job token + `POKEMONPRICETRACKER_API_KEY` (the single spender) |

- Staging is deliberately low-priority and low-cost (user rule 2026-08-28): no cron, no daily ingestion, data goes stale, updated only when deliberately testing ingestion changes before they touch production. Production alone runs scheduled ingestion.
- Unless explicitly authorized, do not create or mutate direct-Cloudflare Workers, D1 databases, routes, schedules, secrets, Workflows, Queues, or production bindings. Read-only inspection is acceptable when needed for planning or diagnosis. A linked account or an available Wrangler login does not authorize a deploy; see Deployment for the procedure.
- `POST /__ops/staging-jobs` (`worker/staging-jobs.ts`) is staging-only, bearer-protected, non-cacheable, and checkpointed: catalog batches cap at 80 records (the per-invocation binding-call ceiling), history at 60 with six concurrent upstream fetches, detail enrichment at 10 chunk files; the `live` job walks TCGCSV groups with a record cursor and the `graded` job spends at most its credit budget. Do not expose its token, give it a production route, or convert it into a public API.
- The graded API key exists ONLY on the production Worker; do not also run the local graded sync on the same day.
- OpenAI Sites hosting is dormant: do not package `site-package-vN.tar.gz` handoffs or publish through Sites unless the user explicitly revives it. Preserve `.openai/hosting.json` (opaque `project_id` included) and the Sites-compatible vinext build as the rollback path — no Cloudflare-only application fork.
- Production reads D1 for catalog, history, and signals (`source:"database"`); the bundled-feed fallback stays in the build for environments without a seeded database. Rollback order, backups, and the cutover record live in `docs/cloudflare-cutover.md`.

## Data rules

- Treat TCGCSV product and pricing records as the current catalog/price source. Standard price fields are market, listing low, median, and listing high; they are not transaction counts.
- Treat `package-lock.json` as the only dependency lockfile and `npm run check` as the complete release gate.
- Schema changes edit `db/schema.ts` for the types and add the next numbered SQL file under `drizzle/` by hand. `drizzle-kit` is retired and must not be reintroduced; deploy first, then apply the migration to each D1.
- Ingestion is idempotent and checkpointed: the TCGCSV probe timestamp is the live snapshot's identity (each publish ingests exactly once), a product's metrics + signal + shadow rows land in one atomic batch, and an incomplete run must never become readable as the current catalog. History batches skip snapshot targets missing from the catalog rather than failing.
- Sales volume is presented only from the TCGplayer history endpoint's completed-sale buckets (`quantitySold`, `transactionCount`, realized low/high sale prices with and without shipping, per variant/condition SKU). Label the window and bucket size wherever volume appears, keep it scoped to the selected printing/condition, and render missing sales data as unavailable.
- Never derive volume from price observations, listing counts, or history-point counts, and do not label anything as TCGplayer sales rank; rank remains unavailable.
- Pull rates are curated community-measured estimates in `public/data/pull-rates.json` (packs per hit of any card of the rarity; per-card odds multiply by the set's rarity count). Every derived value must be labeled an estimate, uncurated rarities render as unavailable, and rates are never inferred from prices or card counts alone.
- Graded prices come only from the PokemonPriceTracker API (eBay completed sales per grade), rotated in production by `db/graded-ingestion.ts` (90 credits/day) and synced locally by `scripts/graded/sync-graded.mjs` into `public/data/graded-prices.json` for the bundled fallback (free tier: 100/day, 2 per card). Label the provenance and update date wherever graded values appear, keep ungraded/graded data unblended, and render cards without a snapshot as unavailable. The API key lives in `.secrets/` (gitignored) or `POKEMONPRICETRACKER_API_KEY`; never commit it.
- Modeled fair value is the documented transparent blend in `core/domain/detail-metrics.ts`: 90-day median 40%, 30-day median 24%, current median listing 16%, and set-rarity peer anchor 20%, renormalized over available components (exactly 50/30/20 while the anchor is unavailable). The anchor activates only once its cohort has 14 daily observations; in production the cohort averages are derived on read from `price_observations` (`db/peer-anchors.ts`, no second accumulator table), and `scripts/details/build-peer-context.mjs` maintains `public/data/peer-context.json` only for the bundled fallback. It must always be labeled a model, never a valuation guarantee, and renders nothing when no component exists. Do not add opaque or predictive components without an explicit user decision.
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
- Keep filters and view state encoded in the URL where the existing architecture supports it. Device preferences (theme, font size, Scalper mode) live in `localStorage` under `raw-signal-*` keys, never in the URL.
- Render text and market data before lazy-loaded images. Preserve image fallbacks.
- Card artwork must use its natural aspect ratio and must not be cropped unless a specific view explicitly requires it.
- Desktop Medium/Text history panels are interactive. Keep a continuous pointer path between the row and panel, and use viewport-aware placement.
- Touch interactions must not depend on hover. Preserve the established tap-to-reveal/tap-again-to-open behavior.
- Avoid layout shifts when filters become active. Reserve summary space or update content in place.
- Respect `prefers-reduced-motion` for added animation.
- Use semantic controls, visible focus states, `aria-label`, `aria-pressed`, and `aria-sort` consistently.
- Scalper mode is a stored preference (`raw-signal-scalper-mode`) that gates the `scalping` sealed market and its sale-scenario controls (`app/SaleScenario.tsx`, shared with the sealed detail page). Enabling it must not navigate away from the current view, and `market=scalping` in a shared URL must still round-trip.
- Detail pages live at `/cards/[productId]` and `/sealed/[productId]` (Sealed threads `?market=` through). They must render correctly from feed-only data when D1 detail enrichment is unavailable, keep the leaderboard's provenance and `N/A` rules, and keep the back control functional on direct loads.
- Fonts are self-hosted (`public/fonts/` + `app/styles/fonts.css`); never use `next/font/google`.

## Signal rules

- Hot Buys identify cards/products near a historic or 30-/90-day low; Hot Sells are the inverse near highs.
- Preserve the Conservative, Balanced, and Aggressive strictness presets.
- Lower-confidence records may remain eligible only when clearly marked with their confidence level.
- Every signal needs human-readable evidence such as “new 30-day low” or “within X% of 90-day high.”
- Signal sorting should default to strongest qualifying score on Hot Buy/Hot Sell views.
- Price signals are informational and must not be described as guaranteed profit or financial advice.
- The v1 model serves production; the v2 challenger is evaluated in shadow and is promoted only by an explicit user decision backed by `docs/backtests.md` and the shadow scoreboard (`docs/todo.md` §P).

## Validation

Run the narrowest relevant tests during development, then run the complete check before handoff:

```powershell
npm test
```

`npm test` performs the production build and runs all `tests/*.test.mjs` tests. Prefer the complete gate:

```powershell
npm run check
```

It also runs lint, the type check (`npm run typecheck`), and the Chromium browser suite (install its browser once with `npm run test:browser:install`). Playwright manages its own server on port 4173, so the :3000 dev server may stay up. Lint warns at cyclomatic complexity 25 without failing; do not add functions above that line without a reason in the change description. Fix new warnings introduced by the change; do not broaden scope to unrelated legacy warnings without approval.

The gate's production build wipes `dist/`, including any generated `wrangler.<env>.json`; regenerate the deploy config after a gate and before deploying.

Note that `tests/source-contracts.test.mjs` and `tests/scalper-mode.test.mjs` include characterization assertions that regex-match raw component source. When reformatting or restructuring a matched file, update those regexes deliberately (keep them whitespace-tolerant) rather than weakening or deleting the assertion.

Add or update tests when changing:

- market validation or sealed classification;
- deduplication keys;
- history/range calculations;
- fuzzy search or server pagination;
- signal qualification/scoring (extend the characterization fixture rather than editing pinned values);
- ingestion decisions or the derived metrics/signal pass;
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

- The deployment target is the production Cloudflare Worker `raw-signal` at `rawsignal.cards`. Publishing is an external action: do it only when the user asks to publish/deploy in the active task or when the active workflow explicitly requires deployment.
- Build and test before publishing: the full gate (`npm run check`) must be green.
- Commit and push the exact validated source state before deploying.
- Deploy via the prepared config: `node scripts/cloudflare/prepare-deployment.mjs --environment production --route rawsignal.cards --cron "*/1 * * * *"` (production D1 UUID in `RAW_SIGNAL_D1_DATABASE_ID`), inspect `dist/server/wrangler.production.json`, then `npx wrangler deploy --config dist/server/wrangler.production.json`. Staging: `npm run cloudflare:prepare:staging` with the staging D1 UUID and no `--cron`, then deploy `dist/server/wrangler.staging.json`.
- Pending migrations are applied after the deploy with `npx wrangler d1 migrations apply DB --remote --config <that config>` (on Windows, pipe `echo y |` into it; wrangler can also crash in libuv teardown after succeeding — verify state before retrying).
- After publishing, verify the deployed URL responds and report the version ID and user-visible changes. Do not expose credentials, repository tokens, or internal deployment IDs.
- A same-day redeploy preserves ingestion checkpoints; the guard cron ingests each new deploy's feed snapshot once at the next midnight-UTC re-key.
- If the user revives OpenAI Sites: package with the Sites helper, never commit the archive, reuse the existing Site project without altering the stored project ID.

## Change checklist

Before handing off a change, confirm:

1. Singles and Sealed remain consistent where appropriate.
2. Dark/light and desktop/mobile behavior remain usable.
3. Missing data remains explicitly unavailable.
4. Generated feeds were not hand-edited accidentally.
5. Sorting, filters, URL state, pagination, and hover/touch behavior still compose correctly.
6. `npm run check` is green (build, tests, lint, type check, browser journeys); document any behavior change deliberately.
7. Only intended source and generated-data changes are staged.
