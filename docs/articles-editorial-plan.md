# Articles and Editorial Review

Agreed 2026-10-21: separate Pokémon and Riftbound weekly recaps; data-led, readable
analysis with a clearly labeled editorial outlook; weekly drafts on Monday and a
monthly recap on the first. The editor, library and reader are now implemented locally;
see [implementation and release notes](articles-implementation.md). No scheduler,
remote migration, activation or publication has occurred. Initial local drafts live in
`docs/article-drafts/`; they are not automatically imported into the app.

## Confirmed first-article decisions — October 27, 2026

- First public candidate: Radiance singles and sealed outlook. Grading is a separate
  article; do not include personal PSA/Beckett calculations in the release outlook.
- Primary current-price benchmark: matching English Near Mint delivered asking prices
  for singles, and English Unopened delivered offers for sealed, before sales tax.
  Check recent completed sales alongside offers; label sale-row shipping treatment
  unavailable when it cannot be established. Keep database/live market prices separate.
- Refresh the analysis to October 27 evidence; do not present the October 23 capture
  as current. The forecast target remains **November 22, 2026**, release +30 days,
  explicitly confirmed after the fresh-data request. It is not rolling publication +30.
- Preserve earlier drafts, withdrawn forecasts and source timestamps. A revised range
  is a new dated editorial judgment, not a retroactive release-day prediction.
- Current candidate and evidence: `article-drafts/radiance-price-outlook-2026-10-27.md`
  and `article-drafts/radiance-evidence-2026-10-27.md`. These remain unpublished.
- Use **Price Outlook** for editorial ranges, keeping them distinct from the site's
  defined modeled fair value. Minimum asks, historical market observations and sales
  are different measures; their gaps are not like-for-like investment returns.

The first software release **includes the on-site Article Editor and submissions by
signed-in admins**, alongside the public library/reader; it is not a static-only
article release. Any existing admin may author, submit for review and explicitly
publish after reviewing the exact preview, including their own submission. A second
admin is not required. No new account role or broader permission grant is implied.

**Article Card Links** must link every specific card mention to its exact internal
card view. **Article Card Previews** show current, clearly dated market history on
hover/focus and the existing touch-preview interaction; quoted article prices,
evidence and forecasts stay frozen. These choices were explicitly confirmed October27.

Confirmed byline: **Raw Signal Editorial**, editable before publication. Desktop
navigation gains Articles; phones group it with Buy List and Import under More.
Still to confirm before public activation: article-specific ownership disclosure and
final editorial review; later generator, run time and review notification destination.
No automated schedule or publication is activated by this plan.

## Feature names and page anatomy

- **Article Library** (`/articles`): featured/recent tiles, game/set/category filters.
- **Article Reader** (`/articles/[slug]`): narrow reading column, dated byline, sources,
  Article Card Links/Previews and reusable exact-printing comparison blocks. Wider tables may scroll
  within their container, not the whole phone page. Reuse current site tokens,
  Product Identity, InfoHint, contained artwork and market-history components.
- **Editorial Queue** (`/admin/articles`): draft state, game/period, author/generator,
  source freshness, unresolved checks and reviewer. Admin-only, private/no-store.
- **Admin Article Editor** (`/admin/articles/new`, `/admin/articles/[id]`): create/edit
  text, title, summary, game/set/category, sources and forecasts; save draft, submit
  for review, preview, inspect revision diff and explicitly publish. Sanitized Markdown
  plus allowlisted typed comparison/card blocks and a source/evidence side panel.
  Do not execute arbitrary MDX,
  generated HTML or scripts. Untrusted source text is evidence, never agent instructions.
- **Forecast Record**: frozen editorial price range, exact printing/language/condition,
  USD basis, observation date, horizon, rationale, confidence label and invalidation
  conditions. Distinct from live prices and existing modeled fair value.

Use existing desktop navigation style. Phones use an accessible More menu rather than
squeezing an eighth destination into the tab bar.

## First-release editor, submission and publication contract

- Use the existing server-enforced admin session/role boundary for both pages and
  APIs. Hiding controls is not authorization. Guests and ordinary members may read
  published articles but cannot submit, edit or publish; this is not public user
  submissions or an invitation to introduce a new contributor role.
- Provide Draft, Needs Review, Approved and Published states, plus Rejected/Archived.
  An admin can write manually, paste a researched draft or import a validated draft
  file, then explicitly submit it to the Editorial Queue. Automated jobs are a later
  separate producer, not a prerequisite for admin authorship.
- Publication is an explicit human action against an exact saved revision, after
  preview/review. One admin may perform both roles; record author/submitter and
  publisher independently even when they are the same person. Editing after review
  invalidates approval for that revision; stale editors cannot publish over a newer
  draft. Saving never silently updates the public revision.
- Store article documents and immutable revisions in dedicated article storage in
  the existing environment's D1, with a separately readable published projection.
  Do not put editorial content into account-game saves or add an external CMS service.
  Migration 0029 implements this storage locally; applying it still requires the
  existing migration/release procedures. Share login identity, not staging article drafts or
  publication records, across staging and production.
