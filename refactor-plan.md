# Raw Signal phased refactoring plan

## Purpose

This plan reduces technical debt without redesigning the product or changing market calculations. The sequence favors small, reversible changes with a proof gate after every milestone. Do not combine milestones unless the earlier milestone has shipped and remained stable.

The target architecture should provide:

- one authoritative set of domain and API types;
- one shared URL/state contract for Singles and Sealed;
- reusable leaderboard, filter, history, signal, and responsive-interaction primitives;
- consistent visual tokens and component states across every view;
- explicit data-source and unavailable-data behavior;
- tests at utility, contract, rendered-component, and critical-interaction levels.

## Confirmed product and architecture decisions

- Temporarily remove Magic: The Gathering from the supported markets. Preserve clean extension points so it can return later, but do not carry Magic-only server pagination or UI complexity through the first refactoring pass.
- Remove direct TCGplayer navigation from leaderboard rows, card images, and sealed-product rows. Rows and artwork should be informational/interactable surfaces, not links. A clearly labeled external-link button may be designed later as a separate task.
- Do not finalize the application data contract or history-storage abstraction before the hosting and database direction is chosen. The database schema, ingestion boundary, cache strategy, and API response contracts should be designed together.

## Progress

- Milestone 0 completed locally on 2026-08-25: added Singles and Sealed default-behavior characterization coverage.
- Milestone 1 completed locally on 2026-08-25: removed active Magic UI, sync, index, data files, and its market-specific cards API; legacy Magic URLs now normalize to Pokémon.
- Milestone 2 foundation completed locally on 2026-08-25: selected OpenAI Sites with a logical Cloudflare D1 binding, documented the future direct-Cloudflare path, added authoritative domain contracts/formatters, generated the initial schema migration, and proved idempotent fixture ingestion with preserved nullability and a 90-day history series.
- Milestone 3 completed and production-validated on 2026-08-25: added one typed parser/serializer for Singles and Sealed, made the application shell the URL owner, added complete Sealed URL restoration, and corrected browser Back/Forward history semantics after manual validation.
- Milestone 4 completed and production-validated on 2026-08-25: Singles and Sealed now share abortable catalog loading, bounded/cached history batching, retry/status state, and one pure derived-metric implementation. The history API emits the same normalized metrics. JSON remains the live catalog path and the bounded history endpoint remains the documented fallback until database backfill/cutover.
- Milestone 5 completed and production-validated on 2026-08-25: Singles and Sealed now compose their mode-specific market strip, header, filter summary, controls, sort surface, rows, and footer through one shared leaderboard shell with common loading, retry, empty, and pagination behavior. Distinct mode models preserve each page's supported views and sort columns.
- Milestone 6 completed and production-validated on 2026-08-25: Singles and Sealed now share semantic row disclosures, identity, history-popover, full-card, viewport-placement, focus, pointer, touch, and Escape behavior. Direct TCGplayer navigation and misleading external-link arrows were removed from rows, artwork, and full cards. Final large-card review corrections make the tile and lateral history expansion share one continuous blue perimeter, combined shadow, and wrapper-level hover lift without an internal seam; reduced-motion users receive no translation.
- Milestone 7 completed and production-validated on 2026-08-25: Singles, Sealed, and top-level multi-selects now share dismissible-details behavior, filter-button presentation, numeric ranges, searchable checkbox selection, normalized All semantics, and reset actions. Mode-specific filter fields remain configured in their adapters.
- Milestone 8 completed locally on 2026-08-25: introduced shared dimensions, motion, focus, radius, and stacking tokens; moved the current shared controls/filter presentation and leaderboard disclosure/popover presentation out of the append-only stylesheet into component-family stylesheets; and removed the large-popover 1 px vertical overhang at its legacy source. CSS regression coverage now protects import order, ownership, flush geometry, and reduced motion.
- Validation gate: Milestone 7 passed manual production validation. Milestone 8 passes the production build, lint, and 44-test automated suite; it awaits final production validation after publication before Milestone 9 begins.

## Current technical debt

### 1. Page components own too many responsibilities

