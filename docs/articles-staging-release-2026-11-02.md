# Articles staging release — November 2, 2026

## Released state

- Branch: `codex/article-editor`, based on the verified current `main` at `390c363`.
- Initial article implementation: `33f2240`; final application source: `cd807e8`.
- Staging application version: `ea418a3b`, Articles enabled.
- Migration `0029_articles.sql` applied and all three article tables verified.
- Not merged to main or deployed to production. No actual article was imported,
  saved or published; research drafts remain local and separate.
- Unrelated TODO edits and the existing image were excluded from the commits.

## Release sequence and safeguards

The full initial release gate passed before the branch was committed/pushed. The
initial code deployed with Articles disabled. A private full staging backup completed
before migration, with size/completion checks and a saved SHA-256 checksum. The backup,
temporary configuration, remote settings and operational logs remain ignored locally.
Migration 0029 then added editorial tables; Articles was enabled in a prepared deployment.
No shared-identity migration, market ingestion, production mutation or new schedule ran.

All eleven existing staging plaintext variables were preserved. Existing binding names
and types were checked after deployment; D1 targets and rate-limit namespaces/settings
were unchanged. Shared identity, account recovery/auditing, Collections, auction community,
moderation, rate limits and the compact auction catalog remained enabled. Remote staging
schedules were verified empty. Existing secret bindings were retained without exposing
their values or replacing credentials.

## Acceptance findings and fixes

Real browser acceptance caught two issues missed by the original isolated UI checks:

1. Framework client links stayed on the source page across the editorial/admin boundary,
   while direct URLs and existing ordinary site links worked. Editorial controls now use
   ordinary document links. A source contract and a queue-control document-navigation
   browser test cover the boundary; the isolated footer's link shim is not router evidence.
2. The editor inherited the market board's default rarity scope, hiding ordinary cards.
   The picker now explicitly requests all rarities and a supported 20-result page size.
   A browser test checks both ordinary single insertion and sealed-product insertion.
   Staging's default Neeko query returned zero items; the all-rarity query returned its
   Epic printing. Normal board defaults were not changed.

The combined fix passed the full gate, was committed/pushed, and then deployed as the
final version. No further migration was necessary.

## Verification

- Final `npm run check`: production build, **704 unit tests passed**, one existing
  skip, lint with zero errors/21 existing complexity warnings, TypeScript checking,
  and **175 Chromium journeys passed**. All five focused article journeys passed.
- Staging `/articles` and `/api/articles`: 200, no-store, empty published library.
- Invalid page query: 400; nonexistent/unpublished article: 404.
- Unauthenticated article admin API: 401, private/no-store. Unauthenticated admin
  page: 303 to sign-in, private/no-store.
- Account session endpoint, normal Auction House and Pokémon sealed landing: 200.
- Exact catalog product lookup succeeded with an actual staging card.
- Existing real administrator Chrome session: public library → Editorial Queue →
  New Article clicks succeeded after the fix. Queue loaded without an error; editor
  displayed the editable Raw Signal Editorial byline. Live editor search found Neeko's
  Epic printing. No credentials/session were fabricated and no personal save contents were inspected.
- Dark/light, desktop/phone, keyboard/touch, conflict handling, draft/public isolation,
  review/publish/correction/unpublish and atomic audit rollback are covered by automated
  checks. This is not physical-device acceptance.

## Remaining acceptance and editorial work

The complete **live** save → review → publish → correction → unpublish cycle remains
manual acceptance; automated coverage is not presented as a live content write.
The Radiance draft still needs refreshed evidence and human editorial/ownership review
before import/publication. Its earlier dated versions remain preserved. Scheduled
drafting, restricted generator submissions and production rollout remain inactive.
