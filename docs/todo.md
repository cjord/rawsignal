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
([catalog-repository.ts](../app/data/catalog-repository.ts) peer-context labels), never the
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
1. [types.ts](../app/domain/types.ts): add `relatedSealed: SealedProduct[]` to `CardDetail`.
2. [catalog-repository.ts](../app/data/catalog-repository.ts) singles branch: 
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
tighter cutoff (base 1.5% vs 2.25%, min score 72 vs 58 — [signal-utils.ts](../app/signal-utils.ts))
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
sentence-case "rankings"). [formatters.ts](../app/domain/formatters.ts) `formatRarity` is an
identity function; game display names exist only as a local map in `page.tsx`.

**Implementation plan.**
1. Add `formatGameName(game)` to `app/domain/formatters.ts` ("pokemon" → "Pokémon",
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
5. **Cutover**: production route/domain decision — keep OpenAI Sites as the frontend with
   Cloudflare serving `/api/*`, or move hosting entirely to the Worker (it already serves
   the app). Recommend full move only after 3–4 run clean for a week; Sites tarball remains
   the rollback.
6. **Decommission the manual loop**: the v-N tarball packaging cadence drops to
   frontend-only changes; feeds stay as the emergency fallback path.

**Effort/risk.** Large; spans sessions; every mutation step gated on you. Nothing here
starts without the Gate 0 items.

---

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
- **Phase 3:** D3, F1 (measure first, then 1+2).
- **Phase 4:** G1 (after the UI phases, gated on Gate 0 authorization).
- Each phase ends with the full gate (`npm run check`, dev server stopped first) and a
  packaged vN handoff if you want it deployed.