- Reuse site controls, notifications, light/dark tokens and responsive layout. Keep
  editor and preview side by side on wide screens and as accessible views on mobile.
  Start with a text/Markdown editor plus structured product insertion; a rich-text
  document framework or collaborative editor is not needed for the initial workflow.
- Use revision-checked saves with visible saved/unsaved/conflict/error feedback;
  preserve unsaved text on recoverable failures. Confirm the expected revision before
  replacing an editor buffer. Do not overwrite another admin's work or automatically
  replay a publication after an ambiguous response; reconcile publication state first.
- Reuse origin/CSRF checks and bounded request validation for private writes. Sanitize
  Markdown and URLs, disallow executable MDX/raw scripts and unreviewed external embeds.
  Audit create, submit, approve, publish, correction and unpublish actions with actor,
  article and revision identifiers. Audit logs must not duplicate entire drafts or
  expose source credentials/private account data.
- Keep draft previews private, no-store/noindex and out of public APIs, sitemap and
  feeds. Public cache keys depend on the published revision; publishing/unpublishing
  invalidates the public article and library entry without rebuilding the website.
  Substantive published corrections require another reviewed revision and visible
  correction history; keep previously published forecast records available.

## Article Card Links and Article Card Previews

### Exact product references

- Every specific card-name mention in prose, headings, captions and tables is an
  internal link to `/cards/[productId]`; sealed product references use
  `/sealed/[productId]?market=riftbound` (or the correct market). External TCGplayer,
  eBay and publisher citations remain separate supporting links, not replacements
  for the site's individual product view.
- The editor's product picker searches the existing catalog, displays set, collector
  number, language/printing/treatment and artwork, and inserts an exact typed product
  reference. Store at least kind, product ID, intended printing/condition and display
  label; retain a small identity snapshot so old articles remain intelligible.
  Selecting the printing is mandatory when a shared name has multiple treatments.
- Recognize validated internal product links when importing existing Markdown and
  render them through the same reference component. Do not build a second system
  for imported drafts. Do not auto-link ambiguous plain champion names by fuzzy
  matching: Ezreal180, Ezreal180* and Spiritforged Ezreal248 are different products.
  Flag unresolved references for the reviewer; insert links explicitly and check
  unlinked named-card mentions before publication. Never silently substitute a card.
- Resolve the unique referenced products in one bounded public-data operation for
  article rendering, not one detail request per occurrence or a full catalog download.
  Repeated mentions share identity/history lookup state. Archived/missing prices or
  history remain unavailable; keep the identity, citation and canonical link without
  fabricating a value or switching to another printing.

### Reading interaction and current-versus-frozen data

- Reuse `HistoryPopover`, `HistoryPanel`, `PriceChart`, the stored history target
  helpers and `usePriceHistoryBatch` rather than inventing a chart, history API or
  new upstream TCGplayer request. Reference `app/detail-tables.tsx` for the existing
  exact-printing chart composition and failure handling.
- On desktop, hover/focus opens a viewport-aware chart preview; clicking the name
  opens the product detail view. Keep a continuous pointer path into the interactive
  chart, visible keyboard focus, Escape dismissal and current range controls.
- On touch with previews enabled, follow the site's actual `MarketRow` behavior:
  tap toggles the preview, and its explicit **View details** link navigates. With
  previews disabled, the name navigates directly and no history loads. Preserve
  ordinary anchor hrefs for open-in-new-tab, copied links and no-JavaScript navigation.
  Do not introduce a hover-only requirement or nested interactive anchors.
- `MarketRow` is a block table/row shell built with details/summary; do not embed it
  unchanged in article paragraphs. Implement a small prose-compatible reference
  component that reuses the chart/content/positioning behavior, adapting the shared
  disclosure primitive only as necessary and preserving existing row behavior.
- History loads only on first actual preview reveal; deduplicate by product,
  printing/condition and snapshot/version across all mentions in the reader. No
  eager history fanout, artwork gating or layout shifts as charts load. Keep article
  text and links usable while a preview is loading, unavailable or retryable.
- Label the preview **Current market history · As of [date]**, with exact treatment
  and printing. It uses the current published stored snapshot, pinned consistently
  for that interaction; missing versions remain unavailable. It is not live lowest
  asking-price history or proof that the article's forecast was accurate.
- The article's quoted prices, source dates and forecasts are immutable editorial
  evidence. Today's chart never replaces its October27 quote, updates a prediction
  silently or changes a historical forecast score. A later article revision is explicit.

### Acceptance evidence before release

- Admin/manual draft → submit → preview/review → publish → revise/unpublish, including
  self-review, stale revision conflicts, failed saves and ambiguous publish responses.
- Guest/member direct page and API access denied for private operations; draft bodies
  absent from public HTML/API caches, search indexing and public article lists.
- Every featured and prose card mention resolves to the intended internal product;
  both unsigned and Signature variants with the same base name are tested. Sealed
  references use the sealed view. External citation links remain distinct.
- Desktop hover/click, keyboard focus/Enter/Escape, mobile preview/View details,
  hover preference off, light/dark, narrow reading/table layouts and chart failures.
- No initial per-mention history requests; repeated references reuse their request;
  current preview data cannot alter frozen article prices or published revisions.
