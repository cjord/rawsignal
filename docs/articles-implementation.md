# Articles — implementation and release notes

October 27, 2026. Implemented locally on `codex/article-editor`; not deployed,
migrated remotely, enabled, or populated with a published article.

## Available features

- **Article Library** `/articles`: game/category filters, title/set search, bounded
  pagination, and responsive tiles. Desktop navigation gains Articles. On phones,
  **More Pages** holds Articles, Buy List and Import instead of adding more tiny tabs.
  Escape or clicking outside dismisses that menu. Articles navigation is hidden by
  the server-rendered feature flag without an account-loading flash.
- **Article Reader** `/articles/[slug]`: readable prose, contained tables, byline,
  observation time, forecast horizon, sources, ownership disclosure, AI-assistance
  label, publication history, canonical metadata, and dated previous public revisions.
- **Editorial Queue** `/admin/articles`, **Admin Article Editor** `/admin/articles/new`
  and `/admin/articles/[id]`: existing verified admin access only. Markdown editor,
  desktop side-by-side preview, mobile Write/Preview controls, exact catalog product
  insertion, sources, private research notes, optional structured forecast ranges,
  Markdown import, downloadable/restorable JSON draft backups, revision comparison.
- Default public byline is **Raw Signal Editorial**, editable before publication.
  Private author/publisher identifiers are stored independently from the public byline.
- Explicit Save → Submit for Review → Approve → Publish. One admin may perform all
  steps. Approving and publishing both require checking review of the saved revision;
  publication also has a confirmation. Changing text clears the review acknowledgment.
  Return for Changes, Archive and Unpublish are available.

## Data and safety boundaries

Migration `0029_articles.sql` adds environment-local `articles`, immutable
`article_revisions`, and `article_releases`. Game saves and shared login storage are
unaffected. `db/articles.ts` owns revision checks, catalog resolution and publication.
`worker/article-routes.ts` reuses the authenticated admin boundary, origin checks,
bounded JSON and existing write-rate limiter. Actor IDs contain no embedded emails;
they intentionally have no environment-local auth foreign key because identity is shared.

Draft saving increments the head revision without changing the published pointer.
Concurrent/stale changes fail instead of overwriting another editor. Each mutation
and its audit event run in the same D1 batch; audit failure rolls back the mutation.
The client preserves its buffer on failed/conflicting writes and never automatically
replays publication. Use Load Latest Saved Revision to reconcile an ambiguous response;
download a backup first if keeping the unsaved buffer matters. Drafts are not silently
stored in a guest browser or synchronized as game progress.

After first publication the slug is fixed. A substantive correction requires a new
saved/reviewed revision and a public correction note. Earlier published releases remain
readable through `?revision=N`; unpublished drafts do not. Unpublishing or archiving
revokes access to every public revision. Public payloads allowlist content and exclude
research notes, account IDs and internal queue state.

All article HTML and APIs initially use **no-store**, deliberately favoring immediate
withdrawal and simple correctness over a new content-cache invalidation system. The
existing market caches are unchanged. `/articles/sitemap.xml` contains only currently
published canonical slugs, never private drafts or revision query links; it is also
no-store and linked from the article shell. Prior public revisions are noindex.
Revisit bounded revision-aware caching after measuring actual article traffic.

Markdown is tokenized by pinned `marked` and rendered through an allowlisted React
renderer. Raw HTML/MDX/scripts and external embedded images never execute; unsafe URLs
cannot become clickable links. Importing Markdown does not publish it. Review rejects
unsupported embedded content, missing metadata/sources, future/invalid observation
times, unknown product identities, and incomplete structured forecasts. Limits:
60,000 text characters, 40 unique referenced products, 40 forecasts, 30 source links,
140KB request body, 12 articles per library/queue page, 20 revisions per history page.

## Article Card Links and Article Card Previews

Named products use explicit `/cards/[id]` or `/sealed/[id]?market=...` links. The
catalog picker displays set, number and printing; it never fuzzy-links champion names.
The current implementation uses each exact catalog product's primary printing and
English Near Mint / sealed Unopened history. It does not support choosing a different
condition or alternate variant of the same product ID in the editor.

Unique product identities are resolved in a bounded lookup. History loads on actual
hover/focus/touch reveal and deduplicates across repeated mentions. Previews reuse
HistoryPopover, HistoryPanel, PriceChart and stored history snapshots; they never
initiate upstream marketplace reads. Missing prices and histories stay unavailable,
while prose and canonical product links remain usable. Desktop click navigates; touch
opens a preview with a View Details link. Escape, outside click, keyboard focus,
preview preferences and retry are supported.

The preview says Current Market History and names its snapshot date. It never updates
an article's historical quotes, observation timestamp or editorial forecasts. The editor
cannot infer every unlinked card name in natural-language prose: confirming that all
specific card mentions have the correct links remains part of human review.

## Activation and rollback

The deployment preparer accepts `--articles true` only with accounts and account tools.
Absent explicit activation it writes `ARTICLES_ENABLED=false`, even when inherited
config had the flag enabled. There are no new secrets, schedulers or paid services.

On a separately authorized staging release: pass the full gate, commit/push the exact
validated source, prepare/deploy with Articles disabled, take the required private
backup, apply migration 0029 **after** deployment, then explicitly enable Articles in
a prepared deployment. Test real authenticated admin/member/guest access, create a
disposable draft, review/publish/revise/unpublish it, and verify private fields and
cache withdrawal. Do not call a mocked browser fixture live account acceptance.
Production follows its own authorization, backup, migration and acceptance steps.
Rollback disables the feature first and retains editorial tables/history; do not drop
published history to roll back UI code.

## Editorial material and remaining decisions

The October 23 drafts and October 27 Radiance refresh remain separate, unchanged by
editor operations. No draft was imported into a remote database or published. Human
review must confirm the final ranges, source timestamps and ownership/conflict wording
before the first public release; Ezreal/Orianna grading belongs in a separate article.

Separate Pokémon/Riftbound Monday recaps and first-of-month monthly recaps remain
planned. Exact Eastern Time run time, generator, notification destination and restricted
producer credentials are unchosen; no schedules or machine-submission endpoint are
activated. A later producer should have idempotent draft-only submissions, never publish
permissions. Forecast scoring, feeds and automatic research collection are later work.

## Verification

`tests/articles.test.mjs` exercises real SQLite migrations, draft/public isolation,
earlier releases, no-store sitemap withdrawal, exact product lookup, unavailable
prices, review/state checks, concurrent editors, atomic audit rollback, private-field
stripping, admin role/origin enforcement, payload limits and explicit flag activation.
`tests/e2e/articles.spec.ts` exercises editor review/publication with mocked endpoints,
conflict-buffer retention, on-demand/deduplicated charts, safe rendering, keyboard and
touch interactions, preferences, and both themes at desktop/phone widths.
Full repository gate results are recorded at handoff; local automated browser contexts
are not physical devices or a staging deployment.

October 27 final gate: `npm run check` passed the production build, 703 unit tests
(one existing skip), lint with zero errors and 21 existing complexity warnings,
TypeScript checking, and all 173 Chromium journeys. The article checks include the
light/dark publication-history regression. `git diff --check` passed. No push,
deployment, remote migration, feature activation or real article publication occurred.
