# Product Audit — 2026-08-28

Scope: data-quality and data-opportunity analysis (metrics and Hot Buys/Hot Sells emphasized),
new sealed↔singles relationships, user research into what TCG market-tool users want, and a
two-pass UI/UX review of the live production build at rawsignal.cards (pass 1: ruthless
conversion-focused designer; pass 2: first-time user click-through). Method: production D1
queries, signal/model code review, live-site DOM/style/flow inspection at desktop and 375px,
and a web-research sweep of competitor tools and their user reviews (Collectr, Card Ladder,
PokeData, Market Movers, TCGfish, GemRate, TCGIndex, PriceCharting, pullrates.gg).

Key production numbers behind the findings: 14,088 singles / 2,746 sealed tracked; signals —
buy 3,269/4,745/6,969 vs sell 7,757/9,364/11,197 (conservative/balanced/aggressive); graded
prices cover 47 products (0.3% of singles); sealed MSRP present on 166 of 2,746 (6%); pull
rates are per-tier defaults with one set override; market_metrics carry 30D change for
15,611 rows.

---

## CRITICAL

### C1. The site understates its own freshness — "updated Aug 26" on live Aug-28 data  `[Data · Trust]`
The leaderboard header dates come from `catalog-manifest.json`, a **static bundled asset**
frozen at build time, while the rows themselves stream live from D1 (`X-Raw-Signal-Source:
database`). A market-data product whose masthead says its data is two days old loses the
trust argument before a visitor reads one price — and user research shows unexplained or
stale pricing is the #1 driver of distrust in competing tools. **Fix:** serve the manifest
(or at least its dates) through the Worker from the published ingestion run's
`source_updated_at`, falling through to the bundled file only in feed-only deployments.

### C2. Hot Buys ranks falling knives first  `[Data · Signals]`
The signal model is pure proximity-to-extreme: near a 30/90-day low ⇒ buy. The live Hot Buys
top three are down −24.5%, −23.3%, −24.5% over 30D **and still falling 7D** (−0.8%, −11.9%,
−13.8%), scored 94–96 of 100. "This card keeps getting cheaper" is not a buy thesis, and a
first-time user who buys the #1 "Hot Buy" and watches it drop another 12% never returns.
The model also produces 331 simultaneous "hot" buys and a 2:1 sell flood (9,364 balanced
sells vs 4,745 buys — a third of the catalog flagged "sell" in a rising market), which reads
as noise, not signal. **Fix, in order of leverage:** (1) gate buys on stabilization — e.g.
7D change ≥ 0 or price ≥ its 7D low for N days; (2) blend in the fair-value model that
already exists on detail pages (discount-to-fair-value is a real "underpriced" measure;
proximity-to-low is not); (3) curate the page to a ranked top 20–30 instead of 331; (4)
percentile-cap or trend-gate sells the same way.

### C3. Signals have no public track record  `[Data · Trust · Research]`
Research is unambiguous: signals without an audited hit rate read as noise, and the one
competitor doing "every call published, wins and losses" treats it as their core moat. Raw
Signal already stores signal rows daily — persisting fired-signal snapshots and showing
"signals fired 30 days ago are up X% on average, N wins / M losses" turns Hot Buys from a
widget into a trust engine. Without it, C2's rework can't prove itself either.

### C4. Mobile shows zero market data above the fold  `[UX · Conversion]`
At 375×812 the first leaderboard row starts at 964px — masthead, mode toggles, filter
stack, and stat tiles fill the entire first screen. A phone visitor (most casual TCG
traffic) must scroll past chrome before seeing a single price. **Fix:** collapse filters
behind one row on mobile, shrink the masthead/stat tiles, and get rows 1–3 visible on load.

### C5. The sealed flagship view runs on 6% data coverage  `[Data]`
Sealed's default sort is profit-vs-MSRP, but only 166 of 2,746 sealed products have an MSRP
(the source is Pokémon-focused; the new Riftbound imports and most Pokémon products carry
none). The headline experience silently operates on a sliver of the catalog, and the other
2,580 products sink regardless of how interesting their market action is. **Fix:** expand
MSRP sourcing where practical (Riftbound/One Piece publishers post MSRPs; the curated feed
already proves the pattern), and make the default sort market-action-based (30D momentum or
tracked value) with profit-vs-MSRP as an opt-in lens that filters to covered products.

---

## HIGH IMPACT

### H1. Closed-loop sealed EV — the differentiator nobody else can ship  `[Data · Sealed↔Singles]`
Raw Signal uniquely holds all three inputs for the same sets: sealed prices, singles prices,
and pull-rate estimates. Compute **expected value of opening a booster pack/box (pull rates ×
current singles prices) vs. the box's market price**, per set, tracked daily. Today users
stitch this together across pullrates.gg and separate price sites. Show it on set rows, the
sealed table ("EV ratio 0.62 — buying singles beats ripping"), and detail pages of sealed
products. Label as community-estimate-derived, as the pull-rate data rules already require.

