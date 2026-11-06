# Article Printing Selectors — staging release, November 6, 2026

## Released state

- Application source `e1bbde1` pushed to `codex/article-editor`.
- Staging Worker version `b5566aea`, Articles already enabled and retained.
- Not merged to main or deployed/activated in production.
- No migration, market refresh, secret change, schedule or remote article mutation.
- Both existing queued articles retain the same revision/state metadata; the public
  article count remains zero. No article was approved or published.

## User-visible changes

**Article Printing Selectors** extend double brackets with collector numbers and
set names. `[[ahri, inquisitive]]` resolves to the unique regular Origins printing;
`[[ahri, inquisitive SP3]]` and `[[ahri, inquisitive @ Vendetta]]` select the Vendetta
Special. Full numbers, letters, Signature stars and combined number/set qualifiers
are preserved. Remaining ambiguity requires qualification or an explicit picker ID.

Saved shorthand bindings remain pinned across mixed references and catalog changes.
The editor adds Retry Product Links, validates lookup responses, preserves text on
errors and clears stale picker results when scope/query changes. Each article has
one active preview; Escape dismisses a mouse-opened preview without stealing focus
from another input, and an older leave timer cannot close a newly opened preview.

See [matching rules, analysis and follow-ups](articles-printing-selectors.md).

## Validation

Final `npm run check` completed successfully: production build, **710 unit tests
passed** with one existing skip, lint with zero errors/21 existing complexity warnings,
TypeScript, and **182 Chromium journeys passed** (8.8 minutes for the final browser run).
All nine article journeys passed. Desktop/mobile and light/dark screenshots were
reviewed; browser mobile emulation is not physical-device acceptance.

An earlier gate was stopped after an existing investigation-icon matrix exceeded its
30-second test budget and a separate auction journey failed. The icon matrix was
split into four independent viewport/theme tests, retaining every original color,
accessibility, spacing and overflow assertion. No timeout was raised. All four and
the unchanged purchase/sale journey passed in isolation, followed by the complete
green gate. An intervening local development-worker startup error cleared on retry;
it did not affect the deployed staging Worker. Existing local placeholder-D1 detail
fallback warnings remain separate from live staging verification.

## Live staging evidence

- Exact-ID lookup and named shorthand lookup succeeded against the real catalog.
- Bare Ahri → Origins `119/298`; SP3/set-qualified Ahri → Vendetta `SP3/006`.
- Spiritforged `227` → unsigned Overnumbered; `227*` → Signature.
- SP3 combined with Origins returned no match rather than another printing.
- Article library/API returned 200/no-store; invalid filters returned 400;
  unpublished articles returned 404. Unauthenticated admin API/page remained
  401/303 with private/no-store responses.
- Account session, Auction House and Pokémon sealed landing responded successfully.
- Fresh pre/post configuration checks preserved existing bindings, rate-limit settings,
  twelve plaintext variables and empty staging schedules. Shared identity stayed bound
  to its existing database; no identity/account rows were read or changed.
- Read-only article metadata captured before/after deployment matched: two articles,
  two revisions, unchanged head revisions/states/published pointers, zero public articles.

The live checks cover APIs, configuration and preserved queue metadata. Hover, click,
keyboard/touch, retry and mixed-printing interactions are covered by the automated
browser tests; no new live admin draft was saved as part of this release. Public
publish/correction/unpublish acceptance remains a later, explicitly authorized check.

Draft bodies, local backups, operational configuration/logs and unrelated TODO/image
changes were excluded from the release commit. The dated queued evidence, original
article files, forecasts and scheduled-drafting state remain unchanged.