`app/page.tsx` and `app/SealedView.tsx` each combine domain types, state initialization, URL handling, network requests, history enrichment, filtering, sorting, signal qualification, derived labels, layout, and row rendering. Their physical line counts look modest only because much of the code is compressed onto very long lines. This makes localized changes difficult to review and increases the chance that Singles and Sealed drift apart.

### 2. Similar behavior has multiple implementations

The project already shares pagination, segmented controls, charts, history panels, and signal controls, but still duplicates or nearly duplicates:

- formatting of currency and percentages;
- history metric construction and enrichment;
- sorting conventions and null handling;
- filter summary chips and reset behavior;
- outside-click/Escape handling for `<details>` menus;
- set search and checkbox grids;
- desktop popover and touch-to-reveal behavior;
- loading, failure, and empty-state decisions;
- text normalization between the browser and `/api/cards`.

### 3. State ownership and URL behavior are inconsistent

Singles state is largely parsed from and written to the URL in `app/page.tsx`. Sealed owns a second market, query, type, set, sort, page, view, and pricing state inside `app/SealedView.tsx`. This creates two sources of truth: the top-level URL can describe one market while Sealed internally displays another. It also prevents equivalent Singles and Sealed views from being reliably shareable or restored.

### 4. Data contracts are inferred rather than enforced

Card, sealed-product, and history shapes are declared locally in components or routes. Generated JSON is trusted at runtime. Nullability, printing variants, signal inputs, and source coverage are therefore easy to interpret differently across files. The production feed has validation tests, but the application boundary does not have a shared parser or schema.

This debt should be resolved with the hosting/database foundation rather than by creating a second temporary contract around generated JSON. Shared presentation types and formatters can be extracted earlier, but authoritative persistence and API schemas should follow the database decision.

### 5. History loading is duplicated and expensive

Singles and Sealed each implement their own history-fetch queue, cache merge, range calculations, and failure fallback. Hot Buy/Hot Sell can request history for hundreds of records from the browser. `/api/history` has only a process-local 15-minute promise cache, so cache effectiveness depends on the current worker instance. This increases request volume and creates inconsistent loading behavior.

The long-term fix belongs with the hosting/database work: a daily server-side job should persist normalized history and derived metrics, after which the application can read stable records instead of creating a large browser-driven request fan-out.

### 6. CSS has become an append-only override stack

`app/globals.css` and `app/market-views.css` contain overlapping definitions, version-comment layers, repeated media queries, high-specificity selectors, and frequent `!important`. Recent selector-centering defects were caused by a broad `.market-strip span` rule overriding a newer component rule. The current structure makes responsive and theme behavior difficult to predict.

### 7. Interactive content is nested inside links

Rows are anchors while their hover panels contain chart range buttons and interactive chart behavior. Preventing default navigation does not remove the underlying nested-interactive-content issue. This can create inconsistent keyboard, screen-reader, and pointer behavior. Desktop hover and touch disclosure also follow separate paths.

The selected resolution is to remove TCGplayer links from rows and artwork entirely. The refactor should first make rows non-navigational interactive disclosures. A dedicated external-link button is explicitly out of scope until a later product-design task.

### 8. Server-side pagination is market-specific

Only a narrow Magic path uses `/api/cards`; Pokémon, Riftbound, and many filter/signal paths load complete JSON groups into the browser. Search and sort semantics differ slightly between client and server implementations.

Because Magic support is being removed temporarily, the Magic-only branch and its special pagination path should be deleted before extracting the general catalog service. Server-side pagination can then be reintroduced from a clean database-backed repository when Pokémon or Riftbound scale requires it.

### 9. Error handling is mostly silent

Several fetch paths fall back to empty data or stop loading without a user-facing retry state. Effects use manual `live` flags and intentionally disabled dependency warnings instead of a shared request abstraction with `AbortController`. A transient feed failure can look like “no cards.”

### 10. Tests emphasize source/render contracts over interactions

The utility and feed-validation tests are valuable, but `tests/rendered-html.test.mjs` largely protects strings and structural markers. There is no focused automated coverage for URL restoration, filter clearing, sort direction, popover flipping, touch disclosure, theme parity, or Singles/Sealed consistency.

### 11. Repository hygiene and documentation lag the product

`README.md` still describes the starter rather than Raw Signal. Legacy `research.mjs` and `cards.json` sit beside production sync scripts. Numerous deployment archives are untracked because `.gitignore` ignores only one exact archive name. This makes the source of truth harder for new maintainers to identify.

