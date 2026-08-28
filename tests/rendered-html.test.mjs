import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {parseMarketQuery} from "../app/state/market-query.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

async function readStyles() {
  const files = [
    "../app/globals.css",
    "../app/market-views.css",
    "../app/styles/market-controls.css",
    "../app/styles/market-content.css",
  ];
  return (await Promise.all(files.map(file => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
}

test("renders the branded dark-first application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]+data-theme="dark"/i);
  assert.match(html, /<meta name="color-scheme" content="dark light"/i);
  assert.match(html, /<title>Raw Signal/);
  assert.match(html, /Switch to light mode/);
  assert.match(html, /How Raw Signal works\./);
  assert.match(html, /https:\/\/tcgcsv\.com\/docs/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("styles Scalper mode and its sale scenario as a distinct sealed state",async()=>{
  const [scenario,css,globals]=await Promise.all([
    readFile(new URL("../app/SaleScenario.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/market-views.css",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(scenario,/taxOn\?"has-value":"is-disabled"/);
  assert.match(css,/\.sealed-market:has\(\.sale-scenario\)>\.sealed-summary\{border-bottom-color:transparent\}/);
  assert.match(css,/option\[value="scalping"\]:checked/);
  assert.match(css,/\.scenario-checks label>span\{display:flex;align-items:center/);
  assert.match(globals,/\.scalper-mode-toggle\.is-scalper i\{[^}]*#e05454/);
});

test("characterizes Singles defaults before refactoring", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const defaults=parseMarketQuery("");
  assert.equal(defaults.mode,"singles");
  assert.equal(defaults.market,"pokemon");
  assert.deepEqual(defaults.rarities,["illustration-rares","special-illustration-rares"]);
  assert.equal(defaults.sort,"market");
  assert.equal(defaults.direction,"desc");
  assert.equal(defaults.view,"medium");
  assert.equal(defaults.perPage,20);
  assert.equal(defaults.strictness,"balanced");
  assert.match(page, /useState<Game>\("pokemon"\)/);
  assert.match(page, /useState<SortKey>\("market"\)/);
  assert.match(page, /useState<SignalStrictness>\("balanced"\)/);
  assert.match(page, /useMarketQueryState\(restoreQuery\)/);
});

test("characterizes Sealed defaults and guards the disabled Scalper fallback", async () => {
  const sealed = await readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8");
  const defaults=parseMarketQuery("?mode=sealed");
  // The default lens is market action (audit C5): profit-vs-MSRP only covers the
  // MSRP-verified slice, so it is an opt-in sort rather than the landing order.
  assert.equal(defaults.mode,"sealed");assert.equal(defaults.market,"pokemon");assert.equal(defaults.sort,"market");assert.equal(defaults.direction,"desc");assert.equal(defaults.perPage,20);assert.equal(defaults.view,"medium");assert.equal(defaults.basis,"market");assert.equal(defaults.keepPct,100);assert.equal(defaults.taxOn,false);
  assert.match(sealed, /useState<Game>\(\(\)\s*=>\s*initialState\.market\s*===\s*"scalping"\s*&&\s*!scalperEnabled\s*\?\s*"pokemon"\s*:\s*initialState\.market,?\s*\)/);
  assert.match(sealed, /useState<SortKey>\(initialState\.sort\)/);
  assert.match(sealed, /onQueryChange\(\{\s*mode:\s*"sealed"/);
});

test("keeps core controls and chart interactions accessible", async () => {
  const [page, sealed, sealedFilters, marketUi, priceChart, urlState, leaderboard, summary, topBar] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedFilters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MarketUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PriceChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/state/useMarketQueryState.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/MarketLeaderboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TopBar.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["Singles market", "Cards per page"])
    assert.match(page, new RegExp(`aria-label=\\"${label}\\"`));
  for (const label of ["Sealed market", "Sealed products per page"])
    assert.match(sealed, new RegExp(`aria-label=\\"${label}\\"`));
  assert.match(page, /<MultiSelectField\s+label="Rarity"/);
  assert.match(sealed, /<MultiSelectField\s+label="Product type"/);
  assert.match(page, /viewLabel:\s*"Card view"/);
  assert.match(page, /paginationLabel:\s*"Leaderboard pages"/);
  assert.match(sealed, /viewLabel:\s*"Sealed product view"/);
  assert.match(sealed, /className="sealed-toolbar"/);
  assert.match(sealed, /<SaleScenario/);
  assert.doesNotMatch(sealedFilters, /StrictnessControl|strictness/);
  // Strictness and hover previews are settings-menu preferences in the shared TopBar, never in toolbars.
  assert.match(page, /<TopBar/);
  assert.match(topBar, /<StrictnessControl\s+value=\{strictness\}/);
  assert.match(topBar, /Hover previews/);
  assert.doesNotMatch(page, /<StrictnessControl/);
  assert.doesNotMatch(sealed, /<StrictnessControl/);
  assert.match(summary, /leader-filter-summary.*has-content/);
  assert.match(sealed, /paginationLabel:\s*"Sealed product pages"/);
  assert.match(leaderboard, /<NumberedPagination/);
  assert.match(priceChart, /onPointerMove=\{move\}/);
  assert.match(priceChart, /className="chart-cursor"/);
  assert.match(priceChart, /preserveAspectRatio="none"/);
  assert.match(priceChart, /Math\.abs\(times\[i\]-target\)/);
  assert.match(marketUi, /aria-sort=/);
  assert.match(marketUi, /aria-current=/);
  assert.match(page, /label:\s*"Full"/);
  assert.match(sealed, /label:\s*"Medium"/);
  assert.match(sealed, /label:\s*"Text"/);
  assert.match(sealed, /label:\s*"Full"/);
  assert.match(urlState + await readFile(new URL("../app/data/usePriceHistoryBatch.ts", import.meta.url), "utf8"), /sealed.*1/);
  assert.match(sealed, /<HistoryPanel/);
  assert.match(urlState, /window\.history\.replaceState/);
  assert.match(urlState, /window\.history\.pushState/);
  assert.match(urlState, /popstate/);
  assert.match(urlState, /restoringRef/);
  assert.match(page, /useCatalogPage/);
  assert.match(page, /usePriceHistoryBatch/);
  assert.match(sealed, /useCatalogPage/);
  assert.match(sealed, /usePriceHistoryBatch/);
  assert.match(page, /30D Low/);
  const disclosure = await readFile(new URL("../app/hooks/useDisclosurePopover.ts", import.meta.url), "utf8");
  assert.match(disclosure, /onPointerEnter/);
  assert.match(disclosure, /onFocusCapture/);
  assert.match(disclosure, /event\.key!=="Escape"/);
  assert.match(await readFile(new URL("../app/domain/history-metrics.ts", import.meta.url), "utf8"), /change90:changeAtCutoff\(points,90\)/);
  assert.match(page, /movement\("90 day",\s*history\?\.change90\)/);
  assert.match(page, /view\s*===\s*"large"\s*\|\|\s*view\s*===\s*"full"\s*\?\s*\(?\s*<SortToolbar/);
  assert.match(sealed, /view\s*===\s*"full"\s*\?\s*\(?\s*<SortToolbar/);
  assert.match(page, /metrics=\{cardHistoryMetrics\(card,\s*history\)\}/);
  const hover = page.slice(page.indexOf("function HoverCard"), page.indexOf("export default function Home"));
  assert.doesNotMatch(hover, /Listing low|Listing high/);
});

test("includes cached history and resilient image fallbacks", async () => {
  const [historyRoute, historyClient, historyUtils, image] = await Promise.all([
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/tcgplayer-history-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/history-utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/DeferredImage.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(historyRoute, /fetchTcgplayerHistory/);
  assert.match(historyClient, /history\(productId, "annual"/);
  assert.match(historyClient, /mergeHistoryBuckets/);
  assert.match(historyUtils, /new Map<string,number>/);
  assert.match(image, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(image, /Image<br\/>unavailable/);
});

test("gates complete Hot Buy and Hot Sell coverage on persisted signal readiness",async()=>{const [page,sealed,hook,signals,catalog]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/data/usePersistedSignals.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/signals/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/catalog/route.ts",import.meta.url),"utf8")]);for(const source of [page,sealed]){assert.match(source,/usePersistedSignals/);assert.match(source,/persistedSignals\.ready/);assert.match(source,/persistedSignals\.resolved/)}assert.match(page,/candidates evaluated/);assert.match(hook,/\/api\/signals/);assert.match(signals,/publishedIngestion\(db,"history-signals"\)/);assert.match(catalog,/options\.signal === "leaderboard" \|\| Boolean\(await publishedIngestion\(db, "history-signals"\)\)/)});

test("keeps full charts unconstrained and large hover surfaces identical",async()=>{const css=await readFile(new URL("../app/market-views.css",import.meta.url),"utf8");assert.match(css,/grid-template-columns: none !important/);assert.match(css,/\.full-history \.chart-canvas/);assert.match(css,/backdrop-filter: none !important/);assert.match(css,/background-color: var\(--surface\) !important/);assert.match(css,/\.view-large \.hover-card[\s\S]*box-shadow: none !important/)});

test("provides animated view selection and accessible card filters",async()=>{const [page,sealed,filters,ui,css,summary,dismissible,range,checkboxes]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MarketUI.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx",import.meta.url),"utf8"),readFile(new URL("../app/filters/useDismissibleDetails.ts",import.meta.url),"utf8"),readFile(new URL("../app/filters/RangeFilter.tsx",import.meta.url),"utf8"),readFile(new URL("../app/filters/CheckboxGrid.tsx",import.meta.url),"utf8")]);assert.match(ui,/className="view-slider"/);assert.match(css,/--selected-index/);assert.match(css,/\.sealed-toolbar \.view-toggle\{grid-template-columns:repeat\(3,96px\)\}/);assert.match(css,/var\(--view-count\) - 1\) \* 3px/);assert.match(css,/var\(--selected-index\) \* \(100% \+ 3px\)/);assert.match(css,/drop-shadow\(/);assert.match(css,/drop-shadow\(0 0 10px/);assert.match(css,/\.controls > label,\.card-filters summary \{ height:56px!important/);assert.match(css,/\.movement-filters input::before/);assert.match(css,/\.card-filters\.has-filters summary/);assert.match(filters,/useDismissibleDetails/);assert.match(dismissible,/document\.addEventListener\("pointerdown",onPointerDown\)/);assert.match(range,/Minimum \$\{title\.toLowerCase\(\)\}/);assert.match(checkboxes,/SearchableCheckboxGrid/);assert.match(filters,/Available sets/);for(const label of ["7D increases","7D decreases","30D increases","30D decreases"])assert.match(filters,new RegExp(label));assert.match(page,/setSelectedSets/);assert.match(summary,/leader-filter-summary/);assert.match(page,/placeholder="Search card, set, or number"/);assert.doesNotMatch(page,/Fuzzy search/);assert.match(page,/History high/);assert.match(page,/Hist low/);assert.match(sealed,/Hist low/);assert.doesNotMatch(page,/History low/);assert.doesNotMatch(sealed,/History low/);assert.match(page,/metrics=\{\[\]\}/)});

test("composes Singles and Sealed through the shared leaderboard shell",async()=>{const [page,sealed,shell,summary]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/MarketLeaderboard.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx",import.meta.url),"utf8")]);for(const source of [page,sealed]){assert.match(source,/<MarketLeaderboard/);assert.match(source,/<LeaderboardHeader/);assert.match(source,/<LeaderboardControls/);assert.match(source,/<ActiveFilterSummary/)}assert.match(page,/views:\s*\[\s*\{\s*key:\s*"large"[\s\S]*\{\s*key:\s*"medium"[\s\S]*\{\s*key:\s*"text"[\s\S]*\{\s*key:\s*"full"/);assert.match(sealed,/views:\s*\[\s*\{\s*key:\s*"medium"[\s\S]*\{\s*key:\s*"text"[\s\S]*\{\s*key:\s*"full"/);assert.doesNotMatch(sealed,/views:\s*\[[^\]]*key:\s*"large"/);for(const state of ["loading","error","empty","ready"])assert.match(shell,new RegExp(`displayState===\\"${state}\\"|state===\\"${state}\\"`));assert.match(shell,/<NumberedPagination/);assert.match(summary,/matches\.toLocaleString\(\).*Matches/);assert.match(summary,/Remove \$\{item\.label\} filter/)});

test("uses one non-navigational disclosure contract for Singles and Sealed",async()=>{const [page,sealed,row,identity,popover,full,hook,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/MarketRow.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/ProductIdentity.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/HistoryPopover.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/FullMarketCard.tsx",import.meta.url),"utf8"),readFile(new URL("../app/hooks/useDisclosurePopover.ts",import.meta.url),"utf8"),readStyles()]);for(const source of [page,sealed]){assert.match(source,/<MarketRow/);assert.match(source,/<ProductIdentity/);assert.match(source,/<HistoryPopover/);assert.match(source,/<FullMarketCard/);assert.doesNotMatch(source,/href=\{(?:c|card|product)\.url\}/);assert.doesNotMatch(source,/Tap again to open TCGplayer|Click again to open TCGplayer/)}assert.match(row,/<details/);assert.match(row,/<summary/);assert.ok(row.indexOf("</summary>")<row.indexOf("{popover}"));assert.match(popover,/role="region"/);assert.match(identity,/<DeferredImage/);assert.match(full,/<article/);for(const behavior of ["onPointerEnter","onPointerLeave","onFocusCapture","onBlurCapture","onKeyDown","onSummaryClick"])assert.match(hook,new RegExp(behavior));assert.match(hook,/event\.key!=="Escape"/);assert.match(hook,/HOVER_OPEN_DELAY_MS/);assert.match(row,/useHoverPreviews/);assert.match(css,/\.market-row-shell\[open\] \.hover-card/);assert.match(css,/data-popup-place="below"/);assert.match(css,/data-expand="left"/);assert.match(css,/transform: translateY\(var\(--popover-lift\)\)/);assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.market-row-shell[\s\S]*transition: none !important/)});

test("uses shared sliding navigation and responsive signal evidence",async()=>{const [page,sealed,signals,filters,ui,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SignalControls.tsx",import.meta.url),"utf8"),readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MarketUI.tsx",import.meta.url),"utf8"),readStyles()]);assert.match(page,/className="product-toggle"/);assert.match(page,/setSort\(value\s*===\s*"leaderboard"\s*\?\s*"market"\s*:\s*"signal"\)/);assert.match(page,/className="signal-cell"/);assert.match(sealed,/className="sealed-signal-cell"/);assert.match(page,/signalSort/);assert.match(sealed,/sealedSignalSort/);assert.match(ui,/className=\{`view-toggle \$\{className\}`/);assert.match(signals,/className="signal-slider"/);assert.match(signals,/tone-\$\{value\}/);assert.doesNotMatch(filters,/filter-strictness|StrictnessControl/);assert.match(css,/\.signal-tabs\.tone-buy/);assert.match(css,/\.signal-tabs\.tone-sell/);assert.match(css,/\.product-toggle button,[\s\n]*\.signal-tabs button/);assert.match(css,/\.signal-navigation \{/);assert.match(css,/\.view-large \.identity \.signal-badge\{width:100%/);assert.match(css,/\.table-head\.has-signal/);assert.match(css,/\.sealed-head\.has-signal/);assert.match(sealed,/price-basis[\s\S]*<i aria-hidden="true"/)});

test("normalizes rarity and sealed product selection",async()=>{const [page,sealed,sealedFilters,multi,checkboxes,range,css,pokemon,queryState]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MultiSelectField.tsx",import.meta.url),"utf8"),readFile(new URL("../app/filters/CheckboxGrid.tsx",import.meta.url),"utf8"),readFile(new URL("../app/filters/RangeFilter.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8"),readFile(new URL("../public/data/sealed-pokemon.json",import.meta.url),"utf8"),readFile(new URL("../app/state/market-query.ts",import.meta.url),"utf8")]);assert.match(queryState,/pokemon:\["illustration-rares","special-illustration-rares"\]/);assert.match(queryState,/riftbound:\["overnumbered"\]/);assert.match(page,/searchable=\{false\}/);assert.match(page,/setSelectedSets\(\[\]\)/);assert.match(sealed,/setGame\(event\.target\.value as Game\);\s*setSelectedSets\(\[\]\);\s*setSelectedTypes\(\[\]\)/);assert.match(sealed,/label="Product type"/);const catalogQuery=await readFile(new URL("../app/data/catalog-query.ts",import.meta.url),"utf8");assert.match(catalogQuery,/Booster Boxes/);assert.doesNotMatch(catalogQuery,/Booster Boxes \/ Displays/);assert.match(sealed,/profitPctMin/);assert.ok(sealed.indexOf("sealed-market-strip")<sealed.indexOf("sealed-summary"));assert.match(sealedFilters,/searchLabel="Search sealed sets"/);assert.match(checkboxes,/allLabel="All sets"/);assert.match(sealedFilters,/Profit percentage/);assert.match(range,/min\|\|max\?"has-value"/);assert.match(multi,/toggleSelection\(selected,key,allKeys\)/);assert.match(multi,/searchable&&<label className="multi-search"/);assert.match(css,/\.multi-options label:has\(input:checked\),\.set-filters label:has\(input:checked\)/);assert.match(css,/\.sealed-filter-panel \.price-range\{grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/\.sealed-filter-panel>\.sealed-range\.has-value/);assert.doesNotMatch(pokemon,/Attack of the Vine|Lorcana/i)});

test("keeps sale-scenario filters expanded, unified, and removable from the summary",async()=>{const [scenario,sealed,sealedFilters,css]=await Promise.all([readFile(new URL("../app/SaleScenario.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8")]);assert.match(scenario,/<section className=\{`sale-scenario/);assert.doesNotMatch(scenario,/<details|<summary/);assert.match(scenario,/movement-filters scenario-checks/);assert.ok(scenario.indexOf("Include sales tax")<scenario.indexOf("Profitable products only"));assert.doesNotMatch(sealedFilters,/profitableOnly|Profitability/);for(const label of ["Keep After Fees","Shipping:","Sales Tax:","Profitable Only"])assert.match(sealed,new RegExp(label));assert.match(sealed,/profitableOnly=\{profitableOnly\}\s+onProfitableOnly/);assert.match(css,/\.sale-scenario-controls\{display:grid;grid-template-columns:repeat\(5/);assert.match(css,/\.sale-scenario \.number-control input\[type=number\][^{]*\{[^}]*border:0/);assert.doesNotMatch(css,/\.sale-scenario>div\{[^}]*border-top/)});

test("validates rarity order, high prices, and regional N/A records", async () => {
  const index = JSON.parse(await readFile(new URL("../tcg-index.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(index.rarities), ["pokemon", "riftbound"]);
  assert.deepEqual(Object.keys(index.totals), ["pokemon", "riftbound"]);
  assert.deepEqual(index.rarities.pokemon.map(x => x.key), ["illustration-rares", "special-illustration-rares", "promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares", "vintage", "all"]);
  assert.deepEqual(index.rarities.riftbound.map(x => x.key), ["rares", "epics", "alt-arts", "overnumbered", "signatures", "all"]);
  const cards = JSON.parse(await readFile(new URL("../public/data/illustration-rares.json", import.meta.url), "utf8"));
  assert.ok(cards.length > 0 && cards.every(card => Object.hasOwn(card, "highPrice")));
  for (const key of ["promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares"])
    assert.ok(JSON.parse(await readFile(new URL(`../public/data/${key}.json`, import.meta.url), "utf8")).length >= 50);
  const sealed = JSON.parse(await readFile(new URL("../public/data/sealed-riftbound.json", import.meta.url), "utf8"));
  const regional = sealed.filter(product => product.productId < 0);
  assert.equal(regional.length, 6);
  assert.ok(regional.every(product => product.marketPrice === null && product.profit === null));
});

test("tucks explanatory copy behind info hints and warms detail routes on popover intent", async () => {
  const [detail, row, prefetch, loadDetail, css] = await Promise.all([
    readFile(new URL("../app/ProductDetailPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/MarketRow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/detail-prefetch.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/load-detail.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/detail.css", import.meta.url), "utf8"),
  ]);
  // D3: explanatory metric text rides an InfoHint; data hints (dates, delivered ranges) stay visible.
  assert.match(detail, /import InfoHint from "\.\/InfoHint"/);
  assert.match(detail, /info\?:string/);
  assert.doesNotMatch(detail, /hint="10–90th percentile range vs median"/);
  assert.doesNotMatch(detail, /hint="Within the all-time range"/);
  // F1: history-gated sections keep their footprint with shimmer skeletons while /api/history resolves.
  assert.match(detail, /detail-skeleton/);
  assert.match(detail, /loading=\{!historyData&&!historyError\}/);
  assert.match(css, /\.detail-skeleton\{/);
  assert.match(css, /\.info-hint \[role="tooltip"\]\{display:none/);
  // F1: a popover dwell prefetches the detail route once per href, during idle time.
  assert.match(row, /warmDetailPage/);
  assert.match(prefetch, /requestIdleCallback/);
  assert.match(prefetch, /saveData/);
  // F1: the server surfaces repository/detail build timings for cold-start measurement.
  assert.match(loadDetail, /detailServerTiming/);
  assert.match(detail, /data-server-timing/);
});

test("the metrics page is database-honest and reachable from the top bar", async () => {
  const [topBar, page, view, service, chart] = await Promise.all([
    readFile(new URL("../app/TopBar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/metrics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MetricsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/metrics-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/PriceChart.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(topBar, /key:"metrics",label:"Metrics",href:"\/metrics"/);
  assert.match(page, /loadMetricsPayload/);
  // No estimates without rollup data: the view carries an explicit unavailable state.
  assert.match(view, /Metrics need the database/);
  assert.match(service, /publishedIngestion\(db, "metrics-rollup"\)/);
  // The base-100 comparison rides an additive overlay series sharing scale and time axis.
  assert.match(chart, /overlay\?: PricePoint\[\]|overlay\?:PricePoint\[\]/);
  assert.match(chart, /className="chart-overlay"/);
});

test("keeps Magic support paused across active application surfaces", async () => {
  const [page, sealed, layout, sync, rawIndex, queryState] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../sync-tcgcsv.mjs", import.meta.url), "utf8"),
    readFile(new URL("../tcg-index.json", import.meta.url), "utf8"),
    readFile(new URL("../app/state/market-query.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [page, sealed, layout]) {
    assert.doesNotMatch(source, /value="magic"|Magic: The Gathering/);
  }
  assert.match(queryState, /params\.get\("market"\)==="riftbound"\?"riftbound":"pokemon"/);
  assert.doesNotMatch(sync, /collect\(1,"magic"\)/);
  const index = JSON.parse(rawIndex);
  assert.equal(Object.hasOwn(index.rarities, "magic"), false);
  assert.equal(Object.hasOwn(index.totals, "magic"), false);
});
