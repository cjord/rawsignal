# Article editor reliability — staging release, November 7, 2026

## Release state

- Application source `6364133` pushed to `codex/article-editor`.
- Deployed staging Worker version `a5591841`; Articles remains enabled.
- Not merged to main, deployed to production or activated there.
- No migration, market ingestion, schedule, credential or remote article mutation.
- Both real queued articles remain at revision 1 / Needs Review, unpublished.

## User-visible changes

**Published Article Freeze** makes content permanently read-only after first
publication, including after withdrawal. Server guards prevent edits and close the
save/publication race. **Write a Follow-up** starts a new article linked to the
published original without copying stale prices, forecasts, dates or private notes.

**Portable Draft Backups** preserve saved shorthand-to-printing bindings in a
versioned JSON format. Restore verifies catalog identities; unavailable printings
do not become guesses. Unfinished publication fields can be backed up, but strict
save/review checks still apply. Legacy text-only backups remain supported with a notice.

**Evidence Date Precision** supports date-only research and explicitly recorded
times. Existing stored dates are preserved. **Structured Forecast Tables** render
independently of the Markdown text budget, with a shared lazy chart cache. All forty
rows remain visible in a near-limit article.

**Article Section Navigation** adds jumps for reader headings, forecasts and sources,
and for editor details, links, text, research, preview, checks, review and history.
Editor jumps open disclosures, switch the mobile view and move focus. A desktop
save/status toolbar remains available while scrolling. Keyboard focus now brings a
distant product link into view before positioning its preview.

The [specification](articles-editor-reliability.md) records the contracts and limits.

## Automated validation

Final `npm run check` passed the production build, **715 unit tests** (one existing
skip), lint with zero errors/21 existing complexity warnings, TypeScript, and
**185 Chromium journeys** (8.3 minutes). All twelve article browser journeys passed.
Desktop/mobile and dark/light article screenshots were inspected. Browser mobile
emulation is not physical-device acceptance.

Coverage includes permanent freezing after unpublish, concurrent save/publication,
legacy released history, draft conflicts and audit rollback, portable restoration
after a name becomes ambiguous, missing/invalid identities, incomplete backups,
date-only precision, duplicate heading anchors, mobile jumps, forty long-article
forecasts and shared history requests. An earlier focused long-article check caught
offscreen keyboard focus closing its preview; the fix passed the subsequent full gate.
An interim full run was stopped to correct date-control state after restoring a draft;
the complete final gate was rerun. No assertion or timeout was weakened.

## Live staging verification

- Public library/API: 200 and no-store, zero published articles.
- Invalid filters: 400; unpublished article: 404.
- Unauthenticated admin API: 401; admin page: 303, both private/no-store.
- Session, Auction House and Pokémon sealed landing: successful responses.
- Exact products, named card links, collector numbers, Signature stars and set
  qualifiers still resolve correctly; a mismatched set does not guess a printing.
- Existing bindings, twelve plaintext settings, account isolation and zero staging
  schedules were preserved.
- Read-only before/after article metadata matched exactly: two articles, two saved
  revisions, unchanged review states/published pointers, zero public articles.

## Remaining acceptance and editorial work

The user authorized a clearly labeled temporary staging publication followed by a
blocked edit and unpublish. **That live admin test was not performed.** The computer
connection failed before Chrome could be selected (missing kernel-assets path),
including after reset. No session was fabricated and no database write bypassed the
admin workflow. Automated tests cover that lifecycle, but do not replace live admin
acceptance. Resume it when the browser connection works; real drafts stay unpublished.

Refreshing Radiance/Delta Reign evidence is deferred while editor improvements are
reviewed, per the user's selection. Fresh source capture, ownership disclosure and
human preview remain required before real publication. Subsequent published coverage
must be a new article. Scheduled article drafting remains inactive.

Unrelated TODO edits, local article drafts, the image, private operational files and
generated deployment configuration were excluded from source commits.