---

## Milestone 0 — Freeze current behavior with characterization tests

### Objective

Record the behavior that must survive the refactor before moving code. Define representative Singles and Sealed URLs and expected defaults, labels, sort order, null rendering, and signal behavior. Add only tests and fixtures in this milestone.

### Affected file paths

- `tests/rendered-html.test.mjs`
- `tests/market-utils.test.mjs`
- `tests/history-utils.test.mjs`
- `tests/signal-utils.test.mjs`
- `tests/sealed-products.test.mjs`
- new `tests/fixtures/` files if deterministic records are needed
- new browser/component test configuration only if the chosen runner requires it

### Potential breaking changes

None intended. Tests may reveal existing contradictions, particularly Sealed URL state, server/client search differences, and unavailable-value labels. Document such behavior instead of silently “fixing” it during characterization.

### Smallest stability proof

Run `npm test` and prove all existing tests plus one new Singles characterization and one new Sealed characterization pass against fixed fixtures.

---

## Milestone 1 — Temporarily remove Magic: The Gathering support

### Objective

Reduce the supported product surface to Pokémon and Riftbound Singles, plus the currently supported Sealed markets. Remove Magic from navigation, rarity configuration, generated totals, client loading branches, API special cases, and production sync output. Keep generic market/domain naming where it helps future extensibility, but do not retain unreachable Magic-only code.

Do not delete historical deployment archives or rewrite past datasets solely to erase Magic. Remove it from the active build and documented supported markets.

### Affected file paths

- `app/page.tsx`
- `app/api/cards/route.ts`
- `sync-tcgcsv.mjs`
- `tcg-index.json`
- `public/data/magic-*.json`
- `tests/rendered-html.test.mjs`
- new or updated catalog-generation tests
- `README.md` and `AGENTS.md` when documentation is refreshed

### Potential breaking changes

- Existing Magic URLs will no longer resolve to a Magic leaderboard and need a deterministic fallback to Pokémon.
- Total counts and rarity arrays in `tcg-index.json` will change.
- Removing `/api/cards` may affect bookmarked or monitoring requests even though it is not a public UI surface.
- A broad sync-script edit could accidentally change Pokémon or Riftbound output.

### Smallest stability proof

Load an old `?market=magic` URL and assert it normalizes to the documented Pokémon default without an error. Run the sync against fixtures and prove Pokémon and Riftbound product IDs/counts are unchanged while no active index entry or navigation option contains Magic.

---

## Milestone 2 — Establish the hosting/database foundation and authoritative contracts

### Objective

Choose and document the production hosting/database architecture before replacing generated-JSON contracts or history caching. Define the database as the authoritative boundary for catalog records, variants, daily market observations, sealed MSRP, source coverage, refresh metadata, and derived signals. Design the daily ingestion job, retention policy, indexes, migrations, rollback behavior, and application read APIs together.

After the persistence model is approved, move duplicated types and pure display helpers into explicit modules generated from or aligned with that schema. Define authoritative `Game`, `View`, `SignalSide`, `Card`, `SealedProduct`, `PriceHistory`, `PricePoint`, `HistoryMetrics`, sort keys, nullable price fields, and API response types. Centralize USD, percentage, date, rarity, and unavailable-value formatting.

This milestone requires an architecture decision before implementation. Do not configure a production database merely to complete the plan; compare the Sites/Cloudflare D1 path with any alternative hosting being considered, including operational ownership, scheduled-job support, backups, cost, and local development.

### Affected file paths

- new `app/domain/types.ts`
- new `app/domain/formatters.ts`
- new `app/domain/contracts.ts` or `app/domain/guards.ts`
- `db/schema.ts`
- `db/index.ts`
- `drizzle.config.ts`
- `drizzle/`
- `.openai/hosting.json`
- `worker/index.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/PriceChart.tsx`
- `app/HistoryPanel.tsx`
- `app/api/cards/route.ts`
- `app/api/history/route.ts`
- `app/signal-utils.ts`
- `app/market-utils.ts`
- `sync-tcgcsv.mjs`
- `sync-sealed.mjs`
- new architecture decision record such as `docs/adr/001-hosting-and-database.md`

