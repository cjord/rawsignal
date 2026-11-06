# Article Printing Selectors and editor review

November 6, 2026. Extends Double-Bracket Product Links without a new database
migration, dependency or external marketplace requests. Release verification is
recorded separately after the required gate and staging deployment.

## Authoring and matching rules

| Bracket text | Intended match in the inspected staging catalog |
| --- | --- |
| `[[ahri, inquisitive]]` | Origins regular `119/298`, the unique ordinary printing with that exact name |
| `[[ahri, inquisitive SP3]]` | Vendetta Special `SP3/006` |
| `[[Ahri, Inquisitive SP3/006]]` | The same exact collector number, including denominator |
| `[[Ahri, Inquisitive @ Vendetta]]` | Exact card name within Vendetta |
| `[[Ahri, Inquisitive SP3 @ Vendetta]]` | Collector number and set together |
| `[[Ahri, Inquisitive 119a]]` | Origins Alternate Art |
| `[[Ahri, Inquisitive 227]]` | Spiritforged unsigned Overnumbered |
| `[[Ahri, Inquisitive 227*]]` | Spiritforged Signature |

Names/sets are case-insensitive with whitespace normalization. Full collector
numbers preserve the denominator; short numbers preserve letter/star distinctions.
Leading zeros are normalized, but `SP3` never prefix-matches `SP30`, and `227` never
matches `227*`. Recognized treatment suffixes are considered only when a collector
number explicitly identifies the intended variant. Partial champion names are not
fuzzy-matched. Explicit picker IDs (`[[Label::single:123]]`/`sealed:456`) remain supported.

Exact full names take precedence over interpreting a trailing number, so a product
whose actual name ends in a number remains linkable. An exact duplicated bare name
may default only to one ordinary numeric single; multiple regular candidates stay
unresolved. Sealed names must be unique or set-qualified/the picker must select one.
No winner is chosen by price, rarity desirability, catalog order or random selection.

The database gathers bounded candidates in one parameterized query, filtering by
set before limiting candidates. At most 25 candidates per requested selector are
returned internally; an overflow is unresolved, never resolved from a truncated
subset. The existing picker provides exact IDs when this conservative limit applies.
SQL LIKE metacharacters are escaped; name text is bound as values. Selection itself
uses the same pure matcher as review/rendering. No full-catalog browser download or
per-mention history fanout is introduced.

## Persistence and compatibility

Each saved reference can include the shorthand names bound to that product. Only
names used in the current revision are retained, bounding growth across saves.
Saved identities include their original name/set/number; today's market/history
continues to load by ID separately. Adding a different ordinary printing, mixing
an explicit-ID reference with shorthand, or renaming catalog metadata cannot
silently redirect an existing binding. Newly typed shorthand does not inherit a
binding merely because an unrelated explicit-ID reference already exists.

Older JSON snapshots without bindings keep their existing rendering and gain
bindings on the next save only for shorthand present in the prior saved text.
Drafts, prices and published pointers are not rewritten by deployment. Older
application code does not understand new selector syntax; reverting code would
require converting newly authored selector references to explicit picker IDs
before relying on them in that older reader.

## Current-state findings and implemented fixes

1. **Name-only equality missed collector numbers and sets.** Added the selectors
   above, unique regular defaults and exact ambiguity checks.
2. **A newly added reference could change what existing shorthand meant.** Added
   per-revision bindings and preserved the full saved identity rather than matching
   an arbitrary subset of live products or changing labels on every save.
3. **Lookup failures required editing text/reloading, and malformed success bodies
   could crash the editor.** Added an explicit Retry Product Links control, response
   validation, loading feedback and stale-request cancellation while preserving text.
4. **Switching picker game/type/query left old insertable results on screen.** Clear
   results on scope/query edits; catalog search remains explicit rather than per keystroke.
5. **Mouse-opened previews ignored Escape unless the link had focus; two popovers
   could coexist during a hover transition.** Use one active preview per article,
   close on Escape from anywhere, restore focus when it was inside the panel, and
   prevent an older leave timer from closing the newly selected preview.
6. **An existing auction icon test exceeded its 30-second budget while looping over
   every investigation in four layouts.** Split the matrix into four independently
   named viewport/theme tests. Every investigation, color, accessibility, spacing and
   overflow assertion remains, with a separate auction fixture for each case. No
   timeout was raised and no product assertion was removed.

## Worthwhile follow-ups, not implemented in this change

- **Evidence freshness and publication acceptance:** the two queued articles still
  need refreshed sources/ownership review. A live reviewed publish → correction →
  unpublish check is outstanding; no real article publication is authorized here.
- **Portable draft recovery:** JSON backups currently contain draft text, not a
  portable manifest of saved shorthand bindings. A later validated restore format
  should preserve exact product choices without trusting arbitrary client identities.
- **Observation dates:** date-only research should have a date-only display rather
  than a misleading midnight timestamp. Existing queued source dates are preserved.
- **Long structured forecasts:** render forecast blocks independently of the Markdown
  body budget so unusually long articles cannot crowd out generated forecast rows.
- **Review navigation:** long side-by-side previews push the final review controls
  far down the page. A compact Jump to Review control and a persistent save-status
  toolbar would make review easier without duplicating publish actions.

GitHub Issues remains authoritative for task status; this document records the
specification, findings and implementation boundaries rather than creating a second backlog.
