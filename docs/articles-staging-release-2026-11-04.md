# Article links and review queue — November 4, 2026

## Released state

- GitHub branch `codex/article-editor`; application source `212895b` pushed.
- Staging Worker version `74653130`, with Articles enabled.
- No main merge or production deployment. No article approved or published.
- Double-Bracket Product Links now work in the editor and reader for singles and
  sealed, including exact-printing selection, artwork/details/current-history previews,
  immutable saved identities, and blocking checks for unresolved/ambiguous links.
- Fixed preview resizing that could cover the source link and prevent navigation.
- No new dependency, schema migration, market ingestion or schedule activation.
  Existing staging settings/bindings were preserved; remote schedules remain empty.

## Validation and live acceptance

The unchanged application source passed `npm run check` before this release:
production build, 706 unit tests passed (one existing skip), lint with zero errors
and 21 existing complexity warnings, TypeScript, and all 177 Chromium journeys.
Seven focused article journeys cover bracket parsing, exact single/sealed insertion,
artwork/details, lazy shared histories, keyboard/touch, missing/ambiguous references,
lookup failures, conflicted buffers, and explicit editorial actions. Desktop/mobile
and light/dark screenshots were reviewed. Local detail-schema fallback warnings are
pre-existing; automated checks do not represent physical-device acceptance.

Live staging verified the article library/API, exact-ID and exact-name product
lookups, invalid-input responses, denied unauthenticated admin access, account session,
Auction House and Pokémon sealed landing. Existing bindings/variables and disabled
schedules were checked against a fresh pre-release snapshot.

Using the existing real signed-in administrator browser, both prepared JSON drafts
were imported through the editor, saved as revision 1, and explicitly submitted to
**Needs Review**. Neither review acknowledgment nor Approve/Publish was selected.
Both canonical article APIs return 404 publicly; the public library still reports
zero articles. This is live import/save/submit acceptance, not a live publication test.
Full publish/correction/unpublish acceptance remains outstanding.

## Submitted drafts and review boundaries

1. **Radiance Prices: Where Could They Settle by November 22?** — the October 27
   singles/sealed outlook, with 17 exact product references converted to the bracket
   format and 18 source links. Prices/forecasts were not refreshed or relabeled as
   November 4 observations. The November 22 horizon remains fixed. The dated evidence
   record and freshness/ownership review notes are retained in private research notes.
2. **Delta Reign: Building a Price Outlook Before the Market Settles** — the October
   21 framework article, classified Analysis. It intentionally has no numerical card
   targets or invented product identities. Release/checklist and catalog checks remain
   editorial work. Its date-only source is encoded as midnight UTC, with that limited
   precision explicitly explained in private notes; it is not a measured capture time.

Both drafts need source/price freshness and disclosure review before publication.
The prior Radiance versions, withdrawn forecasts, research files and recap templates
were preserved locally. Templates and superseded drafts were not queued as current
articles. Draft bodies/import files, account details, temporary deployment settings
and operational logs were excluded from the public GitHub commit; unrelated TODO
edits and the existing image were also left untouched.

Review at the staging **Editorial Queue** (`/admin/articles`). Production article
activation and scheduled generation remain separate, unperformed release decisions.