### Potential breaking changes

- Different formatting precision for prices at or above $100.
- `null`, `undefined`, and zero could be conflated during migration.
- Existing API fields may be renamed accidentally.
- Printing/variant or game unions could reject currently accepted records.
- A schema migration or hosting change could make the current deployment unable to read existing data.
- Scheduled ingestion could publish a partially refreshed dataset without transaction boundaries or staging tables.
- Changing hosting may alter caching, environment bindings, deployment, and rollback procedures.

### Smallest stability proof

Before production cutover, run the selected database locally with a migration from empty state, ingest a fixed fixture twice, and prove the second run is idempotent. Assert one card, one sealed product, one missing-price record, and one 90-day history series round-trip through the database/API without shape or nullability changes. Also run the formatter checks for `$0`, a sub-dollar value, a four-digit value, positive/negative percentages, and `null`.

---

## Milestone 3 — Create one URL and leaderboard-state contract

### Objective

Make mode-specific state explicit and give the URL one owner. Introduce a typed query-state codec that parses, validates, defaults, and serializes both Singles and Sealed parameters. Keep shared state—mode, market, signal, strictness, theme-independent view preferences—separate from mode-specific filters.

Recommended shape:

- `SharedQueryState`: `mode`, `market`, `signal`, `strictness`.
- `SinglesQueryState`: rarities, query, sets, price/movement filters, sort, direction, page, page size, view.
- `SealedQueryState`: product types, query, sets, value/MSRP/profit filters, basis/scenario inputs, sort, direction, page, page size, view.

The selected market displayed in Sealed must match the URL. Switching markets should reset only market-dependent selections such as rarity, product type, and sets.

### Affected file paths

- new `app/state/market-query.ts`
- new `app/state/useMarketQueryState.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/CardFilters.tsx`
- `app/SealedFilters.tsx`
- `app/SignalControls.tsx`

### Potential breaking changes

- Existing bookmarked URLs may resolve to different defaults.
- Back/forward navigation could expose stale state if history events are not handled.
- Sealed market changes may now update parameters that previously remained hidden internally.
- Switching Singles/Sealed could unintentionally discard filters unless mode-specific state is preserved deliberately.

### Smallest stability proof

Add round-trip tests for one complex Singles URL and one complex Sealed URL: `parse(serialize(state))` must equal the normalized state. Manually load each URL once and confirm the market, mode, view, sort, page size, and active-filter count match the URL.

### Implementation note

Implemented with a single typed query-state codec and URL owner. A post-deployment validation exposed that replace-only synchronization made browser Back/Forward ineffective. The correction now uses `pushState` for meaningful navigation and control changes, `replaceState` for initial canonicalization and rapid search edits, and a restoration guard for `popstate`. Regression tests cover duplicate, search-only, pagination, view, and filter transitions. Milestone 4 remains paused until the corrected deployed behavior is validated in a browser.

---

## Milestone 4 — Extract shared request, history, and derived-metric hooks

### Objective

Replace duplicated effects with reusable data hooks and pure derivation functions after the hosting/database contract is stable. Separate fetching from calculation:

- `useCatalogPage` or mode-specific adapters for cards/products;
- a database-backed history query hook for cancellation, cache keys, coverage, and retry state;
- pure `deriveHistoryMetrics(points)` for 7/30/90 changes, 30-day low/high, historic low/high;
- explicit loading, partial, empty, and error states.

Use `AbortController` for request cancellation. The normal page path should read persisted daily history/derived metrics rather than fan out to hundreds of live TCGplayer requests. Keep a bounded on-demand fallback only if its coverage and freshness are explicit. Do not introduce a client-state/query library unless the native abstraction becomes demonstrably insufficient.

### Affected file paths

- new `app/data/useCatalogPage.ts`
- new `app/data/usePriceHistoryBatch.ts`
- new `app/domain/history-metrics.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/api/history/route.ts`
- `app/history-utils.ts`
- `app/market-utils.ts`
- `app/HistoryPanel.tsx`

### Potential breaking changes

- Race conditions could show history from the previous market or page.
- Request cancellation may leave loading indicators stuck.
- Cache keys could merge sealed and Singles variants incorrectly.
- A derived metric could change if cutoff/nearest-observation semantics drift.