### H2. Sealed↔singles divergence per set  `[Data · Sealed↔Singles]`
Both momenta already exist (set 30D singles median; sealed product 30D). A per-set spread —
"sealed +9% while singles +2% (sealed running hot)" — flags rotation between the two markets
before either leaderboard shows it. Natural home: a column on the metrics set leaderboard and
a strip on set-filtered views. A companion stat, chase concentration ("top 3 cards = 61% of
set value"), tells buyers whether a set's value is stable or hostage to two cards.

### H3. Liquidity/volume context on every price  `[Data · Trust]`
Detail pages already fetch TCGplayer completed-sale buckets, but leaderboards and heroes show
prices with no liquidity context. Research complaint #2/#5: users distrust prices moved by
2 thin sales. Surface "N sales / 30D" beside detail-page prices and a low-liquidity badge in
leaderboards (client already knows volume on hover-prefetched details). Where volume is
unavailable, say so — the site's null-honesty rule extended to liquidity.

### H4. Graded ROI where graded data exists — and aim the rotation better  `[Data]`
47 covered products is decorative. Two moves: (1) on those 47 detail pages, show the actual
decision number — raw→PSA10 spread minus grading fees ("grade candidate: +$210 net") — the
research shows grading ROI is a top-3 data demand; (2) point the 100-credit/day rotation at
the highest-value/most-viewed cards so coverage compounds where it matters. Long-term,
pop-report data is the adjacent moat (paywalled by competitors, loudly demanded).

### H5. Metrics sealed mode opens on four empty charts  `[UX · Metrics]`
On production, all four sealed index cards currently show "history accumulating" (sealed
history observations sit below coverage floors, so lines start today). Honest, but sealed
mode's first screen is a wall of empty cards. **Fix:** while a series has <2 points, render
the card compact (value + change tiles + one-line note) instead of chart-height, and lead
the section with the populated overview/movers instead. The cards grow back to full height
as real days accumulate.

### H6. Watchlist without accounts  `[UX · Research]`
Portfolio tracking and alerts are the two most-demanded features in every competing tool and
the standard paid upsell. A zero-backend first step: a localStorage watchlist (star any card
or sealed product; a "Watchlist" chip filters any view to starred items; detail pages show
"you're watching this"). It creates the daily-return habit that alerts later monetize, and it
needs no auth infrastructure.

### H7. Designer pass — density without hierarchy  `[Design]`
The most common text style on the leaderboard is **10.5px** (227 elements in one viewport,
more than any other size), across eight font-size/weight combinations in the first screen.
Linear/Vercel-class products hold 3–4 active text styles per view and rarely go below 12px
for anything a user must read. The row data itself is excellent; it's wrapped in micro-labels
competing at the same visual volume. **Fix:** raise the floor (10.5px → 11.5–12px for
anything informational, keep 10.5px only for true chrome), cut the fold to ~4 styles, and
let the market price and name own each row visually (they nearly do — finish the job).

### H8. First-user pass — the row numbers don't introduce themselves  `[UX]`
A first-time user reading `$1,473 | Mid $1,600 | $1,451 | $1,511 | +1.7% | −2.3%` can hold
onto "market" and "mid," then loses the thread: which figures are listing low/high, and which
percent is 7D vs 30D? Column headers exist but scroll away, and medium view labels only
"Mid." Persistent sticky headers (or in-cell micro-labels in medium view), plus one ⓘ on the
signal chip ("96 signal · high confidence" is opaque until the detail page), close the gap.
Also: strictness now lives in ⚙ settings — Hot Buys/Sells give no hint that a control exists
that changes their contents; one line under the tab ("Balanced strictness · change in ⚙")
would do it.

### H9. Riftbound-first positioning  `[Research · Strategy]`
Research found Riftbound tooling is shallow price lists; nobody owns Riftbound analytics.
Raw Signal already has indexes, movers, signals, peer context, and (as of today) the full
upstream sealed catalog. Lean in: a dedicated Riftbound landing angle (the Riftbound-50
index as the reference number people cite) is a defensible niche while the Pokémon tool
market stays crowded.

---

## NICE TO HAVE

- **N1. Set-page rollup** `[UX]` — set-filtered leaderboards could open with the set's
  metrics row (tracked value, median, momentum, sealed EV once H1 lands) as a header strip.
- **N2. Movers → metrics deep links** `[UX]` — metrics movers already link to detail pages;
  leaderboard rows could reciprocally badge "top 7D mover."
- **N3. Median series are stored but unused** `[Data]` — `median:*` rolls up daily and never
  renders; either chart it as a toggle on index cards ("index vs median") or stop paying to
  compute it.
- **N4. Pull-rate set overrides** `[Data]` — one override exists (Prismatic Evolutions);
  each modern set added materially improves H1's EV quality. Community pack-study sources
  are known and citable.
- **N5. Sealed "Cases" arithmetic** `[Data]` — a case is ~6 displays; showing per-display
  implied price on case rows (and the premium/discount vs buying displays) is a cheap,
  clever stat for the scalper audience.
- **N6. Compare tray** `[UX]` — pin 2–3 cards into a compare view (price, momentum, peer
  rank side by side); frequent request pattern in competitor reviews.
- **N7. Export** `[UX]` — CSV of any filtered view; low effort, loved by spreadsheet-native
  collectors, and a natural future Pro feature.
- **N8. OG/share cards** `[Growth]` — detail pages render rich data; an OG image with the
  card art + price + 30D change makes every shared link an advertisement.
- **N9. Keyboard navigation** `[Design]` — arrow through rows, Enter to open detail; the
  Linear-class touch the persona demands, cheap on the existing grid markup.
- **N10. Japanese/international sets** `[Data · Big]` — top coverage complaint about
  competitors; a large ingestion project, recorded here as a horizon item, not a next step.
- **N11. Reprint-risk notes** `[Data]` — editorially maintained flags on sets with announced
  or likely reprints; widely discussed in sealed-investing content, surfaced by no mainstream
  tool.

---

## Appendix — pass narratives (what was actually reviewed)

**Pass 1, designer:** desktop home (singles leaderboard), Hot Buys, sealed table, card
detail, metrics; type-scale census via computed styles; control inventory; fold content at
1280×720. Verdict in one line: *the data model is stronger than the presentation — the page
whispers its best numbers and shouts its labels.* Strongest asset: the detail page's fair
value → peer rank → momentum-compare stack, which out-explains every competitor reviewed.
Weakest: 10.5px-dominated density (H7), stale freshness label (C1), buried methodology
prose (excellent trust content, invisible at the bottom of the page — deserves a compact
"How prices work" link in the masthead).

**Pass 2, first-time user:** landed on desktop home — headline understood, table read
mostly (H8's unlabeled figures), clicked Hot Buys expecting opportunities and got 331
falling cards (C2 — this is where I'd leave), opened Munkidori's detail and *everything
clicked* (fair value, discount %, peer rank — best moment of the session), tried sealed
(profit table impressive until sorting revealed most rows have no MSRP — C5), visited
metrics (singles indexes great; sealed mode = empty charts, H5), retried on phone width
(scrolled a full screen before any data — C4). Would I return? Only for the detail pages
and movers — which is exactly what the critical fixes address.

---
---

# Addendum — second pass (2026-08-28): competitor deep-dives, expansion research, implementation plan

## Competitor deep-dive 1: HyperPotion (hyperpotion.io)

Pokémon-only, small modeled universe (~2,600 cards), heavily productized around one idea.

**Top data qualities**
- **Fair value is the entire spine.** Every module is the same model re-cut: mispriced
  boards, grading signals, sealed EV, an "Investment Grade" letter (S+ to F for demand
  durability), and four present-tense card scores (Opportunity / Overheat / Risk /
  Momentum). One model, six products.
- **Graded at parity with raw.** PSA 10 vs raw shown as a multiple ("7.3×"), a Grading
  Edge board ("where slabbing earns its fee" — net of fee and wait), and a raw-$/day vs
  PSA10-$/day traded split. This is what real graded integration looks like vs. our 47
  covered cards.
- **Demand Archive** — which singles actually *trade*, month by month. Volume as a
  first-class dataset, not a detail-page footnote.
- **Persistence framing**: standouts say "based out 7 weeks" — how long the discount has
  held. A duration dimension our signals lack entirely.
- Honest anti-forecast language throughout ("descriptive — not a forecast") — same
  null-honesty philosophy as ours, used as a trust asset.

**Top UX qualities**
- Search-first hero: "What's your card really worth?" + ⌘K + "Try Umbreon ex" + "free to
  check, no account." Value in one action, zero friction.
- **Curation-first landing**: three ranked Standouts with plain-English reason strings
  ("Trades 22% below fair · based out 7 weeks · demand building") — precisely the
  curation our 331-row Hot Buys lacks.
- Conversion architecture: tease (293 cards below fair) → paywalled boards → 3-day trial
  CTA with "cancel anytime" reassurance, repeated at every scroll depth.
- Humanized numbers: market index benchmarked vs the S&P 500; "$95,264 raw traded/day."

**Their weak spots:** tiny catalog (~2,600 cards vs our 14k+), Pokémon-only, sealed
basket showed "—" (module promised, data thin), everything interesting is behind the
trial, no Riftbound, no listing-level transparency.

## Competitor deep-dive 2: PokeViews (pokeviews.com)

The "index library" competitor — closest in spirit to our metrics page.

**Top data qualities**
- **An index for everything**: PV250 flagship, Top 100, Sealed Index, Graded Index,
  Hot & Cold, Momentum, New Highs & Lows, Trend Extension, Set Performance, **Series/Era
  Performance**, Rarity Value, Grading Opportunity — a full analytical library where we
  have four indexes.
- **Japanese Promos as a first-class nav tab** — validates our expansion priority.
- **Vintage depth**: their Top-250 leaderboard is Gold Stars, 1st Editions, Skyridge,
  Neo — the high-end vintage segment, covered wall-to-wall with daily moves.
- "Pokémon vs. Assets" benchmark (PV250 vs S&P 500) and a Portfolio Lab.

**Top UX qualities**
- Audience-shaped nav: Top / Hot / New / Graded / Sealed / Illustration Rares / Japanese
  Promos — six user intents, one click each.
- Data-first landing: a ranked top-cards leaderboard renders immediately, no chrome wall.
- Relatable benchmark framing throughout.

**Their weak spots:** landing tickers rendered as 0.00/0% placeholders during load
(hydration lag reads as broken), no per-card fair value or peer context, no listing-level
detail, no Riftbound, unclear methodology/provenance vs our documented pipeline.

## Scorecard

**What Raw Signal already does better than both:**
1. Breadth + freshness: 14k+ singles and 2.7k sealed on a daily self-running pipeline;
   both competitors model a fraction of this.
2. Riftbound — neither touches it; our earlier research found no serious incumbent.
3. Everything free and account-less; HyperPotion paywalls every board.
4. Per-card explanation stack (fair value + peer rank/percentile + momentum compare +
   pull rate + listing low/median) — neither shows listing-level or peer context.
5. Sealed catalog with MSRP/profit framing and a scalper view; documented methodology.

**What they do better — adopt list (all folded into the plan below):**
1. Curation-first landing with reason strings (HyperPotion) → C2's rework target.
2. Fair value as the product spine, not a detail-page widget (HyperPotion).
3. Graded at parity + grading-edge board (HyperPotion) → needs H4 + R3 coverage first.
4. Sealed EV shipped as a headline module (HyperPotion) → our H1, validated.
5. Volume/demand as a dataset (HyperPotion's Demand Archive) → our H3, extended.
6. Index library breadth incl. era/series performance (PokeViews) → R2.
7. Japanese promos as a market (PokeViews) → R1.
8. Signal persistence/duration ("based out 7 weeks") — cheap, high-trust addition to
   movers and signal chips.
9. Benchmark framing (both: "vs S&P 500") — one derived series, instant relatability.

## Expansion research

### R1. Foreign-language markets  `[verified against TCGCSV + web research]`
- **Japanese Pokémon is nearly free**: TCGplayer added a "Pokemon Japan" category
  (TCGCSV **category 85**) — **456 groups**, ~25–30k products, real market prices, all
  reachable by the exact pipeline we already run. Verified sample: SV-P Promotional
  Cards — 226 products, 112 with live market prices, topped by Victini 288/SV-P at
  ~$487. **JP promo groups exist for every era** (SV-P, S-P, SM-P, XY-P, BW-P, DP-P,
  25th Anniversary, CD Promos…), which makes "foreign promos first" a clean, bounded
  slice (~22 groups) before any full-JP commitment. Caveat: thinner marketplace depth —
  liquidity flags (H3) matter more here.
- **Korean/Chinese Pokémon are NOT on TCGplayer** — priced in the wild via eBay solds
  and PriceCharting's dedicated JP/CN promo categories. No structured source; treat as
  out of scope until graded/source work (R3) lands PriceCharting access.
- **Riftbound Chinese**: category 89 is English-only (no Origins CN groups). The CN
  source of truth is jihuanshe/集换社 (app, Chinese phone number required, no API);
  an English-facing comparison site (Bilgewater Market) exists but blocks bots and its
  sourcing is unverified. **Realistic play:** track CN-language *products that do reach
  TCGplayer* (already in our sealed catalog: T1 Worlds Chinese/Korean bundles, Lunar
  Revel, Secret Garden) and revisit CN singles if a structured source appears.

### R2. Pokémon metrics by era  `[design-ready]`
Our catalog spans 1999–2026 across ~180 Pokémon sets including a 5,100-card vintage
section, so era grouping is derivable today from set prefix + year (prefix wins:
Base/Neo/e-Card ⇒ WotC · "EX " ⇒ EX · DP/HGSS ⇒ DP · BW · XY · SM · SWSH · SV · ME;
year breaks ties for promos/misc). PokeViews ships Era Performance as a headline module —
validated demand. Design: an `era` derived field in the domain layer; metrics gains an
**Era performance section** (per-era tracked value, 30D momentum from member metrics,
advancers/decliners) and the set leaderboard gains an era filter chip; era becomes a
leaderboard filter too (one URL param). Optional later: 3 era index series
(vintage / mid / modern) rather than 9 — keeps rollup cost sane.

### R3. Graded data sources  `[web research, ranked]`
- **PriceCharting Legendary ($49/mo)** — the only turnkey graded API: daily Ungraded /
  7 / 8 / 9 / 9.5 / PSA 10 / BGS 10 / CGC 10 across full Pokémon EN+JP+promos *and
  Riftbound already*. One blocker: ToS requires written permission for public display —
  email first; many small trackers run on it with attribution.
- **PokemonPriceTracker tier upgrade (~$9.99/mo API)** — cheapest incremental: lifts the
  100-credit/day ceiling on the integration we already have, adds per-grade history +
  pop data. Best first move.
- **GemRate partner API** — pop reports only (scarcity context, no prices); contact-based.
  Later complement. eBay Marketplace Insights is effectively closed; PSA's public API is
  cert-lookup only (100/day); Card Ladder / Alt have no self-serve APIs.
- **Coverage target**: grading premium only matters above ~$20 raw — the top 500–1,000
  cards by value. Current coverage (47) is ~5% of what matters; the rotation should walk
  the top-value list, not a fixed 44.

### R4. Card-show buy list (mobile)  `[design]`
A mobile-first `/buylist` page that turns research into an in-the-aisles tool:
- Compact rows: thumbnail, name/set/number, **market price + fair-value delta**, and a
  tap-to-check "acquired" state with an optional paid-price input.
- Running totals: list market value vs. what you've paid — the show scoreboard.
- Sources: everything favorited (R5), plus one-tap "add current Hot Buys top 20."
- Offline-tolerant: payload cached in localStorage with an explicit "prices as of <date>"
  stamp (shows have no signal); refresh on reconnect.
- Sort by set (matches how show binders are organized) or by price; share/export as text.
Overlap with Hot Buys is intentional: Hot Buys is *what to look for*, the buy list is
*what you're looking for today* — same rows, different job.

### R5. Favorites  `[design]`
- **Phase 1 — no login**: star any card/sealed product (localStorage, same pattern as
  existing device preferences). A "Favorites" chip filters every leaderboard; detail
  pages show starred state; metrics shows a "your favorites" strip (count, combined
  value, top mover). Feeds R4 directly. Ships in days, zero backend.
- **Phase 2 — login, when sync matters**: lightest fit on this stack is **magic-link
  email auth on the Worker** (one D1 `users`/`favorites` table pair, signed session
  cookie, an email API like Resend; ~150 LOC). Passkeys are the alternative (no email
  vendor, but device-loss recovery UX is worse for this audience). OAuth adds vendor
  weight without solving anything extra at this scale. On first login, merge the
  localStorage list up. Login also unlocks alerts + portfolio later — the two features
  research says people pay for.

---

## Implementation plan (proposed — for review)

Ordering principle: trust repairs first (cheap, they gate everything else), then the
habit loop (favorites → buy list), then the data moats (EV, era, JP, graded), then
accounts. Each phase is independently shippable; decision points are flagged ⚑.

**Phase A — Trust & conversion repairs** *(small; mostly existing surfaces)*
1. C1: manifest freshness served from the live run (Worker intercepts manifest paths).
2. C2: Hot Buys rework — stabilization gate + fair-value blend, ranked top 20–30 with
   reason strings ("12% below fair · held 3 weeks · 7D stabilized"), sells trend-gated
   the same way. ⚑ exact gate thresholds reviewed at build.
3. C3 foundation: persist daily signal snapshots (new table, cron-written) so a track
   record can accumulate from day one — the scoreboard UI can follow later.
4. C4: mobile fold — collapse filter stack, compact masthead, rows visible on load.
5. H7/H8: type-floor pass + sticky/labeled columns + signal-chip ⓘ + strictness hint.
6. Cheap adopts: signal persistence duration (8), "vs S&P" line on metrics (9). ⚑ S&P
   comparison needs a benchmark series source — static monthly values are enough.

**Phase B — Favorites + Buy List** *(small-medium; no backend)*
1. R5 phase 1 favorites (star + filter chips + metrics strip).
2. R4 `/buylist` page with acquired-state, paid-price, totals, offline stamp.
3. Hot Buys → "add to buy list" action (the C2 rework's output becomes shoppable).

**Phase C — Sealed EV + sealed↔singles** *(medium; the moat)*
1. H1 pack/box EV: pull rates × singles prices per set vs. box price; EV ratio on sealed
   rows, set leaderboard, and sealed detail pages; clearly labeled estimates.
2. H2 divergence: sealed-vs-singles 30D spread per set on metrics.
3. C5: MSRP expansion (Riftbound/One Piece publisher MSRPs; default sort switches to
   market action). N5 case-math while in the tables.
4. N4: 2–3 more pull-rate set overrides to sharpen EV where it matters most.

**Phase D — Era & metrics enrichment** *(small-medium)*
1. R2 era module: domain mapping + metrics era-performance section + era filter on
   leaderboard and set table.
2. H5: compact accumulating-index cards.
3. H3: liquidity badges on detail pages (volume already fetched) + low-liquidity flag
   in leaderboards where volume is known.
4. N3 decision: chart medians as an index-card toggle, or drop the series. ⚑

**Phase E — Japanese Pokémon** *(medium; bounded first slice)*
1. JP promos first: ingest category 85's ~22 promo groups as a new "Japanese Promos"
   section (PokeViews-validated demand, matches the stated promo priority). ⚑ section
   naming/placement in nav.
2. Liquidity flags mandatory here (thin JP marketplace depth).
3. Full JP sets as a follow-on decision once promos prove out. ⚑ scale: +25–30k products
   roughly doubles the catalog and daily ingestion time.

**Phase F — Graded expansion** *(medium; spend decision)*
1. ⚑ Source decision: PokemonPriceTracker paid tier now (~$10/mo, drop-in) vs.
   PriceCharting Legendary ($49/mo, email licensing first, adds JP+Riftbound graded).
2. Retarget the rotation to walk the top-value list (top 500–1,000) instead of a fixed
   set; show grading-ROI (spread minus fees) on covered detail pages; "Grading Edge"
   board once coverage crosses ~300 cards.
3. GemRate pop-report inquiry in parallel (scarcity context).

**Phase G — Accounts, sync, alerts** *(later; first monetizable surface)*
1. R5 phase 2 magic-link auth + favorites sync.
2. Price alerts on favorites (email digest first — avoids alert fatigue, research-backed).
3. Portfolio (quantity + cost basis on favorites) — the #1 demanded feature overall,
   deliberately last because it depends on everything above being trustworthy.

**Phase H — Box & Case EV calculator** *(added 2026-08-28, user; mockup provided)*
An interactive full-EV calculator, distinct from the set-level chase EV shipped in
Phase C: every rarity counts, not just chase tiers.
1. **Math**: EV per pack = Σ over rarities (expected copies per pack × average market of
   that rarity's cards in the set). Slot rarities (commons ~7×/pack, uncommons ~3×,
   rares) use per-pack slot counts; hit rarities use 1 ÷ packs-per-hit — the existing
   pull-rate config extends with a per-game **pack-structure table** (slots per rarity,
   per-set overrides), replicable for Pokémon and Riftbound alike. EV per box = packs ×
   EV per pack; case = units × box.
2. **Controls** (per the mockup): market selector (Pokémon/Riftbound), set dropdown,
   unit selector (single pack / box / case), editable packs-per-box (defaulted by
   product type), box-price input prefilled from the live market price, and an
   **ignore-bulk toggle** that zero-counts cards under ~$1 so the EV reflects only
   money-relevant pulls.
3. **Breakdown UI** (mockup-inspired): headline EV for the selected unit with per-pack
   subline; a "where the value sits" per-rarity bar list — average card value, copies
   per pack (or 1-in-N odds), priced coverage ("77/88 priced"), top card value, CHASE
   badges; a "chase prints are X% of EV" stat; footnote stating the honesty mechanics.
4. **Honesty mechanics** (adopted from the mockup's footnote): unpriced cards count as
   zero — genuine bulk is honestly near-zero, but low coverage means a pool
   *understates* its contribution, never overstates; show an implied-pack-size check
   (Σ expected copies) so a mistuned structure is self-evident; everything labeled as
   community-estimate-derived per the pull-rate data rules.
5. **Data prerequisite** (the real work): commons/uncommons/plain rares are currently
   rejected at ingestion ("unsupported-rarity" — 14,657 rejections/day), so full-EV
   needs either (a) extending singles ingestion with a bulk-rarity tier for calculator
   sets (larger catalog, one new section per game), or (b) launching with tracked tiers
   plus zero-counted bulk and honest coverage labels, adding (a) later. Decide at build.
6. Placement: its own page (e.g. `/ev`) linked from sealed detail pages and the metrics
   set leaderboard's Pack EV column.

Not scheduled (horizon): N10 full international sets beyond JP, CN Riftbound singles
(no structured source), pop-report integration depth, N6–N9 polish items slot into
whichever phase touches their surface.

**Walkthrough decisions (2026-08-28, user):** phase order approved, Phase A started
immediately. Graded spend **held** — instead, detail pages gain PriceCharting outbound
links beside the TCGplayer buttons (free graded-price path; folded into Phase A).
Medians ship as the index-card toggle in Phase D. Japanese-promo placement decided at
build time in Phase E.

**Phase A landed (2026-08-28, staging-verified, awaiting production push):**
C1 — Worker serves `/data/freshness.json` from the published run; the page's updated
date hydrates live with the baked date as fallback (staging now shows Aug 27, not the
baked Aug 26). C2 — stabilization gate in `evaluateMarketSignal` (buys need ≥0.5% bounce
off the window low AND 7D change > −5%; new exclusion `awaiting-stabilization`; sells
untouched) plus `HOT_BOARD_LIMIT=25` curation in `querySinglesCatalog` (score-ranked
board, user sorts rearrange those 25; staging shows "25 Matches" vs 331). Persisted
production signals recompute on the next daily run — boards are capped immediately,
gated after tonight. C3 — migration `0005_signal_history` + daily snapshot writer in
the metrics rollup (top 100 per side, balanced, with that day's price; staging wrote
200 rows). C4 — mobile fold compression (masthead compact, kicker hidden, duplicate
ranked-count tile dropped ≤620px). H7 — row informational text floored at `--text-xs`.
H8 — hot-board aside states "Top N by signal score · <strictness> strictness (change
in ⚙)" with a how-signals-work ⓘ. PriceCharting search links beside the TCGplayer
button on all detail pages (muted secondary style). Deferred: the "vs S&P 500" line —
needs a real benchmark data source (2026 index values unavailable offline; a free feed
like stooq can be wired when wanted). Fix en route: `/data/*` fall-through now guards a
missing ASSETS binding (dev-workerd 500 that blocked Playwright), and missing-table
noise is silenced in dev. Gate: 143/143 node, lint, 4/4 Playwright. Committed `9f200ac`
(GitHub only by user decision — production deploy + migration 0005 deliberately held; the
staging sandbox carries the build).

**Phase B landed (2026-08-28, dev-verified):** device-local favorites
(`app/state/favorites.ts` pure store + `useFavorites` tab-synced hook, tolerant parsing
tested) with stars on detail pages (next to the TCGplayer button), a ★ Favorites filter
toggle beside the signal tabs (singles), and "☆ Top 10 → Buy List" on hot boards. The
`/buylist` page (TopBar link added): checkable card-show list with per-item captured
prices ("as of" stamped), paid-price inputs, and a scoreboard (acquired count, list
market value, acquired-at-market vs actually-paid with over/under delta) — verified end
to end on dev (star → list → acquire → "$83.70 under market"). Scope note: row-level
stars on leaderboard rows wait for a styling pass with visual verification (the dense
row overlays shouldn't ship blind); sealed products star from their detail pages
meanwhile. Entries store section/game so a later price-refresh action can re-fetch the
right feeds. Gate: 146/146 node (three new favorites tests), lint, 4/4 Playwright.
Follow-up landed same day (user direction): row favoriting lives in the hover popovers —
a compact backdrop-blurred star pinned to the hover card's corner, wired on leaderboard,
sealed, chase-card, and related-sealed rows; click-through verified on dev (toggles
without navigating). Committed `bf3604b` (GitHub only; production still holds).

**Phase C in progress (2026-08-28, gated, uncommitted):** the EV core is built.
`app/domain/pack-ev.ts` (pure, tested): chase EV per pack = Σ tiers (average tracked
tier price ÷ packs per hit), explicitly a floor (bulk excluded); EV ratio vs the
cheapest live single-pack price. Sealed detail pages show an EV strip above the
pull-rate table ("Chase EV per pack · Pack price · EV ratio" with rip-vs-buy verdict).
The metrics payload prices per-set EV server-side (same `pullRateFor` resolution the
detail pages use, weighted per-set tier averages from D1, `loadPullRateConfig()` asset
loader) and the set leaderboard gains sortable **Sealed 30D** (H2 divergence — sealed
median momentum beside singles momentum) and **Pack EV** ($ + ratio chip) columns, ⓘ
updated. Integration-tested end to end on a seeded database (EV $9.375 vs $4 pack →
2.34×). Gate: 149/149 node, lint, 4/4 Playwright. Committed `66e738a`.

**Phase C remainder landed (2026-08-28, gated, uncommitted):** sealed default sort is now
**market** (C5 — profit-vs-MSRP becomes an opt-in lens; parse default, mode-switch reset,
and signal-view reset all updated, characterization test moved with the decision). Cases
detail pages show **"Case vs unit"** (N5): the case's market price as a multiple of its
matching unit product (name-minus-"Case" match in the same set; observed multiple only —
never an assumed case size). Set chase EV now reaches the sealed view: `loadSetEvData`/
`loadSetEvRows` extracted from the metrics payload, a small `/api/set-ev` feed (database-
backed only, 503 elsewhere), and sealed hover cards gain a toned **"Set pack EV"** metric
($ · ratio×). Gate: 150/150 node, lint, 4/4 Playwright.

**MSRP sourcing research (2026-08-28, user-requested):** headline — **no bulk MSRP
dataset exists anywhere** (Scrydex, PriceCharting, TCGCSV, Bulbapedia: none carry MSRP);
the strategy is derive + curate. (1) **Type+era defaults** cover an estimated 60–70% of
the ~1,850 Pokémon sealed SKUs: verified anchors — packs $3.99 (SWSH era) → **$4.49**
(SV Mar 2023 onward, unchanged through the Mega era; the rumored 2025 rise to $4.99 was
Japan-only), ETB $39.99 → $49.99, bundle $26.94, box 36×pack $161.64, UPC $119.99;
defaults break on collections, tins, box sets, PC-exclusive ETBs ($59.99), and imports.
(2) **One Piece is solved**: Bandai's official product pages print "MSRP USD $X" for
every product — 23 SKUs ≈ 30 minutes by hand, grid scrapeable for future sets.
(3) **Riftbound**: Riot merch pages + PHD/GTS distributor MSRP tables per wave — 73 SKUs
≈ 2–3 hours. (4) Per-product Pokémon exceptions curate best from PokeBeach product
announcements (every reveal carries MSRP; bot-walled, manual lookup). Pokémon Center
scraping is dead (Imperva) and PokeBeach RSS 403s — skip automation there. ⚑ Resolved (2026-08-28, user): **verified + derived, badged** — hand-curate the verified
sources (One Piece from Bandai, Riftbound from Riot/distributors, Pokémon exceptions
from announcements) AND apply type+era defaults for the rest, stored as
`msrp_source='derived'` with a visible "standard pricing" badge so estimates are never
dressed as verified. Target ~85%+ coverage; the sealed view's "Verified MSRP" copy
updates to distinguish the two sources. Queued as the next Phase C work item.

**MSRP fill landed (2026-08-28, gated):** `scripts/msrp/derived-msrp.mjs` derives
standard pricing for high-confidence Pokémon name patterns (packs/bundles/boxes/ETBs/
UPCs, 2020+, SWSH vs SV-era price points; PC-exclusives, sleeved, blisters, collections
and imports refuse to derive) — applied at normalization with precedence published →
verified → derived, each carrying its badge string ("Standard pricing (derived)").
`scripts/msrp/verified-msrp.mjs` holds hand-curated officially-sourced values: 16
newly-priced Riftbound products from PHD/UVS/Riot/Coqui distributor sheets; the other
28 of the 44 imports are deliberately **none** (distributor cases, OP kits/prize packs,
non-SKU art bundles, unpublished waves) — soft secondary-only prices excluded. One Piece
was already fully covered by the curated Bandai-sourced feed. Full provenance table:
`docs/msrp-sources.md` (product | MSRP | source, per the user's request). Sealed-view
copy updated to distinguish published from derived. New values flow to the database with
each daily live run. Tests: derived-rule matrix + normalizer-precedence; gate 152/152 +
4/4 Playwright. Committed `8438d23`.

**Phase D landed (2026-08-28, gated):** `app/domain/eras.ts` — Pokémon era mapping
(prefix wins, release year breaks ties; boundary cases pinned by tests: EX Dragon 2003
→ EX, Crown Zenith 2023 → SWSH, DP promos → DP). The metrics payload folds every
Pokémon set into eras (tracked value, cards, sets, and tracked-value-weighted 30D
momentum from member sets' median changes) and the metrics page gains an **Era
performance** section (Pokémon/All singles scopes, canonical era order, ⓘ explains the
weighting). Index cards gain the **median toggle** (N3 — Pokémon-100 and Riftbound-50
switch between top-of-market index and typical-card median; divergence is the signal)
and accumulating cards render compact (H5). Detail pages show a **liquidity chip**
beside the market price (H3 v1): "N sold/30D" from TCGplayer completed-sale buckets,
amber "Thin market" under 5 — unknown volume shows nothing rather than a guess.
Deferred from Phase D: the leaderboard-page era filter (filter-system surgery, queued
with the row-star styling pass). Gate: 153/153 node, lint, 4/4 Playwright. Committed
`096a933`.

**Phase E landed (2026-08-28, gated):** Japanese promos as a staged section.
`normalizeSinglesGroup` accepts a fixed section (rarity falls back to "Promo" — JP
listings often omit it); the live work list walks TCGCSV category 85's promo groups
(~22, the stated priority slice) into section `japanese-promos` under Pokémon, singles
only (JP sealed-shaped listings are guarded out of the English sealed catalog); the
local sync gains the same category+filter+section config for feed regeneration. UI:
"Japanese Promos" joins the Pokémon rarity dropdown (placement decision: rarity section,
not a TopBar market — revisitable), injected until the next feed regeneration.
**Staged-rollout hardening** this exposed: a section feed that has not materialized
404s — both the client batch loader and the server feed repository now treat a missing
optional section as empty instead of failing every other section. Production ingests
the JP groups on its next daily live run; until then the section shows an honest empty
state. Liquidity flags (Phase D's chip) apply to JP detail pages automatically. Gate:
153/153 node, lint, 4/4 Playwright. Committed `90de302`.

**Phase F landed (2026-08-28, gated — spend held per user):** the rotation already
walked the top-value pool exactly as prescribed (audit assumption corrected — coverage
was small purely from 45-fetches/day accrual time); its pool widens 400 → 600 (research:
premiums matter for the top 500–1,000; 600 keeps refresh inside ~two weeks). Covered
detail pages gain the **Grading edge** strip: raw→PSA 10 spread net of a stated ~$25
bulk-fee estimate, with a plain verdict ("Worth grading / Marginal / Not worth the
fee") and the honesty note that gem-rate risk is not priced in — shown only when PSA 10
has ≥2 real sales and a raw price exists. PriceCharting inquiry + paid sources remain
parked with the spend decision; Phase G (accounts/alerts/portfolio) stays deliberately
later. Gate: 153/153 node, lint, 4/4 Playwright.

**Liquidity gate + S&P benchmark landed (2026-08-28, user decisions, gated):**
(1) Hot boards now require real transaction backing — **≥5 completed sales/30D AND
≥1/7D**, both sides, new `insufficient-liquidity` exclusion. Counts come from the
TCGplayer buckets the ingestion already fetches: migration `0006` adds
`sales_7`/`sales_30` to market_metrics (written by history runs, preserved across
sales-less daily upserts, read back for daily gating); unknown counts pass — absence of
data is not proof of illiquidity. (2) **S&P 500 benchmark** via Alpha Vantage's SPY
daily series (labeled as the proxy everywhere): one call rides the daily metrics tick,
key-gated (`ALPHAVANTAGE_API_KEY` Worker secret — key to be provided), rows land as the
`benchmark:sp500` series; rate-limit Note bodies are reported, never written. UI: the
combined overview card gains a "vs S&P 500 (SPY)" 90D comparison line and every index
card gains a **"vs S&P"** view — both series rebased to 100 at the first shared date.
Gate: 156/156 node, lint, 4/4 Playwright.
