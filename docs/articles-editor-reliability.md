# Published Article Freeze and editor improvements

Decision: November 7, 2026. Published articles will not be revised. Follow-up
analysis uses a new article. Existing queued drafts and their evidence stay intact;
refreshing their research is deferred at the user's request while editor work proceeds.

## Published Article Freeze

The first publication freezes all stored content permanently, even if withdrawn.
Admin fields/import/save become disabled. Server writes fail with a descriptive 409,
and the conditional SQL update closes the publication-versus-save race. No migration
is needed: existing first-publication timestamps provide the lock. Draft revisions,
conflict protection, atomic audit writes and legacy published history are retained.

Unpublish and Archive remain emergency visibility controls. They do not permit
editing or re-publishing the same article. **Write a Follow-up** opens a new unsaved
article with the same game/set/byline/disclosure and a link to the original. Its URL,
observation/target dates, forecasts, sources beyond the earlier article, and private
notes must be established anew. Source content is read from the published snapshot,
never a legacy unpublished head. Each new article receives the normal explicit review.

Product previews remain current and separately dated, as previously agreed. They
do not rewrite prose, quoted prices, stored identities or forecasts.

## Portable Draft Backups

JSON format `raw-signal-article`, version 1, stores the validated draft plus exact
product IDs and the shorthand names bound to them. The Markdown remains unchanged;
code/escaped examples are never rewritten. A restored name cannot drift to a newly
added printing. Both the preview lookup and save re-read catalog IDs. Backup prices,
images, names and arbitrary metadata are not trusted as catalog data. Missing IDs
block the save with a useful error; they are not guessed from a similar name.

Bindings are bounded to 40 products/names and 6,000 alias characters, filtered to
names actually used, with conflicts rejected. Unknown backup versions are rejected
without replacing the buffer. Legacy text-only JSON remains importable with a notice
that names need rechecking. Backups include private research notes: keep them private.
They are manual recovery files, not an automatic cross-device save mechanism.

## Evidence Date Precision

Observation values accept a genuine date-only `YYYY-MM-DD` or an exact UTC timestamp.
The editor defaults to date only and allows recording a known local time explicitly.
Readers see a readable date and UTC time only when recorded. Invalid/future dates
and targets before the observation are rejected at review. Existing timestamps are
not reinterpreted or silently converted; a prior midnight value does not prove that
only a date was known.

## Structured Forecast Table

Forecast rows are rendered directly from typed records, separately from the 60,000
character Markdown body budget. All 40 supported rows remain visible in a long
article. Plain-text rationale cannot inject Markdown/HTML. Product links in prose
and forecasts share one lazy history cache and one active popup. The named overflow
region is keyboard-scrollable on small screens.

## Article Section Navigation

The editor has jumps to details, links, text, evidence/forecasts, preview, checks,
review and revision history. Jumps open the relevant disclosure, change the mobile
Write/Preview view when needed, and move keyboard focus to the destination. The
desktop save/status toolbar stays available; narrow layouts use a normal toolbar
to avoid covering content. Publish controls remain in one review section.

Reader/preview navigation is generated from actual Markdown headings, plus forecasts
and sources. Duplicate headings have distinct instance-scoped anchors, including
when several revision previews appear together. Section jumps do not fetch card
history or require animation.

## Verification boundaries

Automated checks cover the freeze after withdrawal, concurrent publication/save,
legacy history, restoration through catalog ambiguity, invalid/missing identities,
date precision, duplicate anchors, long forecasts and browser interactions. A
temporary labeled staging article is authorized for publish → blocked edit →
unpublish acceptance. Real queued articles must remain unpublished. Production,
market ingestion, scheduled drafting and account storage are outside this release.

Remaining editorial work: fresh source capture, ownership disclosure review and
human preview before any real article publication. No automatic schedule is enabled.