### Smallest stability proof

Unit-test one dated history series against exact expected 7-, 30-, and 90-day changes plus 30-day and historic extrema. Add one cancellation test proving an obsolete request cannot update the active result. Run `npm test`.

### Implementation note

Implemented `useCatalogPage`, `usePriceHistoryBatch`, and `deriveHistoryMetrics` without adding a client-state dependency. Catalog requests expose idle/loading/success/empty/error states and retry; history requests use variant-aware cache keys, a four-request concurrency bound, AbortController cancellation, explicit coverage, and retry/status metadata. Singles and Sealed retain their existing target-selection limits. The client and `/api/history` now use the same dated-history calculation. Database-backed primary reads remain intentionally deferred until persisted history is backfilled and parity-tested.

---

## Milestone 5 — Introduce a shared leaderboard shell and view model

### Objective

Move repeated page composition into a shared `MarketLeaderboard` shell while retaining mode adapters. The shell should own common structure: market strip, heading, active-filter summary, controls row, sorting surface, result region, loading/empty/error states, and pagination.

Create mode-specific view models rather than forcing Cards and Sealed Products into an overly generic data object. Each adapter supplies columns, row cells, filters, history metrics, and supported views. Keep business calculations outside JSX.

### Affected file paths

- new `app/leaderboard/MarketLeaderboard.tsx`
- new `app/leaderboard/LeaderboardHeader.tsx`
- new `app/leaderboard/LeaderboardControls.tsx`
- new `app/leaderboard/ActiveFilterSummary.tsx`
- new `app/leaderboard/types.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/MarketUI.tsx`
- `app/SignalControls.tsx`

### Potential breaking changes

- Column order/alignment or accessible roles may change.
- Page reset behavior after search/filter/sort changes may drift.
- The signal column may disappear or default sorting may change on Hot Buy/Hot Sell views.
- Supported view options could leak between Singles and Sealed.

### Smallest stability proof

Render one Singles and one Sealed fixture through the shared shell and assert heading, active match count, column labels, active sort/ARIA direction, supported view labels, and pagination labels. Then run `npm test`.

### Implementation note

Implemented a slot-based `MarketLeaderboard` instead of forcing cards and sealed products into one record shape. Shared components now own page ordering, heading composition, active-filter summaries, control-row framing, request states, retry behavior, and numbered pagination. `singlesModel` and `sealedModel` retain their distinct views, sort labels, rows, calculations, filters, and disclosure behavior. Source-contract coverage verifies that both adapters use the shell, expose the expected view sets, retain shared pagination/status behavior, and keep removable filter summaries.

---

## Milestone 6 — Consolidate rows, full cards, history surfaces, and disclosure behavior

### Objective

Extract the repeated Medium/Text/Full presentation and hover/touch disclosure into shared primitives:

- `MarketRow` for keyboard and pointer behavior;
- `ProductIdentity` for image, name, secondary metadata, and signal badge;
- `HistoryPopover` for placement and focus management;
- `FullMarketCard` for the expanded layout;
- a shared `useDisclosurePopover` hook for hover, focus, Escape, touch, and viewport-aware placement.

Remove TCGplayer navigation from row anchors and artwork. Convert each row to a non-navigational container/disclosure with valid keyboard semantics, then keep chart range controls and history interaction inside the disclosure panel. Keyboard focus entering the history panel must keep it open. Do not add a replacement TCGplayer link or button in this milestone; that is a later product-design decision.

### Affected file paths

- new `app/leaderboard/MarketRow.tsx`
- new `app/leaderboard/ProductIdentity.tsx`
- new `app/leaderboard/HistoryPopover.tsx`
- new `app/leaderboard/FullMarketCard.tsx`
- new `app/hooks/useDisclosurePopover.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/HistoryPanel.tsx`
- `app/PriceChart.tsx`
- `app/DeferredImage.tsx`
- `app/market-utils.ts`

### Potential breaking changes

- Users who currently click anywhere on a row or image to open TCGplayer will lose that navigation by design.
- Pointer travel between row and popover may close the panel.
- Popover flipping may position offscreen near viewport edges.
- Touch tap-to-reveal/tap-again-to-open behavior could regress.
- Focus order and screen-reader announcements may change.
- Removing the anchor may also remove implicit focusability unless the disclosure receives explicit semantics and keyboard handling.

