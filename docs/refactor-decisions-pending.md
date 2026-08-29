# Refactor decisions pending manual review

Queue of changes identified by the [2026-08-28 codebase audit](codebase-audit-2026-08-28.md)
that need a product or architecture decision before implementation. Safe mechanical
consolidations are NOT listed here — they land directly on the `refactor/consolidation`
branch. Each item: context → options → recommendation.

> **Status (ruled 2026-08-28, manual review on `refactor/consolidation`).** Every
> decision below was reviewed and ruled; the sections are kept as the option record.
> Rulings: **D1/D2/D4/D8** full `core/` layering pass (done). **D3** canonical
> producer labels + curated-feed rewrite + data migration (in progress).
> **D5** straight swap to SQL predicates, verified by a parity suite (in progress).
> **D6** readiness/cache/error standardization (done). **D7** migrate to behavioral
> tests + slim `source-contracts` (done — `rendered-html.test.mjs` retired).
> **D9** quarantine (done). **D10** keep the internal `scalping` value.
> **D11/D13/D14/D15** full state pass with URL fixes (done). **D12** strictness is
> view-only from links — never persisted (done). CSS slices S7–S14 all approved (done).

## D1. Extract a `core/` layer to fix the layering inversion

**Context.** 21 wrong-way edges: `db/` imports app logic (signal scoring, history
metrics, the in-memory repository, `mapWithConcurrency`), `db/` imports untyped `.mjs`
normalizers behind `@ts-ignore`, `worker/` imports `allowedRarities` from a UI
URL-state module, and `app/data ⇄ db` form a directory-level cycle.
**Options.** (a) Move domain + pure calculators + query engine + in-memory repo +
typed normalizers into `core/`; everything depends downhill. (b) Accept and document
the coupling (status quo).
**Recommendation.** (a), as a dedicated pass. ~15 file moves; zero deploy-config
impact (bundle follows the import graph, not directories); must update 4 path-pinned
`readFile` URLs in `tests/rendered-html.test.mjs` in lockstep.
**Effort.** 2–3 days including gate stabilization.

## D2. Convert the shared `.mjs` modules to TypeScript

**Context.** `normalize/{singles,sealed}.mjs`, `sealed-product-utils.mjs`,
`details/peer-history.mjs`, `clients/{http-json,tcgcsv}.mjs` ship in the production
Worker bundle but are untyped — 5 `@ts-ignore` imports and casts guard the only
untyped values that flow into D1 writes.
**Constraint.** `sync-tcgcsv.mjs` / `sync-sealed.mjs` root entry scripts must keep
their exact paths (pinned by `maintainer-docs.test.mjs` via `package.json` script
strings); only the shared internals move.
**Also folds in.** The verbatim ~24-line `compactGrades`/`money`/`count` duplicate
(`scripts/graded/sync-graded.mjs:23-44` ↔ `db/graded-ingestion.ts:13-36`): deduping
it *before* this conversion would add a fourth `@ts-ignore` seam or rely on node
type-stripping for the sync script, so it waits for the TS module both sides can
import.
**Recommendation.** Do together with D1 (same file family).

## D3. Sealed taxonomy unification (delete `categoryAliases`)

**Context.** The Riftbound normalizer emits a different product-type vocabulary than
the canonical list in `app/data/catalog-query.ts`; `categoryAliases` bridges them.
Fixing the producer deletes the bridge — but existing `public/data/sealed-riftbound.json`
and D1 `catalog_products.product_type` rows carry the old strings.
**Options.** (a) Normalize at the producer + one-time D1 UPDATE + feed regeneration.
(b) Keep the alias bridge as the documented seam.
**Recommendation.** (a) eventually, batched with the next migration-bearing release;
until then the bridge is tested and harmless.

## D4. Move `app/data/metrics-service.ts` SQL into `db/`

**Context.** ~200 lines of raw SQL — the largest SQL surface in the repo — lives under
`app/data/`. Moving it to `db/metrics-queries.ts` puts all SQL in one layer.
**Blast radius.** `tests/rendered-html.test.mjs` pins the current path and the
`publishedIngestion(db, "metrics-rollup")` string.
**Recommendation.** Fold into the D1/core pass rather than doing it standalone.

## D5. Push D1 catalog querying into SQL

**Context.** `db/catalog-repository.ts` loads full result sets and delegates
filter/sort/pagination to the in-memory engine — O(catalog) per request. Works fine at
~17k rows; becomes the scaling ceiling.
**Options.** (a) SQL pushdown with parity gates (`npm run cloudflare:parity`).
(b) Defer until catalog growth or p95 latency demands it.
**Recommendation.** (b) for now — deepest behavioral risk (fuzzy search, facets,
sealed scenario math), thin regression net. Revisit if JP full-catalog lands.

## D6. Standardize API responses and readiness

**Context.** Four response shapes, six `Cache-Control` literals, four different
definitions of "D1 is ready", and `api/signals` returning 200 `{ready:false}` on
exception (outage indistinguishable from cold start).
**Decision needed.** The signals error contract is client-visible:
`usePersistedSignals` treats any non-ready as "keep fallback", so changing to 5xx
needs a client update in the same commit.
**Recommendation.** Small dedicated pass: shared cache-tier constants, one readiness
helper, 503 on signals exception + client handling.