- Check existing market/detail previews after any shared disclosure change, along
  with the normal complete release gate before a deployment is authorized.

## Draft cadence and evidence windows

Produce two weekly drafts (one per game) on Monday using the preceding complete UTC
Monday–Sunday window. Produce two monthly drafts on the first using the preceding
complete UTC calendar month. Exact run time/notification preference remains unchosen;
do not activate an automation until confirmed. If both run on Monday the first, keep
separate weekly/monthly periods, cross-link useful context and flag repetitive prose.

The period is a data window, not a promise that every observation is fresh. Freeze a
bounded evidence pack: publication/run IDs, UTC source dates, exact priced printings,
comparable baseline coverage, eligible/excluded counts, and dated publisher sources.
Use existing published read-only catalog/history/metrics snapshots; do not refresh
ingestion or perform one upstream request per card as part of generation. Never feed
private account collections, emails, imports, auth data or secrets into the generator.

Predeclare recap selection: comparable 7D/period movement, minimum coverage/value
rules, both risers and decliners, and material movers rather than hand-picked extreme
percentages from penny cards. The current Metrics mover eligibility ($10 singles,
$20 sealed before/after, anomaly exclusion) is a sensible reusable baseline; final
recap rules must be visible in each evidence pack. Existing 7D/30D metrics are not
automatically an exact weekly/monthly return: use dated cutoffs matching the article
window. Monthly does not silently mean rolling 30 days. Missing baselines stay N/A.

No completed-sale volume/rank claims from listing prices or observation counts.
Presale prices are explicitly labeled and separate from post-release comparisons.
Do not infer pull rates; cite publisher figures/curated evidence with their scope.

## Generation-to-review workflow

1. Read the immutable period evidence pack and prepare a draft using a fixed template.
2. Validate card/printing references, arithmetic, currency, dates, quote limits and
   factual sources. Mark missing inputs; never invent target prices or measurements.
3. Submit a draft plus evidence manifest and unresolved-check list to Editorial Queue.
4. Human admin reviews, edits and previews the exact revision. No automatic publishing.
5. An explicit Publish action records reviewed revision, reviewer and publication date.
   Later substantive edits require review again; retain previous published revisions.
6. Follow-up articles compare the original forecast to observed results without
   rewriting the old estimate or concealing misses.

States: Draft → Needs Review → Approved → Published, plus Rejected/Archived.
Public readers receive only the published revision; draft slugs/previews are private,
noindex, non-cacheable and absent from sitemap/feed. Future scheduled publication,
if wanted, may publish only an explicitly approved immutable revision; it is not part
of the initial automatic-draft design.

Generator identity is disclosed to reviewers, with an AI-assisted disclosure in the
public byline/methodology. Reviewer attribution is not invented. External publisher
content is summarized with direct citations, not copied into an article wholesale.
Initial horizon proposal: release +30 days, with optional clearly separate +90-day
scenarios. Targets remain editorial hypotheses, never catalog prices or guarantees.

## Codex/Claude submission options

**Start:** a Codex scheduled draft task can create Markdown/evidence files for review.
A Claude job can implement the same bounded evidence/submission contract. Choose one
producer per game/period initially; do not create competing duplicate schedules.
For local desktop runs, the computer/app must be running and required source/network
access must fit the task's configured permissions. Test one manual run before enabling
the cadence. A cloud/hosted runner can be explored separately when unattended local
availability is unsuitable; do not assume a web task has this local checkout.
[Official scheduling guidance](https://learn.chatgpt.com/docs/automations?surface=app).
Generating a draft does not grant permission to push code or deploy. Before an editor
exists, keep drafts local/reviewed; if a repository submission workflow is later
authorized, use a draft PR, not an automatic main push.

**With Article Editor:** prefer a dedicated draft-submission API over deploying the
site for every draft. A restricted generator credential may create/update only its
own Draft/Needs Review content, never approve/publish, read accounts or administer the
site. Store credentials privately. Idempotency key: game + cadence + period + template
version; content/source hashes identify a retry. Bounded size, rate limit, origin/CSRF
checks for browser admin writes, exact-revision checks, audit events, and key rotation
are required. A job rerun must not overwrite reviewed/published work.

Publishing uses a separate public article projection and initially no-store responses,
so unpublishing takes effect without new cache-invalidation machinery. Bounded caching
keyed by published revision remains an option after traffic measurement. Migration0029
and immutable editorial history are implemented locally; the deployment/migration gate
still applies. Private admin API responses never enter public caches.

## Initial editorial backlog

1. Radiance: launch premiums, scarcity and a 30-day outlook.
2. Delta Reign: prerelease evidence and how to form responsible card-price ranges.
3. Weekly Riftbound Market Recap; Weekly Pokémon Market Recap.
4. Monthly outlook plus forecast-review scorecard for each game.

The initial October 21 drafts withheld targets. Subsequent dated Radiance drafts add
provisional ranges and evidence, preserving the withdrawn October 23 database-based
version. The latest candidate is the October 27 refresh named above. Numerical targets
remain editorial judgments requiring human review, not calibrated predictions.