### Smallest stability proof

Add one interaction test that proves rows and artwork have no external link, opens a Medium row panel by pointer/focus, moves into a chart range button without closing it, and closes with Escape. Repeat through the Sealed adapter. At a short viewport, assert the placement data attribute flips below. Assert there is no nested interactive content.

### Implementation note

Implemented `MarketRow` with native `<details>/<summary>` disclosure semantics and a shared `useDisclosurePopover` controller for fine-pointer hover, focus retention, Escape, touch toggling, vertical placement, and large-card horizontal flipping. The interactive `HistoryPopover` is a sibling of the summary trigger, so chart buttons are no longer nested inside an anchor or disclosure trigger and pointer/focus can move into the panel without closing it. `ProductIdentity` and `FullMarketCard` now provide the shared image/title and expanded-record structures while mode adapters retain their own fields and calculations. Contract tests cover both adapters, removal of product links, disclosure structure, supported interactions, and pure viewport-placement decisions.

---

## Milestone 7 — Build reusable filter and menu primitives

### Objective

Unify the duplicated filter mechanics while preserving mode-specific fields. Extract:

- `useDismissibleDetails` for outside click and Escape;
- `FilterButton` with active count, glow, chevron, and focus treatment;
- `RangeFilter` with consistent units and active styling;
- `CheckboxGrid` and `SearchableCheckboxGrid` for sets/rarities/types;
- `FilterActions` and shared removable summary chips.

Singles and Sealed should differ by configuration and fields, not by independently implemented checkbox/search behavior.

### Affected file paths

- new `app/filters/useDismissibleDetails.ts`
- new `app/filters/FilterButton.tsx`
- new `app/filters/RangeFilter.tsx`
- new `app/filters/CheckboxGrid.tsx`
- new `app/filters/FilterActions.tsx`
- `app/CardFilters.tsx`
- `app/SealedFilters.tsx`
- `app/MultiSelectField.tsx`
- `app/page.tsx`
- `app/SealedView.tsx`

### Potential breaking changes

- “All” semantics may change when every individual option is checked.
- Active-filter counts or capitalization may differ.
- Outside-click handling could close before a checkbox change is committed.
- Market changes might fail to reset set/type filters.

### Smallest stability proof

Write one shared checkbox-grid test covering All, select-one, select-every-item normalization, search, and reset. Render the Singles and Sealed filter buttons with two active fields and assert the same active-count/focus/chevron contract. Run `npm test`.

### Implementation note

Implemented `useDismissibleDetails`, `FilterButton`, `RangeFilter`, `CheckboxGrid`, `SearchableCheckboxGrid`, `FilterActions`, and the pure `toggleSelection` normalization helper. Singles and Sealed now configure their unique ranges and checkboxes through the same primitives; `MultiSelectField` also uses the shared dismissal and selection logic. Selecting the final remaining option normalizes to the existing empty-array All representation, outside pointer events close menus without intercepting internal changes, and Escape closes a menu while returning focus to its summary. Automated coverage checks individual toggles, select-everything normalization, shared component composition, labels, and dismissal behavior.

---

## Milestone 8 — Replace CSS override layers with component-owned styles and tokens

### Objective

Stop the append-only cascade. Inventory current selectors, define stable design tokens, and migrate by component rather than rewriting all styles at once. Recommended order: controls, market strip, filters, tables/rows, history panels, cards, responsive layouts.

Consolidate repeated colors, shadows, borders, heights, radii, typography sizes, transitions, z-indexes, and breakpoints. Reduce `!important`, broad descendant rules such as `.market-strip span`, version comments, and duplicate media blocks. Use low-specificity component classes or CSS modules; do not mix approaches without a documented rule.

### Affected file paths

- new `app/styles/tokens.css`
- optional component `.module.css` files under `app/`
- `app/globals.css`
- `app/market-views.css`
- all shared UI components whose class names change

### Potential breaking changes

- Dark/light theme contrast may regress.
- Column alignment, sticky/overlay stacking, or popup shadows may change.
- Medium artwork can be cropped by inherited image rules.
- Mobile grids may overflow or controls may lose equal heights.
- Reduced-motion behavior may be dropped during migration.