## D7. Retire or re-aim `tests/rendered-html.test.mjs`

**Context.** 213 regex assertions over 45 raw source files — the measured refactor
tax (17 edits in 76 commits; every UI change is a two-file edit). It even pins exact
expression text inside API routes. The behavioral suites
(`critical-journey`, `mode-adapter`, `domain-contracts`, Playwright) are the safe zone.
**Options.** (a) Migrate the ~90 pure-markup pins into Playwright/rendered-component
assertions and shrink the file to genuine source contracts (bans, ordering, security
invariants). (b) Keep as-is and keep paying per-change. (c) Delete outright (loses
real protections: font ban, loading.tsx ban, magic-paused guards).
**Recommendation.** (a), done BEFORE the core/ extraction (D1) so the moves don't pay
the 213-assertion toll. This is the highest-leverage single decision in the queue.

## D8. Unify the fetch/retry policy

**Context.** `scripts/clients/http-json.mjs` is the only retry implementation; whether
a call site retries depends on whether it happened to import that client. Cron-budget
timing changes if slow retries are added to scheduled paths.
**Recommendation.** Adopt one policy with per-call budget caps during D2.

## D9. `app/chatgpt-auth.ts` and Sites rollback artifacts

**Context.** Zero code or doc references (verified by repo-wide grep); retained
implicitly for the dormant OpenAI Sites rollback path, alongside `.openai/hosting.json`
and 70+ local `site-package-*.tar.gz` archives (gitignored).
**Options.** (a) Delete the module + declare Sites rollback dead. (b) Move under a
`legacy/` label with a pointer in `docs/legacy-artifacts.md`. (c) Keep as-is.
**Recommendation.** (b) at minimum; (a) once comfortable that the Cloudflare setup has
survived long enough that a Sites revival would be a rebuild anyway. Local tarballs
can be archived off-repo either way.

## D10. Rename the internal `scalping` market value

**Context.** UI says "Obey Products"; URLs, feeds, localStorage guards, and tests all
say `scalping`. A rename is user-visible (bookmarked `?market=scalping` URLs) and
touches feed manifests.
**Recommendation.** Keep `scalping` as the wire value; treat the label mapping in
`domain/formatters.ts` as the single seam. Revisit only if the curated market concept
expands.

## D11. Lift sealed list state out of SealedView (retire `sealedRevision`)

**Context.** Sealed sort/page/view/query/sets live in SealedView local state *and* in
`page.sealedState`, reconciled one frame late; the `sealedRevision` remount key papers
over it but also fires on browser Back and on the scalper toggle, discarding scenario
inputs and page position unintentionally.
**Options.** (a) Lift all sealed query state into page.tsx (single owner), SealedView
becomes controlled. (b) Extract a `useSealedQuery` hook owning the URL round-trip.
**Recommendation.** (a). This is the largest remaining architecture item in the
frontend (~40–60 lines net removed, 7 pinned assertions to update) and unlocks fixing
the Back-discards-state behavior. Needs its own gated pass.

## D12. URL contract gaps: `strictness` and `favoritesOnly`

**Context.** `?strictness=` is parsed but never applied (and deliberately never
serialized); `favoritesOnly` is never in the URL, so sharing/reloading loses the
Favorites tab.
**Decision needed.** Are strictness and favorites-view meant to be shareable URL state
(like signal view) or device preferences (like theme)? Current behavior is an
inconsistent middle.
**Recommendation.** Make `favoritesOnly` a URL param (it selects a tab in the signal
slider — the other tabs are URL state); either apply or stop parsing `strictness`.

## D13. Scalper-mode ownership (TopBar prop vs localStorage)

**Context.** On `/` the page owns scalper mode and passes it to TopBar; on `/metrics`,
`/buylist`, and detail pages TopBar self-manages via localStorage. Toggling on one
page does not update another already-mounted page.
**Options.** (a) One `useScalperMode()` external store (same pattern as
`hover-previews.ts`) used everywhere. (b) Status quo.
**Recommendation.** (a) — removes ~20 lines and one source-of-truth bug; 5 pinned
assertions to update.

## D14. MetricsView URL handling

**Context.** MetricsView hand-parses and `replaceState`s its URL instead of using the
shared codec — metrics navigation is not back-navigable and misses codec additions.
**Decision needed.** Should metrics scope changes create history entries (Back walks
through scopes) like the home page does? That is a UX change, not just a refactor.
**Recommendation.** Yes — route it through `parseMarketQuery`/`useMarketQueryState`.

## D15. Full `usePreference` hook for device preferences

**Context.** This branch fixed the unguarded `localStorage` reads in page.tsx in
place. The fuller version — one `usePreference(key, parse)` hook replacing the four
hand-rolled hydrate/write pairs (strictness ×4 files, scalper, buylist-size) — touches
5 files and 3 pinned assertions.
**Recommendation.** Do it; only queued here because the pin updates deserve their own
reviewable commit.
