# Collections interface review — 2026-10-21

Scope: account Collections, Holdings Ledger, Visit Movers, Sold History and Card Show
Events, including the previous locally completed sales/events work. This is not a
site-wide redesign or a change to the market's rarity/condition inclusion rules.

## Ten improvement areas

| # | Area and observed gap | Response |
|---|---|---|
| 1 | **First-use guidance:** empty accounts have disabled Add/Import controls; product-page add requests cannot proceed until a named collection exists. | Implemented a three-step onboarding tile. Creating the first collection continues the pending product/import dialog. Closing consumes transient action parameters. Clearing a catalog search now clears its loading state. |
| 2 | **Unit-price clarity:** a quantity-weighted market total is easy to mistake for the value of one card. | Implemented a secondary per-item market price alongside owned total. Dated-lot starting values and purchase costs explicitly say per item; asking prices stay separately labeled. |
| 3 | **Compact lot expansion:** expanding dated lots inside the narrow action column makes every cell in the row excessively tall. | Implemented a separate full-width details row below the compact holding, with grouped table semantics and a spanning cell. Card-grid browsing retains its contained artwork and details below. |
| 4 | **Data completeness:** partial gains are explained in small hints but missing prices/costs are hard to locate. | Implemented a Partial Coverage panel with actionable missing-price/cost filters, an additional missing-sticker filter, clear-filter control and matching counts. An explicit scope note says overview totals are for the selected collection, not the filtered ledger. |
| 5 | **Save/reload feedback:** successful actions have no clear acknowledgment; reload replaces content with a skeleton; ambiguous failures can be manually repeated. | Implemented existing site notifications after confirmed saves, exports and reloads. Reload retains content and filter/expansion context, with reserved progress space. Conflicts, session failures, server failures and unconfirmed replies block further writes until an explicit successful reload. Validation errors remain correctable in the form. |
| 6 | **Navigation state:** ledger pagination is local and may remain on an inappropriate page after filtering; sale filters/sort and show pagination disappear on navigation. | Implemented a dedicated pure query codec. Holdings/Sold/Events page, filters, coverage, sort and direction round-trip through the URL; filter/scope/section changes reset pagination. Transient add/import actions are excluded from normal URLs. |
| 7 | **Data portability:** account export exists, but no practical inventory/card-show worksheet exists. | Implemented viewed Holdings and Sold CSV downloads, covering all matching records rather than only the current page. Owned export is per dated lot; sold export is per recorded allocation. Includes explicit USD unit fields, stored costs/stickers, market provenance and unavailable blanks. Text is protected against spreadsheet-formula injection; downloads are user-initiated and private. |
| 8 | **Audited sales corrections/refunds:** completed sale cost/proceeds are intentionally immutable, so mistakes and returns need an explicit workflow. | Deferred. Add append-only adjustments with original sale linkage, reason, timestamp, prior revision and preview. Separate correction from genuine return; stock restoration must not duplicate quantities or erase original history. Missing legacy grouping cannot be reconstructed by name/date guesses. |
| 9 | **Collection lifecycle/bulk work:** moving show stock, archiving an empty collection, and changing multiple sticker prices are cumbersome or unsupported. | Deferred. Transfers must preserve dated baselines and provenance, distinguish transfers from market gains in review movers, and retain sale references. Prefer archive over destructive deletion where history exists. Batch sticker edits need preview/confirmation and all-or-nothing revision checks. Revisit normalized storage before increasing current document limits. |
| 10 | **Catalog/condition completeness:** exact matching is safe, but detail-only alternate printings, unsupported conditions and some new rarity labels are unavailable. | Deferred. Add only explicitly sourced printing/condition prices, plus deliberate rarity sections/heatmap mapping and reviewed feed regeneration. Never substitute another printing, infer prices from names, or treat absent costs as zero. The Radiance/30th coverage audit remains separate. |

## Interaction and design decisions

- Reuse existing notification duration preferences, dialogs, view tabs, sortable
  headers, pagination, product identity, image fallbacks and InfoHint controls.
- Keep the existing theme tokens and flat blue hover/focus feedback. Coverage uses
  the established warning token; sticker values remain purple. No new fonts/assets.
- Loading prices/text never depends on images. Ordinary reload preserves rendered
  content; first-load skeletons remain in-page, not route-level loading.tsx files.
- Keep critical save/conflict errors persistent and beside the workflow, with the
  dialog retaining inputs. Successes use bottom-right notifications rather than
  adding/removing layout banners. No automatic money/inventory merge or write replay.
- CSVs contain private holdings and costs; the export tooltip and notification state
  that clearly. They are snapshots of the current viewed data, not a live spreadsheet
  connection, marketplace upload or tax report. Missing values remain blank.
- Continue using session-derived ownership and one revision-protected account
  document. No schema migration, source-provider requests, scheduled task, new
  Cloudflare resource or production activation is needed for these UI improvements.

## Validation and rollout

Focused checks cover query defaults/round-trips, pagination reset, zero-vs-missing
coverage, CSV escaping/formula safety and legacy sales exports. Browser checks cover
guest gating, setup continuation, search clearing, stable reload, ambiguous-save
reconciliation, compact lot expansion, filters, whole-result exports, dated lots,
FIFO sales, card-show expenses, and dark/light desktop/mobile layouts.

Full `npm run check` passed: 652 unit tests (one skip), 126 Chromium journeys,
type check and lint with 21 existing complexity warnings and no new warnings.
Exact source push and staging deployment/verification are pending. Keep
the shared identity/save bindings and secrets unchanged, staging cron empty, compact
catalog caching off, and production unchanged. Signed-in live acceptance remains a
real admin/user check; local fixtures are not impersonation or physical-device proof.
