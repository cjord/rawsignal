# UI/UX and platform to-do — plan of record

Drafted 2026-08-27 from the user's rough list. **No code has changed**; every item below is a
proposal awaiting joint review. Items are grouped, and each carries: what/why, the proposed
solution(s) with a recommendation, an implementation plan with the exact files involved, and
risks/notes. Decisions that need a call at review are collected at the end.

Related documents: `docs/roadmap.md` (deferred infra work — items G1 below consolidates
roadmap items 1–3), `docs/cloudflare-cutover.md` (the D1 runbook).

## Summary

| # | Item | Phase | Effort | Risk |
|---|------|-------|--------|------|
| A1 | Global type-scale raise + rebuild the font-size setting | 2 | L | Medium (touches every view) |
| A2 | Design-baseline file (aesthetic source of truth) | 1 | S | None (docs only) |
| B1 | Remove "Listing high" | 1 | S | Low |
| B2 | "Direct low" — explained; recommend removing | 1 | S | Low |
| B3 | Trim low-value data from detail pages | 2 | M | Low |
| B4 | Card/Product details → collapsed expander | 1 | S | Low |
| B5 | Peer-average lines → hero (+ "Spiritforgeds" bug) | 1 | S | Low |
| B6 | Link sealed products from single-card pages | 2 | M | Low |
| B7 | Remove signal-strictness dropdowns, pin Balanced | 1 | S | Low |
| C1 | Price-history tile: more color coding | 2 | M | Low |
| C2 | Chart: larger range buttons, cursor tooltip, fix the giant hover bubble | 1 | M | Low |
| D1 | Kill the hover "pop" (lift/zoom) on tiles | 1 | S | Low |
| D2 | Hover-preview popovers: open delay + off switch in settings | 2 | M | Low |
| D3 | Hover info-icons instead of persistent fine print | 3 | M | Low |
| E1 | Delete the masthead | 1 | S | Low |
| E2 | Top-navigation redesign | 2 | M | Medium (layout) |
| E3 | Breadcrumb → real deep-links with proper capitalization | 1 | S | Low |
| E4 | "Back to results" always returns to the filtered list | 1 | S | Low |
| E5 | Capitalization audit | 1 | S | Low |
| F1 | Faster detail pages + skeletons | 3 | M–L | Medium |
| G1 | Cloudflare hosting + scheduled ingestion Workers | 4 | L | Gated on authorization |

Phases: 1 = quick wins (one working session), 2 = systemic UI, 3 = perf/polish, 4 = platform.

---

## A. Typography & design system

### A1. Raise font sizes across the board and rebuild the font-size setting

**What/why.** Base sizes are hardcoded px throughout the stylesheets and skew tiny: 8px and
8.5px labels (`.detail-metric small`, section kickers, table headers, gauge labels, chart
axes), 9–10px body/annotation text, and 59 declarations of 9–12px across
[globals.css](../app/globals.css), [detail.css](../app/detail.css),
[market-views.css](../app/market-views.css), and
[market-controls.css](../app/styles/market-controls.css). The existing "Larger" setting
(`data-font-size="large"`, globals.css line 56) is a whitelist of ~10 `!important` overrides
that bumps e.g. 9px → 9.5px, and **it does not touch `detail.css` at all** — the detail page
ignores the setting entirely. That is why "some text is incredibly small" even on Larger.

**Proposed solutions.**
1. **(Recommended) Tokenized rem scale.** Define a type ramp once in
   [tokens.css](../app/styles/tokens.css) — e.g. `--text-2xs/-xs/-sm/-base/-lg/-xl` — with a
   raised floor (nothing below ~10.5px at default), express the ramp in `rem`, and have the
   setting scale the root: `html{font-size:16px}`, `[data-font-size="large"]{font-size:17.5px}`.
   Replace hardcoded px font sizes with the tokens file-by-file, then **delete the entire
   line-56 override block**. Every current and future component inherits the setting for free.
2. Minimal pass: keep px, but sweep the smallest sizes up one notch (8→10, 8.5→10, 9→10.5,
   9.5→11, 10→11, 10.5→11.5) and extend the `data-font-size` whitelist to detail.css. Cheaper
   now, but the setting stays a fragile patch list.
3. Add a third size step ("Compact / Default / Large") on top of option 1 — trivial once the
   scale is root-driven; only worth it if the default ends up larger than some users want.

**Implementation plan (option 1).**
1. Add the ramp + root sizing to `app/styles/tokens.css`; document it in the design baseline (A2).
2. Convert one file at a time (order: `detail.css` → `globals.css` → `market-views.css` →
   `market-controls.css` → `market-content.css`), visually checking each view.
3. Remove the `[data-font-size="large"]` block from globals.css; keep the existing toggle UI,
   localStorage key (`raw-signal-font-size`), and the inline `<head>` script in
   [layout.tsx](../app/layout.tsx) unchanged — they already set the right attribute.
4. Gate check: `npm run check`; manually verify no layout breaks at 390px width (the
   Playwright phone-width spec guards horizontal overflow).

**Notes.** Monospace numeric cells (`var(--font-mono)`) and grid column widths
(`78px/70px/58px` leaderboard columns) may need a matching pass so larger digits don't clip —
budget for it. Do this *after* the Phase‑1 removals below so we don't retune text we're deleting.

### A2. Design-baseline file ("Andrew said something about this")

**What/why.** There is no written source of truth for the look — new components copy whatever
CSS is nearby, which is how the tiny-font and hover-pop patterns spread across the v14–v20
layers in globals.css.

**Proposed solution.** Create `docs/design-baseline.md` (docs-only, no code): the color
tokens and their roles (`--blue`, `--line`, `--soft`, surfaces, up/down greens/reds), the A1
type ramp, spacing/radius/motion values (`--panel-radius`, `--motion-standard`,
`--ease-standard`), component anatomy (tile/metric, section card, chip, data table, popover),
interaction rules (hover = background/border tint only — no lift or zoom, per D1; focus rings;
`prefers-reduced-motion` always honored), and light/dark rules. Every future UI change should
conform to it or update it deliberately.

**Implementation plan.** Write the doc alongside the Phase‑1 UI items so it captures the
*post*-cleanup rules; add a repo-map line for it (note: **the AGENTS.md pointer, like any
AGENTS.md edit, gets proposed to you for approval first**). Optionally add a
`docs/design-baseline.md` checklist step to PR/self-review habits.

---

## B. Detail-page content (card & sealed views)

### B1. Remove "Listing high"

**What/why.** Highest active listing price; routinely distorted by price parking (the site
already disclaims exactly that in two places). Agreed useless.

**Implementation plan.**
1. [ProductDetailPage.tsx](../app/ProductDetailPage.tsx): drop the `Listing high` Metric from
   the hero overview grid (line 139) and the `Listing high` column from `PrintingsTable`
   (line 75).
2. Drop the "TCGplayer listing highs can be distorted by price parking" sentence from the
   provenance footer (line 152) — nothing left to disclaim.
3. Update the methodology copy in [page.tsx](../app/page.tsx) lines 1104–1108 ("listing low,
   median, and listing high remain in card details") to match reality.
4. `highPrice` stays in the data model/feeds (types, contracts, enrichment) — display-only
   removal; nothing to regenerate.

### B2. What is "Direct low"? — and recommend removing it

**Answer.** `directLowPrice` is the lowest listing sold through **TCGplayer Direct** —
TCGplayer's own fulfillment program (TCGplayer stores, ships, and guarantees the item, like
"Fulfilled by Amazon"). It is often null (many products have no Direct sellers) and when
present it mostly duplicates the story told by Listing low + Median.

**Proposed solutions.**
1. **(Recommended) Remove it** from the hero grid and the printings table, same mechanical
   change as B1. Keep the field in the data model.
2. Keep it only in the printings table with an info tooltip (D3) explaining Direct.

**Implementation plan.** Same files/lines as B1; after B1+B2 the hero grid reads
**Listing low · Median · Market rank (+ MSRP on sealed, Pull rate on singles)** and the
printings table reads **Printing · Market · Listing low · Median · Vs cheapest**.

### B3. Remove useless information from card/sealed detail views

**What/why.** The price-history stat grid alone renders 12 tiles; several restate each other.
Proposed keep/cut/merge table — **each row is a review decision**, defaults below:

| Tile / row | Recommendation |
|---|---|
| 7 day / 30 day / 90 day | **Keep** (add color per C1) |
| 30D low + 30D high | **Merge** into one "30D range: $X – $Y" tile |
| Historic low + Historic high | **Merge** into "All-time range: $X – $Y" |
| Above historic low / Below historic high | **Cut** (both restate range position) |
| Historic range position | **Keep**, colored (it's the useful one of the three) |
| 30D range width | **Cut** (volatility tile already covers spread) |
| Observations | **Keep** (data honesty) |
| Volatility / Momentum / Off 90D peak / Trend | **Keep** |
| Streak | **Cut** (noisy; 2–3 observations flip it) |
| SourceFacts: "Images available" | **Cut** (internal trivia) |
| SourceFacts: "Presale: No" | **Show only when Yes** |
| SourceFacts: set abbreviation / published / updated | **Keep** (move into B4 expander) |
| Sales grid (Sold 90D / per-week / 30D / realized range) | **Keep all** |
| Long disclaimers repeated per-section | **Consolidate** into one provenance line + D3 tooltips |

**Implementation plan.** All in `ProductDetailPage.tsx` (`MarkersGrid`, the history grid at
line 141, `SourceFacts`) plus a small `detail.css` grid retune. Merged-range tiles are new
`Metric` values, no domain changes. Update `tests/detail-context.test.mjs` only if labels it
asserts change (it doesn't assert these today).

### B4. "Card details" section → collapsed expander

**What/why.** The metadata/`SourceFacts` block ("Product overview / Card details") is long,
sits at the bottom, and is rarely needed — but it carries real content (card text, attacks,
rarity metadata) worth keeping for search engines and the curious.

**Proposed solutions.**
1. **(Recommended)** Wrap the section body in a native `<details>` with a styled summary
   ("Card details ▸"), collapsed by default. Content stays in the DOM (SEO intact), zero JS.
2. Remove the section entirely — not recommended; the enrichment pipeline was just built to
   populate it, and card text is genuinely useful on Riftbound/One Piece pages.

**Implementation plan.** `ProductDetailPage.tsx` line 152: convert the section to
`<details className="detail-section detail-collapsible">`; move the provenance "Data notes"
paragraph inside it; style the summary row in `detail.css` (reuse `.card-filters summary`
affordance). Persist open state per-session only (no storage needed).

### B5. Move the peer-average lines up to the main tile (+ fix "Spiritforgeds")

**What/why.** The two `PeerLine` sentences ("Average Showcase cards in Spiritforged: $223
across 65 others · this card sits 89.1% below that average") render inside the *Similar
cards* section at the very bottom; they are valuation context and belong with the price.

**Bug found while reading the code:** the plural logic in `PeerLine`
(`ProductDetailPage.tsx` line 38–41) appends "s" when the *whole label* doesn't end in "s" —
the set-scoped label ends with the set name, producing **"Spiritforgeds"**. Fix by
pluralizing the rarity noun where the label is built
([catalog-repository.ts](../core/catalog-repository.ts) peer-context labels), never the
composed label.

**Proposed solutions.**
1. **(Recommended)** Render `PeerContextNote` in the hero, directly under the
   `detail-overview-grid` (compact, two lines max), and *remove* it from `SimilarItems`.
   Similar-cards section keeps just the grid.
2. Move it into the FairValuePanel as chips ("−89% vs set peers") — denser, but hides the
   card-count context that makes the number trustworthy.

**Implementation plan.** Move the component call in `ProductDetailPage.tsx` (line 139 vs 51);
fix pluralization at label construction; add a node test asserting the set-scoped label
renders without the trailing "s" (extend `tests/detail-context.test.mjs`).

### B6. Link the sealed products a card comes from on single-card pages

**What/why.** Sealed detail pages already cross-link both directions (chase cards + related
sealed); single-card pages dead-end — no path to the set's ETBs/boxes.

**Proposed solution.** Reuse the existing
[`RelatedSealedSection`](../app/detail-tables.tsx) (it already takes
`products/setName/market` and renders rows with hover history + links to
`/sealed/{id}?market=…`). Compute the product list for singles the same way the sealed branch
does.

**Implementation plan.**
1. [types.ts](../core/domain/types.ts): add `relatedSealed: SealedProduct[]` to `CardDetail`.
2. [catalog-repository.ts](../core/catalog-repository.ts) singles branch: 
   `sealed.filter(p => p.game === card.game && p.set === card.set)` sorted by market desc
   (same ordering as the sealed branch), capped ~12.
3. `ProductDetailPage.tsx`: render
   `{detail.kind==="single" && <RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={detail.game}/>}`
   after the graded section. Header copy: "Sealed from {set}".
4. Tests: extend `tests/detail-context.test.mjs` (same-set sealed listed, other sets and the
   viewing card's game respected). Note One Piece sealed can't attach to singles (no One
   Piece singles tracked) — no special casing needed; the filter naturally yields [].

### B7. Remove the signal-strictness dropdowns; pin Balanced

**What/why.** The Conservative/Balanced/Aggressive `<select>` appears in three places (list
toolbar for singles and sealed via [SignalControls.tsx](../app/SignalControls.tsx), and the
detail-page `SignalsPanel`). It's expert tuning noise for most sessions. User leaning:
default Balanced or Conservative.

**Recommendation: pin Balanced.** It is already the default everywhere, and Conservative's
tighter cutoff (base 1.5% vs 2.25%, min score 72 vs 58 — [signal-utils.ts](../core/signal-utils.ts))
would leave Hot Buy/Sell pages looking empty on quiet days. Keep the engine parameterized;
this is a UI removal, not a model change.

**Proposed solutions.**
1. **(Recommended) Remove the control everywhere**, hardcode `"balanced"` at the three call
   sites. Keep `strictness` parsing in [market-query.ts](../app/state/market-query.ts) for
   URL back-compat (old shared links, the Playwright URLs) but stop rendering a chooser;
   serialization can keep emitting `strictness=balanced` so history-restore stays stable.
2. Demote instead of delete: move a single global "Signal strictness" preference into the ⚙
   settings menu (localStorage). Keeps power-user access at near-zero surface cost — good
   fallback if anyone misses it.

**Implementation plan (option 1).**
1. [page.tsx](../app/page.tsx): delete the `StrictnessControl` block (lines 907–915) and the
   `has-strictness` class logic; keep the state variable initialized to `"balanced"` (URL
   restore still writes it) or collapse to a constant.
2. [SealedView.tsx](../app/SealedView.tsx) lines 642–660: same removal.
3. `ProductDetailPage.tsx` `SignalsPanel` (line 129–131): drop the dropdown; both cards
   evaluate at Balanced. Optionally show the qualifying cutoff inline ("2.3% balanced
   cutoff" is already in `signal.detail`).
4. Leave `/api/signals`, `usePersistedSignals`, and the D1 signal rows untouched (they store
   all three strictness tiers; we simply always query balanced).
5. Sweep `ActiveFilterSummary`'s "Balanced Signals" chip label — with one fixed tier the
   prefix can drop.
6. CSS cleanup in `market-controls.css` (`.strictness-control`, `.filter-strictness`,
   `.has-strictness` blocks) — ~60 lines gone.

---

## C. Price history & charts

### C1. More color-coded information in the price-history tile

**What/why.** Movement tones exist only as green/red text on 3 of 12 tiles; the chart itself
is always blue regardless of direction.

**Proposed additions (all in [PriceChart.tsx](../app/PriceChart.tsx) + `detail.css`/`globals.css`):**
1. **Trend-colored line + gradient**: stroke/fill switch to the up-green/down-red pair based
   on the selected range's delta (the `deltaTone` already computed at line 15); blue stays
   for flat/unavailable. Applies everywhere PriceChart renders (detail page, hover cards,
   full view) for free.
2. **Tinted movement tiles**: 7/30/90-day `Metric` tiles get a faint background wash
   (`color-mix` of the tone color) instead of colored text alone.
3. **Range markers**: small labeled dots at the visible window's min and max.
4. **Tone the "Historic range position" tile** (kept in B3): green toward the low end, red
   toward the high end.
5. (Optional, decide at review) 30-day moving-average overlay as a thin dashed second line —
   transparent and cheap, but adds ink; skip if the tile should stay minimal.

**Implementation plan.** Pass `deltaTone` down as a CSS class on `.chart-wrap`
(`.chart-up/.chart-down`), move the polyline/gradient colors to CSS vars consumed by those
classes; add `tone` support to the affected `Metric` calls; keep `prefers-reduced-motion` and
dark-theme contrast in mind (the greens/reds already have dark-safe values in use).

### C2. Chart interaction: bigger range selectors, data on cursor, fix the bubble

**What/why + a root cause found.** The 7D/30D/90D/1Y buttons render at **8px mono**
(`.chart-ranges button`, globals.css line 80) — barely clickable. Hover currently shows data
in a *fixed* toolbar readout, not at the cursor. And the "bubble": the SVG uses
`viewBox="0 0 240 76"` with `preserveAspectRatio="none"` stretched to ~1100×240px on the
detail page — `vector-effect: non-scaling-stroke` protects stroke widths but **not circle
radii**, so the r=3.5 hover point and r=3 end dot stretch into large ellipses (~16px wide).
That's the oversized bubble.

**Implementation plan (single pass over `PriceChart.tsx` + chart CSS):**
1. **Range buttons**: bump to ≥11px with ~32px hit targets at all widths (mobile already gets
   34×30px; make that the floor everywhere). Keep the segmented style.
2. **Cursor tooltip**: add a small absolutely-positioned tooltip inside `.chart-canvas` at
   (`active.x/240*100%`, `active.y/76*100%`), offset above the point, showing price · date ·
   sold; flip horizontally near the right edge. Keep the toolbar readout as the
   screen-reader/fallback surface (it already drives `aria-label`).
3. **Fix the dots**: render the hover point and end dot as the same absolutely-positioned
   HTML technique (or compute an aspect-corrected radius) so they are true ~6px circles;
   shrink visual weight (hover point ~5–6px, end dot ~5px).
4. Volume bars and crosshair line stay as-is (both already non-scaling-safe).
5. Touch: tooltip follows `pointermove` which already works for touch (`touch-action:none`).

**Notes.** Pure presentation; no domain/tests affected. Verify in the three chart contexts:
detail (large), hover popover, full-view cards.

---

## D. Hover & motion behavior

### D1. Remove the hover "pop" on tiles; keep flat, responsive feedback

**What/why.** Rows and cards currently lift and zoom on hover: `.leader-row:hover`
translateY(−2px) + image `scale(1.045)`, `.view-large` −4px, `.sealed-row:hover` −2px +
`scale(1.06)`, `.similar-card:hover` −2px, plus assorted button lifts. The user wants hover
states that respond, without the tile popping/moving.

**Proposed solution.** Hover feedback becomes **background tint + border color (+ existing
shadow at most)**; delete all transform lifts/zooms on content tiles. Keep small lifts on
*buttons* only if the baseline (A2) says so — recommendation: drop those too for consistency
(`--hover-lift: 0`).

**Implementation plan.**
1. globals.css: remove transforms from lines 21, 29, 42, 91 (`.sealed-full-card:hover`), 106
   (`.view-large` hover img scale), 112 (hover shadow can stay), and `.similar-card:hover`
   in detail.css line 18.
2. [market-content.css](../app/styles/market-content.css) line 58–62: `.view-large
   .market-row-shell[open]` popover-lift transform → none (the lateral expansion panel
   placement is unaffected; only the vertical lift goes).
3. tokens.css: set `--hover-lift: 0; --popover-lift: 0;` and then delete stale references —
   leaving the tokens at 0 documents the decision.
4. The `prefers-reduced-motion` overrides collapse to no-ops — prune them where they only
   guarded the removed transforms.
5. Re-check the view-large hover expansion (the side panel) still reads as attached to its
   card without the lift — border-color emphasis already handles that.

### D2. Hover popovers: small open delay + a setting to turn them off

**What/why.** Two complaints in one: popovers feel twitchy (they open on `pointerenter` with
zero delay — every mouse pass across the table flashes charts), and some users won't want
them at all. Default stays **enabled**.

**Proposed solutions.**
1. **Open delay** (~150ms) in [useDisclosurePopover.ts](../app/hooks/useDisclosurePopover.ts):
   `onPointerEnter` starts a timer, `onPointerLeave` cancels it. Focus-triggered opens stay
   immediate (keyboard users shouldn't wait).
2. **"Hover previews" toggle** in the ⚙ settings menu (both the list topbar menu in
   `page.tsx` and `DetailChrome` in `ProductDetailPage.tsx`), persisted as
   `raw-signal-hover-previews` (default on).
   - Plumbing: a tiny module-level store (read localStorage once, subscribe via a custom
     event) consumed inside `MarketRow` — avoids threading a prop through
     `page.tsx → MarketLeaderboard → rows` *and* `detail-tables.tsx`'s two sections.
     When off: skip rendering the `popover` slot and the pointer handlers entirely (click
     still navigates; touch fallback goes straight to navigation).
3. Keep behavior symmetric for sealed rows (`SealedView` uses the same `MarketRow`).

**Implementation plan.** Hook change + settings-menu row + store module (~60 lines total).
Add a Playwright assertion only if flakiness appears — the 150ms delay must be tuned below
the test runner's hover timing or explicitly waited.

### D3. Hover info-icons instead of persistent small description text

**What/why.** Tiles carry always-visible fine print (`Metric` `hint` spans like "10–90th
percentile range vs median", 8px section disclaimers). Replace with an ⓘ affordance that
reveals the explanation on hover/focus, decluttering the default view.

**Proposed solution.** A shared `<InfoHint label="…">` component: a 16px ⓘ button,
`aria-describedby` tooltip on hover/focus (CSS-positioned, no portal needed at these sizes),
tap-to-toggle on touch. Use it for: Metric hints that are *explanatory* (keep hints that are
*data*, like the observations date range, visible), the fair-value model formula note, the
graded-market provenance note, pull-rates caveat.

**Implementation plan.** New `app/InfoHint.tsx` + baseline styles; swap call sites in
`ProductDetailPage.tsx` incrementally (fair value + hero first). Accessibility: the tooltip
text must remain reachable by keyboard focus and stay in the DOM for screen readers.
Phase 3 — after B3 decides which text survives at all.

---

## E. Navigation & chrome

### E1. Delete the masthead ("main title shit")

**What/why.** The `.masthead` block (kicker + 94px "The card market, without the noise." +
dek, [page.tsx](../app/page.tsx) lines 786–797) costs ~300px before any data appears.

**Proposed solutions.**
1. **(Recommended)** Remove the masthead entirely. The section heading ("Pokémon market
   ranking / … Leaderboard") plus the topbar brand carry identity fine. Fold "updated
   {date}" into the existing heading aside (already there).
2. Keep a single compact strapline row (12px, one line) above the product toggle — only if
   pure removal feels too abrupt at review.

**Implementation plan.** Delete the JSX block + `.masthead`/`.dek` CSS; move the `#top`
anchor to the topbar; re-check spacing of `.product-navigation` so the page opens straight
into controls. Nothing in tests targets it.

### E2. Improve the top navigation bar

**What/why.** The topbar today: brand + anchor links ("Rankings", "Method") + ⚙ + theme —
the anchors are low-value, and market switching lives in a select control below the fold of
tall pages. With the masthead gone (E1) the topbar becomes the primary chrome.

**Proposed solution (one coherent redesign):**
1. Brand (unchanged, links `/`).
2. Primary links using the URL-state deep-links that already exist (E3 table):
   **Pokémon · Riftbound · Sealed** (and optionally **Hot Buys**) — each an `<a href>` with
   full query state; active link underlined via current URL match.
3. Right side: ⚙ settings (gains the D2 toggle), theme — unchanged. Drop "Method" (the
   section keeps its `#method` id for the footer link if wanted).
4. Detail pages: `DetailChrome` (`ProductDetailPage.tsx`) currently *duplicates* the
   settings/theme logic — extract a shared `TopBar` component used by both pages
   (back-button slot for detail), removing the duplication while restyling once.
5. Mobile: primary links collapse into a compact row under the brand or into the settings
   sheet (the ≤560px CSS already hides `.toplinks>a`).

**Implementation plan.** New `app/TopBar.tsx`; consume from `page.tsx` + `ProductDetailPage`;
CSS consolidation in globals.css/detail.css. Medium risk purely from layout surface — do
after Phase 1 lands.

### E3. Breadcrumb segments become real links that open the pre-filtered search page

**What/why.** The detail breadcrumb is a single dead link reading
`Market rankings / pokemon / Surging Sparks` — lowercase game key, and clicking any part
just goes to the generic fallback. Each segment should deep-link into the leaderboard with
the right market/set enabled. The URL layer
([market-query.ts](../app/state/market-query.ts)) already round-trips every filter, so these
are plain `<a>`s:

| Segment | Href |
|---|---|
| Market Rankings | `/` |
| {Game} | `/?mode=singles&market=riftbound&rarity=all` (sealed: `/?mode=sealed&market={market}`) |
| {Set} | `/?mode=singles&market=riftbound&rarity=all&sets=Spiritforged` |

**`rarity=all` is load-bearing**: default rarities (e.g. Riftbound → overnumbered only)
would otherwise hide most of the set the user just came from. `sets` values need
`encodeURIComponent` (`|` is the list separator).

**Implementation plan.** Rework the `detail-breadcrumb` anchor in `ProductDetailPage.tsx`
line 139 into three links with a shared game-label helper (E5); sealed pages link the sealed
market + set. Verify the sets facet matches feed set names exactly (they do — both come from
the same feed).

### E4. "Back to results" always returns to the original results page

**What/why.** The back button (`DetailChrome`) runs `history.length>1 ? history.back() :
location.assign(fallback)`. Failure modes: card → similar card → "Back to results" returns to
the *previous card*; arriving from an external link walks back out of the site or falls to a
default-filtered list, losing the user's filters.

**Proposed solutions.**
1. **(Recommended) Saved list URL.** Whenever the leaderboard writes its URL
   ([useMarketQueryState.ts](../app/state/useMarketQueryState.ts) — both the initial restore
   and `write`), also store it: `sessionStorage["raw-signal-last-list-url"]`. The back button
   *always* navigates to that saved URL when present, else the current per-kind fallback.
   Predictable ("the results I was on"), filter-complete, and survives card→card hops.
2. Hybrid: `history.back()` only when the previous entry is known to be the list (not
   knowable from the History API) — rejected.
3. Referrer sniffing — fragile with privacy settings; rejected.

**Implementation plan.** Two-line addition in `useMarketQueryState`; `DetailChrome` reads
sessionStorage first. Trade-off to note: a plain `location.assign` forgoes bfcache's instant
restore that `history.back()` sometimes gave — the list page rehydrates from the URL state,
which is exactly what it's built for.

### E5. Proper capitalization across the site

**What/why.** Observed: breadcrumb "Market rankings / riftbound / …" (raw game key,
sentence-case "rankings"). [formatters.ts](../core/domain/formatters.ts) `formatRarity` is an
identity function; game display names exist only as a local map in `page.tsx`.

**Implementation plan.**
1. Add `formatGameName(game)` to `core/domain/formatters.ts` ("pokemon" → "Pokémon",
   "riftbound" → "Riftbound", "onepiece" → "One Piece", "scalping" → "Scalping watch" — final
   copy at review); replace the local `gameNames` map in `page.tsx` and use it in the
   breadcrumb, detail kickers, and E2 nav links.
2. Title-case fixed UI labels: "Market Rankings" breadcrumb root; sweep detail-section
   kickers/headers ("sealed product" → "Sealed product", etc.).
3. Audit pass: grep rendered string literals in `app/*.tsx` for lowercase product nouns;
   set/rarity names come from feeds already correctly cased (Spiritforged is cased right in
   data — the "spiritforgeds" artifact was the B5 pluralization bug).
4. Keep CSS `text-transform: uppercase` kickers as a deliberate style (they're a design
   choice, not a data bug).

---

## F. Performance

### F1. Single card/sealed pages: load faster, show skeletons

**What/why + constraints.** Detail routes are server-rendered:
`cards/[productId]/page.tsx → detailRecord → loadCatalogDetail`, which on a cold isolate
builds the feed repository — **19 JSON fetches** (13 rarity sections + 3 sealed + pull
rates/graded/peer context) plus manifest + enrichment chunk before any HTML streams
([feed-catalog-repository.ts](../app/data/feed-catalog-repository.ts)). Warm isolates reuse
the cached repository, so slowness is worst on first hit. **Hard constraint from AGENTS.md:
route-level `loading.tsx` is banned** — vinext 1.0.0-beta.2 leaves its Suspense fallback
unresolved on cold dev servers. Skeletons must be in-page.

**Proposed solutions (complementary, in order of value):**
1. **Instant-feel navigation:** rows link with plain `<a>` full-document loads today. Add
   `rel="prefetch"`-style warming: an idle-time `fetch` of the detail HTML (or at least the
   enrichment chunk + `/api/history`) when a row's popover opens — the hover *is* the intent
   signal. Cheap, no framework risk. (Converting to `next/link` client transitions under
   vinext is an option but needs a spike — history restore on back must keep working with
   the list's popstate handling.)
2. **In-page skeletons for client-fetched sections** (allowed): the chart already has
   `detail-chart-loading`; add matching shimmer blocks for the signals panel, graded table,
   and chase/related tables while `/api/history` batches resolve, so late sections don't
   jump in.
3. **Slim the cold path:** detail rendering needs the card's own section + the set's sealed
   file — not all 16 catalog files — but peer context/rank *do* need the full catalog today.
   Practical middle: build a per-product summary into the enrichment chunks (name, set,
   rarity, prices, rank, peer stats at generation time) so `getDetail` can serve from
   manifest + chunk alone; the full-catalog load then only backs `similar`/related lists,
   which could accept the same-chunk neighbors instead. This is a generator + repository
   refactor — size it separately at review.
4. **The real fix is G1**: D1-backed `getDetail` reads a handful of rows instead of parsing
   ~10MB of JSON per isolate. Options 1–2 are worth doing regardless; option 3 only if G1
   stays blocked.

**Implementation plan.** Phase 3: land (1)+(2) together (~a session); spike (3) only after
measuring real Sites cold-start latency (add a `Server-Timing` header around repository
build to get numbers first).

---

## G. Platform

### G1. Cloudflare hosting with scheduled Workers ingesting and processing data

**What/why.** Consolidates roadmap items 1 (D1 backfill), 2 (daily feed regeneration), and
3 (graded rotation) into their intended end-state: Cloudflare-hosted app + cron-scheduled
Workers ingesting TCGCSV daily into D1, serving catalog/history/signals from the database —
data refreshes without redeploys, and F1's cold-start problem disappears.

**Current state (verified):** staging Worker `raw-signal-staging` + migrated D1 exist;
ingestion proven in bounded batches; readiness markers absent so all public APIs serve
bundled feeds; **no Cron Trigger/Queue/Workflow/production route is active** (AGENTS.md line
91), and Cloudflare Cron is *deliberately unused* per prior decision — activating it is a
decision reversal to make explicitly at review, plus an AGENTS.md edit (which I will propose
for approval first, per our rule).

**Phase 4 progress (2026-08-27, user-authorized; Workers Paid active):** Gate 0 cleared —
wrangler auth verified, `Bash(npx wrangler:*)` allow rule added, `STAGING_JOB_TOKEN`
rotated into `.secrets/staging-job-token`. Migration 0002 applied to staging D1; staging
Worker redeployed on the v71 build. Full backfill running via a locked local driver
(`daily-market:2026-08-27` then history). History throughput approved and landed: adapter
cap 20→60 per batch with six concurrent TCGplayer fetches (paid-plan subrequest budget) —
~7-9h drops to ~1.5-2h. Guard cron approved and implemented: `scheduled()` in
`worker/index.ts` → `runScheduledIngestionTick` advances one checkpointed batch per tick
(daily until the deployed snapshot is fully ingested; history only *continues* an
operator-started backfill; else no-op); prepare script emits `triggers.crons` only for
staging with `--cron`/`RAW_SIGNAL_STAGING_CRON`, production always cleared. **Cron
activation + the AGENTS.md line-93 rewrite wait until backfill + parity pass.** Known gap
carried forward: `product_details` has no ingestion path (detail pages fall back to feeds);
live TCGCSV fetch inside the Worker (true redeploy-free daily data) is the next slice —
until it lands, each staging deploy is ingested exactly once and the guard cron then idles.

**Phase 4 milestones (2026-08-27 evening):** backfill complete — catalog 16,898/16,898
(174 batches), history 15,981/15,981 in ~88 min (267 batches; 98.3% with data, 84.9%
exact coverage); both readiness markers published and staging serves
`source:"database"` for catalog and sealed. **Parity passed** (all six cases, records +
facets identical) against the local feed build — byte-equivalent to the Sites snapshot,
which was used because **Sites production returned 401 site-wide at check time** (user
to confirm visibility). **Guard cron activated** on staging (`*/2 * * * *`, version
7678b432) with the approved AGENTS.md line-93 rewrite applied. Remaining G1 slices:
live TCGCSV fetch in the Worker (redeploy-free daily data), graded rotation, peer
accumulation, then the production Worker/D1/cutover gates.

**live TCGCSV fetch slice — LANDED 2026-08-28.** `db/live-ingestion.ts`: checkpointed
group walk (cursor = group:record), one walk feeding singles + Pokémon-sealed normalizers
(same pure core/normalize modules as the local sync) with published-MSRP lookup;
curated riftbound/onepiece sealed feeds ride as bundled pseudo-groups; sync duplicate
rules enforced via per-run DB reads; a 10k minimum-record threshold blocks truncated
publishes. The `last-updated.txt` probe timestamp is the snapshot identity — the cron's
`live` action (replacing the bundled `daily`) ingests each TCGCSV publish exactly once.
**Daily data no longer needs deploys.** Known edge: a same-date TCGCSV re-publish spins
cheap re-completions until midnight (documented, monitoring will show it). NOTE: the
leaderboard UI still reads bundled feeds client-side — live data reaches /api/catalog,
detail pages, and signals; switching the UI to the API is its own slice.

**graded rotation slice — LANDED 2026-08-28.** Migration 0003 adds `graded_prices`;
`db/graded-ingestion.ts` rotates the stalest of the top-400 Pokémon singles on 90
credits/day (2/card) against PokemonPriceTracker, honoring the API's rate headers, with
last-good retention. Cron action `graded` runs once daily after live+details when the
`POKEMONPRICETRACKER_API_KEY` secret is configured; adapter job `graded` for manual runs.
The D1 detail path now reads graded rows — fixing the regression where D1-served pages
lost the Graded Market section (first rotation: 44/45 updated, verified rendering).
Remaining detail-parity gaps on D1 pages: pull rates and the fair-value peer anchor
(feed-only inputs) — small follow-up slice alongside peer accumulation.

**H3 metrics page — LANDED 2026-08-28** on `rawsignal.cards/metrics`. Data layer:
migration 0004 + `db/metrics-ingestion.ts` window-function rollups (four equal-weighted
indexes + two game medians), cron `metrics` action after each day's live run, adapter
job for backfills. Page: overview tiles (tracked value from current prices; movement
from the per-game index series), four index cards, Pokémon-100 vs Riftbound-50 base-100
comparison (PriceChart gained an additive overlay series), set leaderboard (SQL medians,
momentum from stored per-card changes), breadth tiles; explicit no-database state
(verified on dev). Hard-won data-quality rule: **a rollup date qualifies only when it
observes ≥75% of the best-covered date's count** — sparse backfill dates understate even
top-N indexes (first attempts showed +137% 7D artifacts); the honest series is weekly
full-coverage snapshots then daily from live (verified smooth: Pokémon-100 817→1,223
over 3 months, members=100 throughout). Backfill mode deletes each series before
recomputing so stricter rules never leave stale rows. Also fixed en route: PriceChart
extreme markers crashed when an overlay held the scale extreme; the catalog API's
readiness guard needed >= (retried batches stamp more rows than they count).

**Custom domain live 2026-08-28:** the user registered `rawsignal.cards` and routed it to
the staging Worker — verified serving the full current stack (database feeds, D1 detail
pages) over Cloudflare. The production-promotion hostname blocker is resolved; the
remaining promotion steps are the one-week cron soak, D1 export + Time Travel bookmark,
and the dedicated production Worker/D1 split decision.

**H2 peer comparisons — LANDED 2026-08-28** (user-directed: keep the existing
average-sentence lines for now; removal/hiding decided later). `peerAverage` gains
cohort rank (`position`/`cohortSize`, market-desc, ties rank above) and peer-only
quartiles (null under four priced peers). The hero peer block now shows: the kept
average sentences with "#N of M (top P%)" appended, a quartile spread strip
(min/median/max labels, IQR band, median tick, fair-gauge-style marker; hero-capped at
520px), and a 30D momentum compare (cohort momentum from `peerAnchor.current` vs
`avg30` · this card from client history).

**live leaderboard feeds — LANDED 2026-08-28.** The UI-to-API question resolved with a
far lighter design: `worker/live-feeds.ts` serves the exact `/data/<section>.json` and
`/data/sealed-<market>.json` URLs the leaderboard already loads, from current D1 rows
(same shapes/ordering as the sync scripts, `X-Raw-Signal-Source: database` header),
requiring `assets.run_worker_first:["/data/*"]` with an explicit `ASSETS.fetch`
fall-through for non-intercepted paths (detail chunks, manifests, configs, scalping).
Zero UI change; dev/Playwright (no DB or no marker) fall through to static assets; the
Worker-side ingestion reads assets via the binding directly so the live sync never
consumes its own output. **The leaderboard now shows live data** — the full
server-paginated /api/catalog switch is no longer a prerequisite for freshness and stays
optional. Verified: leaderboard renders from database feeds on staging.

**peer accumulation slice — LANDED 2026-08-28.** Derive-on-read instead of a second
accumulator: `db/peer-anchors.ts` computes the set-rarity cohort's daily averages
directly from `price_observations` (primary printing, Near Mint, 180-day window) and
summarizes them through the same pure `core/peer-history.ts` the feed script
uses. No migration, no cron action, no seeding — the live daily run's observations ARE
the accumulation, and the backfilled history is deeper than the 1-obs/day file, so
anchors activate immediately where the feed accumulator was still counting toward 14.
Verified on staging: "Set-rarity anchored" renders in the fair-value panel on
`source:"d1"` pages.

**pull-rates parity follow-up — LANDED 2026-08-28.** The curated `pull-rates.json`
config threads from `load-detail.ts` (isolate-cached asset fetch) into
`createD1CatalogRepository(db, runId?, pullRateConfig?)`, restoring the hero Pull-rate
tile on singles and the Pull rates section on sealed for D1-served pages. **D1 detail
parity is now complete** — enrichments, related products, graded, peer anchor, and pull
rates all match the feed path.

**product_details slice — LANDED 2026-08-28.** Checkpointed chunk runner
`db/detail-ingestion.ts` (cursor = enrichment chunk file; FK-filtered against
`catalog_products`; batched upserts), staging job `details`, guard-cron action `details`
(after each snapshot's catalog run; decision-tested). All 223 chunks ingested: 16,898
detail rows, 22 FK skips. Detail pages now serve `source:"d1"` for singles and sealed
(~350–530ms detail query vs the ~2.1s cold feed-repository build). Two D1 adapter bugs
fixed en route: detail loads are no longer pinned to the published run id (in-progress
re-ingestion re-stamps `ingestion_run_id` and was excluding re-ingested products —
the real cause of the persistent feed fallback), and `getDetail` loads peers of both
kinds (singles need related sealed, sealed need chase cards). The silent D1-fallback
catch now logs `d1_detail_failed`.

**Phased plan (runbook: docs/cloudflare-cutover.md):**
1. **Gate 0 — authorization** (blocks everything): your Wrangler login, `STAGING_JOB_TOKEN`,
   and explicit written go-ahead for Cloudflare mutations.
2. **Backfill to readiness**: staging catalog job (`{"job":"daily","batchSize":80}` to
   `done:true` → `daily-market` marker), then history backfill (`{"job":"history",…}` across
   days → `history-signals` marker).
3. **Parity gate**: `npm run cloudflare:parity` vs Sites production — records, counts,
   facets identical with `source:"database"`.
4. **Scheduled ingestion**: Cron Triggers on the Worker — daily catalog+prices ~20:10 UTC
   with the `last-updated.txt` freshness probe (UA header required) and in-run retries;
   graded rotation daily under the free-tier budget; peer-average accumulation moves from
   the feed script into the same run (deeper history than the 1-obs/day file it replaces).
   Decision: plain Cron + checkpointed jobs (free tier, proven) vs paid Workflows
   (resumability/monitoring) — recommend starting with Cron + existing checkpoints.
5. **Cutover — DECIDED 2026-08-27 (user):** hosting moved entirely to the Worker. The
   environments of record are the local dev server (port 3000) and the published Cloudflare
   deployment — the staging Worker URL serves as production until a dedicated production
   Worker + hostname are approved. OpenAI Sites is dormant (no more vN tarballs; the Sites
   project and `.openai/hosting.json` are preserved as the rollback path, revivable only on
   explicit request). AGENTS.md hosting/deployment sections rewritten accordingly.
6. **Decommission the manual loop — DONE with 5:** the v-N tarball packaging cadence ends;
   publishing = gate → prepare staging config (`--cron`) → `wrangler deploy`; feeds stay
   bundled as the emergency fallback path.

**Effort/risk.** Large; spans sessions; every mutation step gated on you. Nothing here
starts without the Gate 0 items.

**7. Production Worker/D1 split — COMPLETED 2026-08-28 (user decisions: split yes, fresh
backfill, production-only ingestion, same-day cutover).** New Worker `raw-signal` + D1
`raw-signal-production` (`af781f30-9cb1-4e5d-a396-7fd927e9a23b`) commissioned via the ops
adapter (temporary `ENVIRONMENT=staging` + workers.dev), seeded fresh in one sitting:
live catalog (228 groups), 16,825 detail enrichments, 15,981 history targets (97.9% with
data, 50 snapshot-drift targets skipped — the seed exposed and fixed a history-backfill
FK failure: batches now skip targets missing from the catalog, `skippedMissingCatalog`
stat, covered in domain-contracts tests), 43 graded rows carried over (1 delisted product
dropped), metrics rollup. Parity passed (all 6 cases, database-backed both sides);
pre-cutover D1 exports + Time Travel bookmarks in `backups/`. Cutover deploy attached
`rawsignal.cards` + `*/2` cron to `raw-signal` (`ENVIRONMENT=production` disables the
adapter; workers.dev off) — wrangler claimed the domain without a manual release.
Staging demoted to cron-less sandbox (user rule: staging stays cheap — no scheduled
ingestion, stale by design). Graded key lives only on production. AGENTS.md hosting/
deployment sections updated 2026-08-28.

---

## H. Second batch (added 2026-08-27, from user review of v71)

**Implemented same day (no clarification needed):** ⓘ info-hint raised to sit slightly
above the baseline; filter summaries list every selected set by full name as individually
clearable chips (singles + sealed); Pokémon `Cases` excluded from the related-sealed top
12 (data layer, wholesale outliers); `SegmentedView` sizes its grid from `--view-count`
so the 2-option Medium/Text toggle no longer reserves four slots; the sub-1000px in-flow
row expansion now restates the hover-card anatomy (surface-raised card, blue-tinted
border, panel radius, stacked history panel, 2-col metric tiles); TCGplayer button moved
to the hero's top-right on the kicker row; hero art tilts toward the cursor (see
design-baseline exception); printing chip removed from the primary price (kicker already
names it); card-details expander slides open via `interpolate-size` progressive
enhancement.

### H1. Production font-size regression — RESOLVED 2026-08-27

**Actual root cause (confirmed):** `next/font/google` under vinext baked absolute local
cache paths (`C:/Users/.../Test Project/.vinext/fonts/...`) into the production server
bundle's `@font-face` rules, so every deployed build ever shipped rendered the Arial
metric fallbacks instead of Geist — `Geist Mono Fallback` is size-adjusted to 134.59%,
which made deployed mono numerals visibly larger/heavier at identical CSS values. Fixed
by self-hosting: woff2 files in `public/fonts/`, hand-owned `app/styles/fonts.css`
(declarations + fallbacks + `--font-sans`/`--font-mono` on `:root`), `next/font` removed
from the layout, and a css-architecture test forbidding absolute paths in font CSS.
Verified on staging: `document.fonts` loads Geist/Geist Mono, `.position` renders
12.5px Geist Mono identical to dev. The fix is live on the published Worker deployment;
the dormant Sites project keeps the bug until revived with a fresh package. The
hypotheses below are superseded (kept for the record):

*(original analysis)*

**Symptom.** On the live Sites deployment, "a lot of fonts displayed are a bit too
large" compared with pre-v70.

**Analysis.** v70's A1 type ramp changed the root from fixed px sizes to
`html{font-size:100%}` with rem tokens, plus `html[data-font-size="large"]{font-size:108%}`.
Two candidate causes, in likelihood order:
1. **A stored Large preference now scales everything.** `raw-signal-font-size=large` in
   the production domain's localStorage (set any time in the past) used to enlarge only a
   whitelist of annotation text; since A1 it scales the entire page by 108%. Same stored
   value, much bigger visual effect.
2. **Browser font-size setting now applies.** Chrome's Appearance → Font size (or OS
   accessibility text scaling routed through it) scales rem but never scaled the old px
   values. Any setting above Medium (16px) enlarges the whole site post-A1.

**Verify (user, on the production site):** ⚙ settings → Font size — if it shows Large,
switch to Default (cause 1 confirmed). Otherwise check the browser's font-size setting
(cause 2).

**Planned fix by cause (apply after confirmation):**
- Cause 1: recalibrate Large from 108% → ~104–105% (it now multiplies everything, so the
  old calibration overshoots), and keep Default untouched.
- Cause 2: pin `html{font-size:16px}` so the app's own two-step control is the only
  scale, documenting the trade-off (site no longer follows browser font preferences);
  or accept browser scaling as intended accessibility behavior and close as
  works-as-designed.

### H2. Peer-context metrics: richer comparisons (design direction wanted)

Today: "Average Showcase cards in Vendetta: $243 across 55 others · this card sits
103.8% above that average." Candidate upgrades, roughly ordered by value:
1. **Median alongside (or instead of) mean** — TCG cohorts are chase-skewed; the mean
   overstates the center. Cheap: peers are already in memory.
2. **Cohort rank + percentile** — "#3 of 55 Showcase cards in Vendetta · top 5%". More
   intuitive than %-above-average; data already at hand.
3. **Peer momentum comparison** — cohort median 30D change vs this card's ("peers +2.1%
   · this card +12.9%") — needs per-peer history, feasible from D1 after G1 or the
   peer-anchor accumulation feed.
4. **Distribution strip** — a tiny quartile/box strip with a marker for this card;
   reuses the range-position visual language.
5. **Nearest peers** — the cards directly above/below in cohort price, linked.
**Decided at review (2026-08-27): build 2 (rank + percentile), 4 (distribution strip),
and 3 (peer momentum compare — lands with the D1-backed API since it needs per-peer
history). Median-alongside-mean and nearest-peers were not selected.** Layout (one line
vs tile block) stays an implementation call within the design baseline.

### H3. Metrics page (research + plan for review)

**Goal.** A `/metrics` page: per-market totals, cross-market comparisons (Riftbound vs
Pokémon, sealed vs singles), set-level comparisons, a top-100/200 index for cards and
sealed, and momentum indicators.

**What the data supports today.** Feeds give a full daily snapshot (prices for ~16.9k
products) — aggregates per market/set are computable at build time. Time series need
history: per-product `/api/history` is too chatty for page-level aggregates, but the D1
`price_observations` table (Phase 4 backfill, ~90 days × ~16k products) supports SQL
aggregation directly.

**Proposed architecture (post-G1 alignment):**
1. `/api/metrics` on the Worker computing from D1: daily aggregate series per market/set
   (sum of market prices as tracked-market value, median price, advance/decline counts,
   new-high/new-low counts) plus index series.
2. A generator-precomputed `data/metrics.json` fallback (current-day snapshot + limited
   series accrued per deploy) so the page also works on Sites feed-only.
3. Client page sections: market overview tiles (tracked value, 7/30/90D change per
   market) → index charts (RS-100 Cards / RS-100 Sealed) → Riftbound vs Pokémon
   normalized comparison (base-100) → set leaderboard table (value, median, momentum) →
   momentum dashboard (advance/decline, % above 30D average, new 90D highs/lows).

**Decided at review (2026-08-27):** index methodology is **equal-weighted** (top-100 by
market price, rebalanced daily); the page **ships staging D1-backed first** via
`/api/metrics`, with the Sites fallback feed following later. Defaults adopted unless
revisited at build review: index series backfilled from D1 observations; "total market"
shows singles and sealed with a per-mode breakdown and One Piece sealed included in the
comparisons; chart needs (multi-series overlay for the Riftbound-vs-Pokémon base-100
view) sized during implementation.

**Build decisions (2026-08-28, user):** Metrics gets a **TopBar link**; indexes are
**both combined and per-game** (RS-100 Cards, RS-50 Sealed, Pokémon-100, Riftbound-50);
history is the **honest sparse backfill** (per-date top-N from observations, gated by a
per-date observation floor — the composition rule from peer anchors); **no Top Movers in
v1**. Implementation shape: migration 0004 `market_daily_metrics` (series,
observed_date, value_cents, members); `db/metrics-ingestion.ts` rollup (daily mode via a
new cron `metrics` action that runs only after the day's live run completes; backfill
mode via the adapter); sealed index excludes Pokémon Cases (consistent with related
sealed); same-day figures (overview totals, set leaderboard via per-product
`market_metrics.change_30_bps`, advance/decline counts) compute on request; one
`/api/metrics` payload, edge-cached; page renders an explicit unavailable state without
the database.

### H4. Metrics page v2 (planned 2026-08-28, user review of the live page)

User items, with the decisions taken at planning:

1. **Momentum moves up**: section order becomes Overview → Momentum → Indexes →
   Pokémon vs Riftbound → Set leaderboard.
2. **Overview change tiles**: 7D/30D/90D render as proper `detail-metric`-style tiles
   with tone colors (replacing the cramped `metrics-changes` mono row); fixes the sealed
   tile's stacked-breakdown-plus-N/A layout too.
3. **Scope control — decided: whole page.** ALL / Pokémon / Riftbound segmented control;
   scope lives in the URL (`/metrics?market=…`, content state not device preference).
   Every section responds; requires per-game momentum splits in `loadMetricsPayload`.
4. **Styling/responsiveness parity**: sweep against `docs/design-baseline.md` — more
   breakpoints than the single 900px one, chart heights on small screens, font-ramp and
   flat-hover compliance, `data-font-size` behavior.
5. **Set leaderboard — decided: top 30, sortable.** `SortableHeader` sorting, tone
   chips for momentum, main-table hover treatment; optional 7D momentum and top-card
   columns.
6. **Hover explanations**: `InfoHint` ⓘ on equal-weighted/rebalanced, tracked value ≠
   market cap, median card, index start date (coverage floor), advancers/decliners,
   all-time-high basis.
7. **Sealed — decided: full mode toggle.** Singles/Sealed mode mirroring the main page,
   plus the market scope: new `METRIC_SERIES` entries (`index:pokemon-sealed`,
   `index:riftbound-sealed`, `index:onepiece-sealed`) with a one-time backfill rollup,
   sealed category leaderboard, sealed momentum. Sealed charts start short (shallow
   sealed history) and grow daily — shown honestly.
8. **Movers — decided: ships this round.** Top gainers/decliners (7D/30D) linking to
   detail pages, from existing `market_metrics`.

Additional planned items: investigate the Riftbound-50 sawtooth (composition churn near
the 100-observation floor — raise the floor or offer a 7-day smoothing toggle); change
chips on index cards (7D/30D/90D deltas); advancers-vs-decliners ratio bar; "history
accumulating" instead of N/A chips for young sealed series; short `Cache-Control` on
`/api/metrics`.

**Landed 2026-08-28 (staging-verified, awaiting production push):** All eight items plus
the extras. Decisions taken at build: movers floor **$10/$20 on both ends of the move**
(implied prior price must clear it too) plus symmetric sanity caps (7D moves beyond
+300%/−75% and 30D beyond +500%/−83% are listing-turnover noise, excluded and disclosed
in the ⓘ); **Riftbound sealed imports from the existing category-89 walk** (73 upstream
products vs 33 curated; riftbound-specific category taxonomy matching the curated feed,
curated MSRPs merged by productId, bulk lots excluded, bundled feed still rides along
for curated-only products; One Piece import deferred by user choice — stays at 23
curated); small sealed indexes use **top-66%-of-cohort membership** (`topPct` SeriesDef,
integer-rounded in SQL) with floors 20/12; Cases excluded from every sealed index
uniformly. Payload rows carry game+kind and the client composes scopes (ALL = sums +
combined series); momentum join fixed to include sealed (`variant='Sealed'` rows were
silently dropped before — 3,721 sealed products now counted). Production backfill for
new series: `node scripts/cloudflare/print-metrics-backfill.mjs --series …` →
`wrangler d1 execute --remote --file` (ops adapter is off in production);
`scripts/cloudflare/print-metrics-backfill.mjs` + `metricsBackfillStatements` are
tested. Staging-verified in browser: scope/mode/URL sync, One Piece scope, sortable
tables (aria-sort), movers window toggle, mobile 375px (no body overflow), category
leaderboard, "history accumulating" states. Riftbound/One Piece sealed 66% indexes
draw real backfilled charts; RS-50 Sealed / Pokémon Sealed-50 accumulate honestly
(historical sealed observation depth is below their floors). Production will ingest
the 73 riftbound sealed on its next daily live run.

## I. Queued from the staging visual pass (2026-08-28)

Deferred to a later phase at the user's direction:

1. **Large image view on mobile** — the large-card grid needs a real phone treatment, and
   the tap model currently conflicts: tapping a tile is expected to both reveal the history
   popup and navigate to the single card/sealed detail page. Decide one tap model (e.g.
   first tap = popup, explicit control = navigate) and apply it consistently.
   **Tap model decided 2026-09-01 → planned as §N1** (tap = popup toggle, explicit
   "View card" button in the popup navigates); the large-grid phone treatment itself
   stays queued here.
2. **View mode persists across list pages** — switching between Leaderboard / Hot Buys /
   Hot Sells and Singles/Sealed should keep the selected view mode (large/medium/text/full)
   instead of resetting per surface. Likely a localStorage device preference layered under
   the URL param (an explicit URL view still wins on shared links).
3. **Sealed-detail sale scenario rework** (panel hidden 2026-08-28 pending this): move the
   Sale Scenario section down to sit directly above the "Product overview" (Product
   Details) section; render it **only in scalper mode**; and let a **purchase price be
   entered manually** to replace the MSRP-derived total cost in the profit math.

## J. Sets view backlog (added 2026-08-29)

**J1. Sort control on `/sets` (user-deferred at planning, 2026-08-29).** A control on the
sets browse page reordering set tiles WITHIN their era/category groups by release date
(default), 30D momentum, or tracked value — groups keep their order, tiles re-rank
inside them, so "which Scarlet & Violet set is moving" is answerable without scanning.
Excluded from the initial build; revisit after the browse page has real usage.

## K. Signal display (added 2026-08-30)

**K1. Handle a card/sealed product that carries a Hot Buy and a Hot Sell signal at once
(added 2026-08-30).** When a product qualifies for *both* boards at the same strictness —
its price sits close to both its 30-day low and its 30-day high, i.e. a tight recent range
with conflicting momentum — the current UI would show whichever side the surface asked for
(e.g. the import table's Hold lens shows the buy, the Hot Sells lens shows the sell) and the
two never reconcile. Decide and build a distinct treatment for this collision: e.g. a
combined "Conflicted / range-bound" badge, showing both sides side by side, or a tie-break
rule (stronger score wins, with the loser noted). Applies anywhere signals render — the
Collectr import table, the Hot Buy/Hot Sell boards, and single-card / sealed detail pages.
Needs a definition of "very close together" (score delta and/or distance-to-cutoff
threshold) before implementation.

## L. Catalog coverage gaps (surfaced by the Collectr import, 2026-08-31)

Diagnosed from the @srikaskrr test import: several unmatched items are real products we
simply don't ingest. Matching is a TCGplayer product-id join, and a **name fallback now
runs on the showcase path too** (commit adding sealed/singles name-fallback), which catches
items we hold under a different id — but it can only match against catalogs we actually
ingest. These are ingestion-scope gaps to close (each is a TCGCSV category we don't pull):

**L1. Japanese sealed Pokémon — MEASURED 2026-08-31, option B IMPLEMENTED.** We tracked
**zero** JP sealed (all ~2,692 Pokémon sealed rows were English ids); JP *singles* are
tracked only as the 22 promo groups of category 85 (~1,184 priced "Japanese Promos").
Collectr lists JP boxes under its own synthetic ids (10,000,000+), but they DO exist on
TCGplayer category 85 — e.g. **Eevee Heroes Booster Box = TCGplayer 565351** (S6a,
publishedOn 2021-05-28); VSTAR Universe (S12a 2022), Shiny Treasure ex (SV4a 2023),
Pokémon 151 JP (SV2a 2023). Measured: category 85 has 456 groups (434 non-promo ≈
18,500 products) but only **~254 sealed products (~224 priced, 1.4% yield)** — each JP
set carries just booster box/pack + occasional premium trainer box. Tick cost scales
with group count, not products, so the options were: A) full 434-group walk = +868
req/day, +~41 cron ticks for ~254 keeps; **B) modern cutoff publishedOn ≥ 2020 (140
groups, SWSH era on — covers every Collectr miss) = +280 req/day, +~15 ticks, ~150–180
sealed — CHOSEN**; C) sealed-group cache (~+11 ticks, full coverage, new plumbing) —
available later if completeness matters. JP sealed stays `game:"pokemon"` (no
migration) and joins the English Pokémon sealed catalog/feed. JP promo groups remain
singles-only (their ~6 sealed-shaped items stay out, unchanged). Full JP singles
(~15,800 priced) would exceed the entire current singles catalog and blow the cron
budget (+~263 history ticks — infeasible); curated JP chase rarities (AR/SAR/SR/UR,
~3–4k records, +~80–105 ticks/day) is the only viable singles shape — unscheduled, and
the priciest expansion on the board after MTG.

**L2. One Piece — full sealed + singles. Sealed APPROVED 2026-08-31; singles deferred
to its own phase.** OP sealed is only ~23 curated products today; the main English OP
**booster boxes** are missing (e.g. "Carrying On His Will Booster Box" = TCGplayer 628352).
Measured (see `docs/sealed-market-expansion.md`): cat 68 = 87 groups, 7,518 products,
~420 sealed → +174 TCGCSV requests/day, +~400 history calls/day, +~15 cron ticks, **no
migration** (the game check and onepiece⇒sealed check already fit). Plan: `sealedOnly`
work entries in the live walk + `isOnePieceSealedProduct` normalizer + Bandai-derived
MSRP table + full `sealed-onepiece.json` sync; downstream (SealedGame union, metrics
index, sealed-page scope, Collectr import matching) is already plumbed.
OP **singles** are still untracked (0 rows) — promos/parallels like Monkey.D.Luffy
OP05-060 (557296), Boa Hancock OP07-038 (623618), Otama OP07-022 (545804) can never
match. Fetch cost of singles is zero (same group payloads), but all singles = +7,100
records and +~210 cron ticks/day (near the 720 cap) plus a catalog_products table
rebuild (drop the onepiece⇒sealed check) and a full new singles market surface (rarity
taxonomy, sections, market tab, enrichment, metrics, signals).
**Singles plan of record (decided 2026-08-31): curated chase-rarity sections** — Alt
Art / Manga / SEC / SP / parallels only (~1.5–2.5k records, +~50–80 ticks/day), the same
section model Pokémon singles use. Scheduled as its own phase; not started.
*Sealed IMPLEMENTED 2026-08-31:* category-68 `tcgcsv-sealed` walk entries in
`db/live-ingestion.ts` (sealed-only, singles never normalized), `isOnePieceSealedProduct`
+ `normalizeOnePieceProductType`/`normalizeOnePieceSealedProduct`, curated Bandai MSRPs
migrated to `verifiedMsrp["onepiece:*"]`, full generated `sealed-onepiece.json` via
`npm run data:sync:sealed:onepiece` (420 products, 348 priced, replaces the curated 23).

**L3. Magic: The Gathering sealed — DEFERRED 2026-08-31 (usage cost).** No MTG game is
tracked. Collectr users hold MTG sealed — e.g. "Universes Beyond: FINAL FANTASY – Gift
Bundle" (618899). Measured plan (full numbers in `docs/sealed-market-expansion.md`):
cat 1 = 455 groups, ~178k products, only ~2,450 sealed (1.4% yield) → a daily
sealed-only walk costs +910 TCGCSV requests, ~150–200 MB JSON downloaded (99% discarded
singles), +~2,300 TCGplayer history calls, +~77 cron ticks — ~6× the One Piece cost.
User call: too much usage for now. If revived: (a) migration required — the
`catalog_products_game_check` blocks 'mtg', SQLite CHECK change = table rebuild, add an
mtg⇒sealed check; (b) MSRP stays null (WotC abolished MSRP in 2019) except curated
verified entries (Secret Lair, pre-2019); (c) cost levers — sealed-group cache (after
one discovery walk, re-walk only groups holding ≥1 sealed + newly published groups,
~30–40% savings) or a weekly walk; a modern-only cutoff barely helps (303/455 groups
are 2015+); (d) everything else rides the OP `sealedOnly` rails.

**L4. Retailer-exclusive Pokémon sealed gaps.** Some real TCGplayer SKUs aren't in our
catalog even for English — e.g. "Costco Prismatic Evolutions 8-Pack Mini Tins" (653892).
Audit whether our sealed ingestion is dropping retailer exclusives (Costco/Sam's/Dollar
General variants) or just missing recent additions.

## M. Ingestion scaling & cost fixes (researched 2026-08-31)

Full research in `docs/ingestion-scaling.md` (capacity model, Cloudflare billing
analysis, TCGCSV bulk-archive evaluation). Constraints in one line: the cron has
~200 spare ticks/day (fits ONE more expansion), the daily history job is a permanent
per-product tax, and D1 **rows written** is the only billing meter near its included
limit (~61M projected vs 50M — ~$11/cycle) because history re-upserts ~90–150
unchanged points per product nightly. Each item below is a proposal awaiting a call.

| # | Fix | Effort | Why |
|---|---|---|---|
| M1 | **Delta-only history writes** — persist only points newer than the stored max observed_date | S–M | cuts D1 writes ~97%; removes the only projected overage; bill stays $5 at any catalog size |
| M2 | **Cron `*/2` → `*/1`** | XS | doubles tick budget to 1,440/day; verified $0 (requests/reads/CPU all ≪ included) |
| M4/M5 | **IMPLEMENTED 2026-08-31** — see `docs/ingestion-scaling.md` for the measured tier split, the dropped signal rule, and the production sales-null discovery | — | staging-verified; activates on next production deploy |
| M6 | **EXECUTED 2026-09-01** — 279,945 archive observations for 574 OP/JP sealed loaded to production; `index:onepiece-sealed` now draws 191 days; details in `docs/ingestion-scaling.md` | — | archive cache kept for a cat-3/89 extension |
| M3 | **Sealed-only groupFetchCap 12 → ~40** | XS | sealed groups yield ~1 record; ~3× sealed-walk speed at ~80 of 1,000 allowed subrequests |
| M4 | **Tiered history cadence** — hot/liquid daily, long tail every 3–7 days | M | catalog can ~3× without the history tax tripling; our own daily observations already capture the close |
| M5 | **History targets from D1** instead of deploy-time bundled feeds | M | expansions stop requiring sync-script regen; coverage tracks the walk automatically |
| M6 | **Archive sealed-history backfill (one-shot)** — TCGCSV daily price archives (4 MB, back to 2024-02-08) rebuilt locally for categories 68/85 | M | 2.5 years of daily history for the 587 new OP/JP sealed; TCGplayer's API is thin on sealed |
| M7 | **Category registry** shared by walk + sync scripts + tests | M | next game becomes a config entry + normalizer instead of a five-file change |
| M8 | **Widen the `catalog_products` game CHECK once** (mtg/yugioh/lorcana) | S | batches the per-game SQLite table-rebuild migration tax |
| M9 | **Sealed-group cache** — re-walk only groups containing sealed + new groups | M | ~30–40% off sealed walks; build only if MTG revives |
| M10 | **Archive-based daily bulk ingestion** (external job → D1/R2) | L | only at MTG-singles scale; archive is prices-only and can't decompress in a Worker |
| M11 | **Cache buildWorkList per run** — group indexes currently re-fetched every tick | XS | drops ~1,250 pointless requests/day (free, but tidy) |
| M12 | **Rejected-stats review report** — surface the walk's per-run rejection reasons | S | catches taxonomy drift; data already recorded, nobody reads it |
| M13 | **§L4 classifier audit** — why Costco PE 8-Pack Mini Tins (653892) misses while the Costco 151 bundle lands | S | likely a name-pattern miss, not an ingestion-scope gap |

**Recommended order:** M1 → M2+M3 (after which OP curated singles AND MTG sealed
both fit) → M4+M5 before the next singles expansion → M7+M8 with the next new game
→ M6 when sealed chart depth matters → M9/M10 parked pending MTG.

**Status 2026-08-31 — M1, M2, M3 IMPLEMENTED.** M1: `runHistoryBackfillBatch` reads
each batch's stored min/max frontier per product/variant/condition and upserts only
points newer than the max, older than the min (so a new product's first daily
observation never blocks its deep backfill), or inside the trailing 7-day revision
window (`HISTORY_REVISION_WINDOW_DAYS` — TCGplayer revises recent days); derived
metrics still compute from the full fetched series; `pointsWritten` stat added and
delta behavior contract-tested (31 points day one → 8 on the repeat run). M3:
sealed-only (`tcgcsv-sealed`) entries count against their own
`SEALED_GROUP_FETCH_CAP = 40` instead of the singles group cap (worst straddling
tick ≈ 104 subrequests of 1,000); tested (20 sealed groups complete in one batch
under a pinned cap of 12). M2: cadence raised to `*/1 * * * *` in the runbook and
deploy commands — **takes effect at the next production deploy** (cron is a
deploy-time flag; nothing to change in code).

## N. Mobile pass 2 + site footer (planned 2026-09-01, from user mobile review)

**N1. Mobile tap model: tap = chart popup, explicit control = card view (resolves §I.1).**
Current touch behavior in [MarketRow.tsx](../app/leaderboard/MarketRow.tsx): first tap
reveals the popup, but a SECOND tap anywhere on the row navigates — closing the popup by
tapping again accidentally opens the detail page. Decided model: on touch (no-hover)
devices, tapping the row only toggles the popup open/closed; navigation happens through
an explicit **"View card →" button rendered inside the popup** (HistoryPopover footer,
touch-only — desktop hover behavior unchanged). Optional extra: double-tap (two taps
≤350 ms) on the row as a power shortcut to navigate — deferred unless wanted; double-tap
fights iOS zoom heuristics and is undiscoverable, the button is the primary affordance.
Files: `useDisclosurePopover.ts` (touch branch of `onDetailClick` moves to
toggle-close), `MarketRow.tsx`, `HistoryPopover.tsx` (+ the sealed/full-view variants),
small CSS. Keyboard/focus and previews-off (click navigates) behavior stay as-is.

**N2. Detail-page section view toggles too narrow on mobile.** The Medium/Text
`SegmentedView` in the sealed detail "Chase Cards" and "More Sealed from {set}" headers
([detail-tables.tsx:34](../app/detail-tables.tsx),:58 — `.detail-table-views`) renders
cramped next to the h2 at phone width. Fix: at ≤560px the section header wraps
(`flex-wrap`) and the toggle takes a full-width row with comfortable per-option hit
targets (~44px min height); desktop unchanged. CSS-only in `detail.css`.

**N3. Site-wide footer (mobile + desktop).** Only the main page has a footer
([page.tsx:1092](../app/page.tsx)). Add a shared condensed `SiteFooter` component:
brand + one provenance sentence (cached TCGplayer data, unavailable-not-estimated) +
links (Rankings · Sets · Metrics · Buy List · Methodology → `/#method`). Render on:
detail pages (ProductDetailPage), `/sets`, `/metrics`, the import page, and 404; the
main page keeps its full footer (or swaps to shared + methodology anchor — decide at
build). New `app/SiteFooter.tsx` + styles; server-renderable, no client state.

**N4. Mobile leaderboard header restructure.** At phone width the header is a squeezed
two-column layout: the h2 wraps one word per line ("Scalping / Obey / Products /
Sealed"), and the aside ("110 products · $11,380 combined market / Updated …") burns a
tall narrow column. Decided flow (single column at ≤560px):
1. Title (smaller ramp step so multi-word market names fit, `text-wrap: balance`);
2. One full-width details line: `110 products · $11,380 · Updated Aug 31` (wraps to two
   lines at most);
3. Controls row: filters + search; the **Market/Median** toggle moves DOWN into this
   row on mobile instead of being removed (function kept, prominence dropped) — remove
   only if it still crowds after the move (user flagged possible removal).
Files: the header block in `page.tsx`/`SealedView.tsx` + `LeaderboardHeader.tsx`,
`market-controls.css`/`globals.css` breakpoint work. Verify at 390px (Playwright
phone-width spec guards overflow).

**N1-N4 IMPLEMENTED 2026-09-01 (one batch).** Decisions taken at build: the
Market/Median toggle was removed SITE-WIDE (user call), not just on mobile - display
basis pinned to market in SealedView while the capability survives underneath (the URL
codec still parses/serializes `basis`, query + scenario layers stay parameterized, so
a future surface can re-expose it without data work); the `.price-basis` CSS blocks
were deleted. N1: touch taps toggle the popup (second tap dismisses), a "View details
->" link renders in every popup and hides on hover-capable devices; the double-tap
shortcut was NOT added (fights iOS zoom heuristics). N4 uses `display:contents` on the
header inner div so the aside orders between title and filter chips at <=620px.
Verified at 375px emulation: no overflow, full-width section toggles (N2), footers on
detail/metrics/sets/import/404 (N3).

## O. Monetization & marketplace integration (added 2026-09-01, unplanned)

**O1. eBay and TCGplayer affiliate links.** Convert the outbound product links into
affiliate/partner-tagged URLs: the existing TCGplayer buttons (detail-page hero,
leaderboard "View on TCGplayer") via the TCGplayer affiliate/impact program, and the
eBay links from O2 via the eBay Partner Network (EPN campaign id on the URL). Needs:
program signups + credentials (user), a small shared link-builder helper so tags apply
consistently everywhere links render, and a disclosure line (footer/methodology) per
program requirements. Scope and plan at review before implementation.

**O2. eBay product links and integration.** Surface eBay alongside TCGplayer on
product detail pages (and possibly rows): at minimum a search-style outbound link like
the existing PriceCharting button (no API needed); deeper integration could use the
eBay Browse/Finding APIs for live listings or sold-comps pricing next to the TCGplayer
market price (API keys, rate limits, and a caching/ingestion path to size at review —
sold-comps would be a genuinely differentiating data source but is the expensive half).
Plan the link tier first; the API tier is its own phase.

## P. Signal-model evolution (planned 2026-09-01; from docs/buy-sell-estimation-research.md §15)

Source research: `docs/buy-sell-estimation-research.md` (baseline-revised 2026-09-01;
original lives in `Documents\Test Project\docs`). Decisions taken at planning: **harness
first**; **full regime labels** (boards + detail, with board filters); **production gate:
every scoring change must beat the current model and the simple baselines out of sample
on the harness** (staging previews allowed earlier); the detail panel keeps the
**"Modeled Fair Value"** name (doc terminology rule amended).

**Gated middle model (adopted 2026-09-01 follow-up).** The archive spans one market
regime (Feb 2024→now, broadly rising), which cannot calibrate the research's ~6
continuous weights per side without overfitting; weighted terms also renormalize
messily when inputs are missing and churn every score on day one. So new intelligence
lands as **gates and one-tier confidence modifiers** (~4 thresholds, each 1-D-sweepable
on the harness and independently measurable), the current score core (proximity + swing
+ confidence) stays, and the §5 weighted blend is demoted to a **contingent v3** —
adopted term-by-term only if the harness shows the gated model leaving measurable
precision on the table.

**Lifecycle weighting findings (research §§6–10, follow-up analysis).** For the
established, board-eligible cards signals actually score (liquidity floor ⇒ mature
history), pull rates/pack costs, sealed prices, same-character comparisons, and the
cohort *level/center* all get **~0 score weight** — their information is already in the
card's own price, and adding them re-counts it (§6.5 endogeneity loop: chase demand →
sealed price → pull cost → card price). They live on as display/context (buy-vs-open
pull-cost comparison, Cohort Position, Rarity Market Index) and as **new-card priors**
for the deferred Phase-4 Early Value Estimate (cohort median as the anchor — the
Overnumbered cohort clusters near $100 regardless of pull rates, i.e. within-cohort
pull-difficulty β ≈ 0, which the harness can confirm; character premium starts 20–25%
and tapers to ~0–3% by 60 observations; a character/icon field does not exist in the
catalog and is a Phase-4 data-foundation task). One earned v3 candidate: extreme cohort
band deviation (below the cohort's ~10th percentile AND stabilizing) as an extra Hot
Buy evidence line — price-only, backtestable.

Architecture note: `evaluateMarketSignal` is the single scoring path for the batch
writer (`db/daily-ingestion.ts` → `market_signals`), the detail signal panel, and row
badges. P2 introduces an optional `SignalContext` parameter (liquidity, cohort return,
set/game index return, breadth, sales trend — all optional, absence = neutral) so every
surface shares one implementation. Known inconsistency to fix in P2: the detail panel
currently evaluates without liquidity, so board-excluded illiquid cards can look
qualifying on their own page.

**P1. Walk-forward harness (prerequisite for every scoring change).**
`scripts/backtest/` runner against the local max-profile DB (~13.5M observations, free
locally): for each historical date, slice `price_observations` to only-then-known data,
evaluate current + candidate model variants (variant flag on the evaluator — production
and harness share code), record 7/30/90-day forward returns, report §11.2 metrics
(median forward return, top-20 precision, MAE after buys, calibration,
coverage-vs-precision per strictness) against four baselines: near-extreme, 30-day
momentum, cohort median, random eligible. `signal_history` (daily top-100 board
snapshots since 2026-08-28) doubles as the live forward track record. Hard limit:
sales/liquidity features cannot be backtested (TCGplayer serves trailing-90D buckets
only; archives carry no sales) — they get forward shadow-validation instead.

**P1b. Champion/challenger shadow (starts as soon as P2 code exists).** The batch
writer evaluates BOTH model variants per product per day (pure CPU on data already in
hand); v1 keeps serving the boards; the challenger's top-100 per side is snapshotted
daily alongside `signal_history` (a `model` column or parallel shadow table, ~200
rows/day). Promotion requires the harness verdict AND the live shadow comparison
(same cards, same days ⇒ forward-return differences are attributable to the model);
after promotion the old model keeps running as the shadow so regressions surface in
the same scoreboard, reversed. Meaningful forward comparison needs ~30+ days of shadow
data — harness-first sequencing absorbs that wait.

**P2. SignalContext refactor + robust percentile extremes (§15.1).** Replace raw
`Math.min/max` window extremes with winsorized percentiles (the file's `quantile()`
already powers volatility); keep raw extremes as displayed secondary facts; recalibrate
preset cutoffs on the harness so board coverage stays comparable; update reason strings
and the affected test suites. Fix the detail-panel liquidity gap.

**P3. Regime classification + full regime labels (§15.2).** Classify Falling /
Improving / Breakout / Overextended (+ Spike/low-confidence) from momentum, robust
trend slope, drawdown, and demand trend (needs a `sales30Prior` column on
`market_metrics`, written when history runs carry buckets). Two shipping tracks:
descriptive labels (boards + detail chips + board filters) ship on gate + staging
review; regime-driven qualification changes (Breakout suppresses/downgrades Hot Sell,
mirroring `awaiting-stabilization`) are harness-gated. URL codec gains the regime
filter; keep exclusion evidence user-visible.

**P4. Cohort-relative gate + index/breadth context (§15.3, §15.5) — gated, not weighted.**
Calculations (decided 2026-09-01):

- *Cohort center (display/anchoring only — 0% of score):* `median(member market
  prices)` with the 25th–75th band; membership ladder when a cohort has <8 members:
  game|set|pull-tier → game|set|rarity → game|rarity|era → game|rarity. Median, not
  mean — the Overnumbered tail (mean $125 vs median $97.61) is the proof case.
- *Cohort return index (the signal input):* median of member **log returns**, not the
  return of a mean price — `cohort 30d return = median over members(ln P(d) − ln
  P(d−30))` — so one chase card's spike cannot move the cohort and membership churn
  creates no phantom moves. The existing mean-based `dailyPeerAverages`
  (`core/peer-history.ts`) stays for the display it feeds; the signal path gets a
  median-based sibling. Fully backtestable (derivable retroactively from
  `price_observations`).
- *Relative term:* `relative 30d = ln(P_card(d)/P_card(d−30)) − cohort 30d median log
  return`. Consumed as a **confidence dampener**: relative ≈ 0 means the move is
  cohort-wide → drop confidence one tier with a visible reason ("moved with its
  cohort: −11% vs cohort −9%"); a strongly card-specific move leaves confidence
  untouched. Sealed cohorts (absent from the peer system) use a same-run product-type
  median within set.
- *Index/breadth:* set breadth (% of members with positive 30-day return, computable
  today from `market_metrics`) serves as the Breakout qualifier in P3; set/game index
  returns stay descriptive context. No ±15%/±10% weighted terms (v3 contingency only).

**P5. Sales-aware refinements (§15.4) — middle version.** Binary liquidity floor stays
as the eligibility gate; **one bump, not a curve**: ≥20 sales/30D lifts confidence one
tier (a continuous curve has no historical data to fit). Persist realized-sale
median/percentile columns on `market_metrics` for sell-side reference display;
demand-trend acceleration (needs `sales30Prior`) as regime evidence in P3. Forward
shadow-validation only (see P1 limit).

Deferred (unchanged from research §15.7): character priors, Early Value Estimate,
pull-difficulty score adjustments, execution-aware net returns.

## Decisions — resolved at review (2026-08-27)

1. **B2**: Direct low **removed everywhere** (hero + printings table; field stays in data).
2. **B3**: Keep/cut/merge table **approved as proposed** (Streak cut included).
3. **B4**: Details section becomes a **collapsible expander, closed by default**.
4. **B7**: Strictness control **moves into the ⚙ settings menu** as a device preference
   (localStorage `raw-signal-strictness`, default Balanced), removed from the toolbars and
   the detail signals panel. Strictness leaves the URL: the preference always wins on load;
   the parser still tolerates the old `strictness=` param on shared links.
5. **C1**: 30-day moving-average overlay **on the detail-page large chart only**.
6. **E1**: Masthead **shrunk, not deleted** — kicker + much smaller headline stay, the dek
   sentence goes.
7. **E2**: Topbar primary links: **Pokémon · Riftbound · Sealed** (no signal-view links).
8. **A1**: **Two** size steps (Default / Large), root-driven rem scale.
9. **G1**: Cloudflare Gate 0 **after the UI phases**; plain Cron + checkpointed jobs over
   paid Workflows when it starts.
10. **Sequencing**: phase order approved; **Phase 1 started 2026-08-27**.

## Sequencing (approved)

- **Phase 1 — LANDED 2026-08-27 (gate green: 113/113 node, lint, 4/4 Playwright):**
  B1, B2, B5, B7 (settings-menu variant), B4, C2, D1, E1 (shrink), E3, E4, E5 + A2
  (`docs/design-baseline.md`). Implementation notes: button hover lifts were flattened along
  with tiles (theme/settings/back/pagination/filter controls); strictness left the URL
  entirely — the localStorage preference always wins on load and old `strictness=` links
  parse harmlessly; the standalone "Data notes" provenance block folded into the collapsible
  details section; chart markers/tooltip render as percentage-positioned HTML because the
  stretched SVG distorts viewBox circles.
- **Phase 2 — LANDED 2026-08-27 (gate green: 114/114 node, lint, 4/4 Playwright):**
  A1 (type scale), C1 (incl. detail-only MA overlay), B3, B6, D2, E2. Implementation notes:
  the ramp is six rem tokens in `app/styles/tokens.css` (10.5–15px floor-raised bands; ≥15px
  sizes converted to same-size rem) with `html[data-font-size="large"]{font-size:108%}`
  scaling everything — the old per-selector override block is deleted and detail pages now
  respect the setting; charts carry `chart-up/chart-down` trend coloring, gray hollow
  min/max markers, and a dashed trailing-30-day MA on the detail chart only; toned metric
  tiles get a `:has()` background wash; the history grid is the approved 7 tiles and Streak
  is gone; singles detail pages render `RelatedSealedSection` from a new
  `CardDetail.relatedSealed`; hover previews open after a 150ms dwell and can be disabled
  in settings (`raw-signal-hover-previews`, default on, `app/state/hover-previews.ts`);
  both pages share `app/TopBar.tsx` (brand, Pokémon/Riftbound/Sealed deep links with
  active state, settings menu, theme) and the old Rankings/Method anchors are gone.
  Follow-ups from user review (same day): full-view 7/30/90 tiles get the same tone wash
  as other views; the large-view hover preview pins to both edges of its card (the
  `<details>` shell now flexes so the tile fills the grid track — which also equalizes
  card heights per row — and the popup's seam-side border is zero-width, not transparent,
  killing the 1px miter notch); the masthead is centered with "without the noise." in the
  site blue.
- **Phase 3:** D3, F1 (measure first, then 1+2). **LANDED 2026-08-27.** D3: shared
  `app/InfoHint.tsx` toggletip (edge-aware alignment via `app/hooks/info-hint.ts`);
  explanatory metric hints (volatility, momentum, trend, range position, sales/week,
  realized range), the fair-value blend formula, the graded smart-market explainer, and
  the pull-rate caveat now ride ⓘ hints while data hints stay visible. F1(1): a popover
  dwell calls `warmDetailPage` (`app/leaderboard/detail-prefetch.ts`) — one idle-time
  fetch per href warms the cold-isolate repository build; `/api/history` was already
  browser-cached by the row batch. F1(2): shimmer skeletons (`.detail-skeleton`) hold the
  fair-value panel, history metric grid, and signal cards while `/api/history` resolves.
  Measurement: RSC pages can't set headers, so `loadCatalogDetail` records
  Server-Timing-formatted repo/detail/source timings surfaced as `data-server-timing` on
  the detail page root (curl the HTML on Sites to read real cold-start numbers). F1(3)
  (per-product summary chunks) stays parked until those numbers justify it; F1(4) is G1.
- **Phase 4:** G1 (after the UI phases, gated on Gate 0 authorization).
- Each phase ends with the full gate (`npm run check`, dev server stopped first) and, on
  request, a Worker deploy (vN tarball handoffs retired 2026-08-27 with the hosting move).