### Smallest stability proof

For each migrated component family, capture or compare four representative states: desktop dark, desktop light, mobile dark, mobile light. At minimum assert computed control height, selected state, focus visibility, no horizontal overflow, and popover z-index/placement. Run `npm test` after every component-family migration, not only at the end.

### Implementation note

The first safe migration slice establishes `app/styles/tokens.css`, `app/styles/market-controls.css`, and `app/styles/market-content.css`, imported in explicit base-to-component order from `app/layout.tsx`. Current strictness, signal, medium-art, navigation, loading-state, row-disclosure, full-card, responsive popover, joined-border, hover-lift, and reduced-motion contracts now live with their component families instead of the versioned tail of `app/market-views.css`. Historical feature rules remain in the legacy stylesheets for later component-by-component cleanup; the milestone intentionally avoids a one-shot rewrite. The large popover now uses `top: 0` and `min-height: 100%`, matching the card tile without a one-pixel top or bottom overhang.

---

## Milestone 9 — Unify catalog querying and pagination behind a repository/service layer

### Objective

Give client and server search/sort/filter logic one database-backed implementation. Introduce a catalog repository interface and extend server-side pagination only when Pokémon or Riftbound dataset size or query cost justifies it. The initial implementation should not retain a Magic-only adapter or special branch.

Keep fuzzy-search semantics, null sorting, deduplication, filter capitalization, and total counts identical across markets. Remove the hard-coded production-origin fetch from `/api/cards`; use local bundled assets, request origin, or a configured source that works in preview and production.

### Affected file paths

- new `app/data/catalog-repository.ts`
- new `app/data/catalog-query.ts`
- `app/api/cards/route.ts`
- `app/page.tsx`
- `app/SealedView.tsx`
- `app/market-utils.ts`
- `public/data/*.json` consumption paths during migration
- `vite.config.ts` only if a runtime binding is justified

### Potential breaking changes

- Result totals or ordering may differ from the client implementation.
- Fuzzy searches such as “umbreon 161” or “teemo over” may regress.
- URL page numbers may exceed the newly calculated page count.
- Deployments may fail if the repository reads files differently in Cloudflare workers.

### Smallest stability proof

Run one query matrix against both the old fixture implementation and the new repository: empty query, multi-token partial query, typo, set filter, ascending/descending nullable price sort, and page boundary. Assert identical product IDs and totals. Then run a production build to prove worker-compatible asset access.

---

## Milestone 10 — Harden ingestion, history caching, and scheduled jobs

### Objective

Separate source clients, normalization, validation, and output writing in the sync scripts. Make daily jobs idempotent and observable. Record source update time, counts, rejected records by reason, duplicate decisions, and schema version. Add bounded retries and fail the job before replacing the last good feed when validation thresholds fail.

For history, operationalize the database-backed daily snapshot and derived-signal jobs designed in Milestone 2 so Hot Buy/Hot Sell pages do not issue hundreds of browser-triggered requests. Store coverage and observation dates with every derived signal. This milestone should not claim sales rank or volume unless an authorized transaction source is added explicitly.

### Affected file paths

- `sync-tcgcsv.mjs`
- `sync-sealed.mjs`
- `sealed-product-utils.mjs`
- new `scripts/clients/`, `scripts/normalize/`, and `scripts/validate/` modules
- `app/api/history/route.ts`
- `app/domain/history-metrics.ts`
- `public/data/`
- `.openai/hosting.json`, `db/`, and `drizzle/` only if durable storage is approved

### Potential breaking changes

- Product counts may change when validation becomes stricter.
- Deduplication may select a different release variant.
- A failed refresh could leave stale-but-valid data, requiring a visible freshness indicator.
- Durable history storage would require migrations and deployment bindings.

### Smallest stability proof

Run each sync twice against the same cached source fixture and assert byte-equivalent normalized output, unique product IDs, valid market ownership, and explicit nullable values. Simulate one malformed upstream response and prove the script exits without overwriting the last good fixture.

---

## Milestone 11 — Expand the test pyramid and continuous quality gates

### Objective

Make the smallest useful test type protect each layer:

- unit tests for pure pricing, range, signal, formatting, normalization, and query-state logic;
- contract tests for generated feeds and API responses;
- rendered-component tests for shared controls and mode adapters;
- a small browser suite for critical user journeys rather than exhaustive snapshots;
- build, lint, and type checks in automation.

Critical journeys should include restoring a shared URL, changing markets, applying/removing filters without layout shift, sorting, pagination, switching modes/views, opening and interacting with history, touch disclosure, dark/light themes, and missing-data rendering.

### Affected file paths

- `tests/`
- new `tests/components/`
- new `tests/e2e/`
- `package.json`
- test-runner configuration files
- CI workflow files if repository automation is added

### Potential breaking changes

- Browser tooling can increase install/build time.
- Brittle visual snapshots can create noise if used too broadly.
- Tests may expose existing accessibility defects that require product decisions.

### Smallest stability proof

Create one smoke journey that loads a Singles URL, applies and removes a filter, changes sort, opens history, switches to Sealed, and confirms the URL and visible controls remain consistent. Require `npm test`, `npm run lint`, and that smoke journey to pass before merging future UI work.

---

## Milestone 12 — Repository cleanup and maintainer documentation

### Objective

Make the intended workflow obvious after the architecture stabilizes. Replace the starter README with Raw Signal setup, data refresh, testing, architecture, and deployment guidance. Move or label legacy research artifacts. Ignore all deployment archives. Document data ownership and the difference between listing prices, market history, and unavailable sales-volume data.

### Affected file paths

- `README.md`
- `AGENTS.md`
- `.gitignore`
- `research.mjs`
- `cards.json`
- optional new `docs/architecture.md`
- optional new `docs/data-sources.md`

### Potential breaking changes

- Moving legacy scripts can break undocumented local commands.
- An overly broad ignore rule could hide a legitimate fixture archive.
- Documentation can drift if ownership is not assigned.

### Smallest stability proof

From a clean checkout, follow the README to install, run the site, execute `npm test`, and identify the production data-refresh scripts without relying on tribal knowledge. Confirm `git status` does not list build output or `site-package*.tar.gz` files.

---

## Recommended delivery order and checkpoints

1. Complete Milestone 0 first so scope removals and architectural changes have a baseline.
2. Ship Milestone 1 independently. Removing Magic is a deliberate product-scope change and should not be hidden inside a refactor.
3. Treat Milestone 2 as an architecture decision and infrastructure project with an explicit migration, cutover, and rollback plan. Do not start the authoritative data/history abstractions until this decision is approved.
4. Ship Milestone 3 independently because URL/state changes are highly user-visible.
5. Complete Milestone 4 before Hot Buy/Hot Sell logic expands further.
6. Ship Milestones 5, 6, and 7 as separate pull requests: shell, rows/disclosure and link removal, then filters.
7. Migrate CSS in slices under Milestone 8; never perform a one-shot stylesheet rewrite.
8. Complete Milestone 9 before adding substantially larger catalogs or new ranking fields.
9. Treat Milestone 10 as data operations work that completes the daily jobs designed in Milestone 2.
10. Add tests continuously; Milestone 11 formalizes the final gate rather than postponing testing.
11. Finish with Milestone 12 so documentation describes the resulting architecture, not the transitional one.

## Definition of done for the refactor program

- `app/page.tsx` is an application composition layer, not the Singles implementation.
- `app/SealedView.tsx` is a thin Sealed adapter, not a second application.
- Shared controls have one implementation and one state/interaction contract.
- Magic is absent from active navigation, indexes, synchronization, and API branches, while future market extension points remain documented.
- Singles and Sealed URLs restore the exact visible state.
- Client and server catalog queries return the same ordering and totals.
- The selected hosting/database design is documented, migrated, backed up, observable, and used as the authoritative catalog/history boundary.
- History calculations and signal evidence use one tested derivation path.
- Rows and artwork do not navigate to TCGplayer; no chart controls or buttons are nested inside navigation links.
- Component styles no longer depend on broad descendant selectors or routine `!important` overrides.
- Generated feeds are validated, reproducible, and never silently replaced by malformed data.
- Critical desktop, mobile, dark, light, keyboard, pointer, and touch journeys have focused regression coverage.
- The README and `AGENTS.md` accurately describe the maintained system.
