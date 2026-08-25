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

test("characterizes Sealed defaults before refactoring", async () => {
  const sealed = await readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8");
  const defaults=parseMarketQuery("?mode=sealed");
  assert.equal(defaults.mode,"sealed");assert.equal(defaults.market,"pokemon");assert.equal(defaults.sort,"profitPct");assert.equal(defaults.direction,"desc");assert.equal(defaults.perPage,20);assert.equal(defaults.view,"medium");assert.equal(defaults.basis,"market");assert.equal(defaults.keepPct,100);assert.equal(defaults.taxOn,false);
  assert.match(sealed, /useState<Game>\(initialState\.market\)/);
  assert.match(sealed, /useState<SortKey>\(initialState\.sort\)/);
  assert.match(sealed, /onQueryChange\(\{mode:"sealed"/);
});

test("keeps core controls and chart interactions accessible", async () => {
  const [page, sealed, sealedFilters, marketUi, priceChart, urlState, leaderboard, summary] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedFilters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MarketUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PriceChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/state/useMarketQueryState.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/MarketLeaderboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["Singles market", "Cards per page"])
    assert.match(page, new RegExp(`aria-label=\\"${label}\\"`));
  for (const label of ["Sealed market", "Sealed products per page"])
    assert.match(sealed, new RegExp(`aria-label=\\"${label}\\"`));
  assert.match(page, /<MultiSelectField label="Rarity"/);
  assert.match(sealed, /<MultiSelectField label="Product type"/);
  assert.match(page, /viewLabel:"Card view"/);
  assert.match(page, /paginationLabel:"Leaderboard pages"/);
  assert.match(sealed, /viewLabel:"Sealed product view"/);
  assert.match(sealed, /className=\{`sealed-toolbar/);
  assert.match(sealed, /<SaleScenario/);
  assert.doesNotMatch(sealedFilters, /StrictnessControl|strictness/);
  assert.match(page, /<StrictnessControl value=\{strictness\}/);
  assert.match(sealed, /<StrictnessControl value=\{strictness\}/);
  assert.match(summary, /leader-filter-summary.*has-content/);
  assert.match(sealed, /paginationLabel:"Sealed product pages"/);
  assert.match(leaderboard, /<NumberedPagination/);
  assert.match(priceChart, /onPointerMove=\{move\}/);
  assert.match(priceChart, /className="chart-cursor"/);
  assert.match(priceChart, /preserveAspectRatio="none"/);
  assert.match(priceChart, /Math\.abs\(times\[i\]-target\)/);
  assert.match(marketUi, /aria-sort=/);
  assert.match(marketUi, /aria-current=/);
  assert.match(page, /label:"Full"/);
  assert.match(sealed, /label:"Medium"/);
  assert.match(sealed, /label:"Text"/);
  assert.match(sealed, /label:"Full"/);
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
  assert.match(page, /touch-open/);
  assert.match(page, /dataset\.expand=rect\.right\+430>window\.innerWidth\?"left":"right"/);
  assert.match(page, /view!=="large"&&window\.matchMedia/);
  assert.match(await readFile(new URL("../app/domain/history-metrics.ts", import.meta.url), "utf8"), /change90:changeAtCutoff\(points,90\)/);
  assert.match(page, /movement\("90 day",history\?\.change90\)/);
  assert.match(page, /view==="large"\|\|view==="full"\?<SortToolbar/);
  assert.match(sealed, /view==="full"\?<SortToolbar/);
  assert.match(page, /metrics=\{cardHistoryMetrics\(card,history\)\}/);
  const hover = page.slice(page.indexOf("function HoverCard"), page.indexOf("export default function Home"));
  assert.doesNotMatch(hover, /Listing low|Listing high/);
});

test("includes cached history and resilient image fallbacks", async () => {
  const [historyRoute, historyUtils, image] = await Promise.all([
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/history-utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/DeferredImage.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(historyRoute, /history\(productId,"annual"\)/);
  assert.match(historyRoute, /mergeHistoryBuckets/);
  assert.match(historyUtils, /new Map<string,number>/);
  assert.match(image, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(image, /Image<br\/>unavailable/);
});

test("keeps full charts unconstrained and large hover surfaces identical",async()=>{const css=await readFile(new URL("../app/market-views.css",import.meta.url),"utf8");assert.match(css,/grid-template-columns: none !important/);assert.match(css,/\.full-history \.chart-canvas/);assert.match(css,/backdrop-filter: none !important/);assert.match(css,/background-color: var\(--surface\) !important/);assert.match(css,/\.view-large \.hover-card[\s\S]*box-shadow: none !important/)});

test("provides animated view selection and accessible card filters",async()=>{const [page,sealed,filters,ui,css,summary]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MarketUI.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx",import.meta.url),"utf8")]);assert.match(ui,/className="view-slider"/);assert.match(css,/--selected-index/);assert.match(css,/\.sealed-toolbar \.view-toggle\{grid-template-columns:repeat\(3,96px\)\}/);assert.match(css,/var\(--view-count\) - 1\) \* 3px/);assert.match(css,/var\(--selected-index\) \* \(100% \+ 3px\)/);assert.match(css,/drop-shadow\(/);assert.match(css,/drop-shadow\(0 0 10px/);assert.match(css,/\.controls > label,\.card-filters summary \{ height:56px!important/);assert.match(css,/\.movement-filters input::before/);assert.match(css,/\.card-filters\.has-filters summary/);assert.match(filters,/document\.addEventListener\("pointerdown",close\)/);assert.match(filters,/Minimum market price/);assert.match(filters,/Available sets/);for(const label of ["7D increases","7D decreases","30D increases","30D decreases"])assert.match(filters,new RegExp(label));assert.match(page,/setSelectedSets/);assert.match(summary,/leader-filter-summary/);assert.match(page,/placeholder="Search card, set, or number"/);assert.doesNotMatch(page,/Fuzzy search/);assert.match(page,/History high/);assert.match(page,/Hist low/);assert.match(sealed,/Hist low/);assert.doesNotMatch(page,/History low/);assert.doesNotMatch(sealed,/History low/);assert.match(page,/metrics=\{\[\]\}/)});

test("composes Singles and Sealed through the shared leaderboard shell",async()=>{const [page,sealed,shell,summary]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/MarketLeaderboard.tsx",import.meta.url),"utf8"),readFile(new URL("../app/leaderboard/ActiveFilterSummary.tsx",import.meta.url),"utf8")]);for(const source of [page,sealed]){assert.match(source,/<MarketLeaderboard/);assert.match(source,/<LeaderboardHeader/);assert.match(source,/<LeaderboardControls/);assert.match(source,/<ActiveFilterSummary/)}assert.match(page,/views:\[\{key:"large"[\s\S]*\{key:"medium"[\s\S]*\{key:"text"[\s\S]*\{key:"full"/);assert.match(sealed,/views:\[\{key:"medium"[\s\S]*\{key:"text"[\s\S]*\{key:"full"/);assert.doesNotMatch(sealed,/views:\[[^\]]*key:"large"/);for(const state of ["loading","error","empty","ready"])assert.match(shell,new RegExp(`displayState===\\"${state}\\"|state===\\"${state}\\"`));assert.match(shell,/<NumberedPagination/);assert.match(summary,/matches\.toLocaleString\(\).*Matches/);assert.match(summary,/Remove \$\{item\.label\} filter/)});

test("uses shared sliding navigation and responsive signal evidence",async()=>{const [page,sealed,signals,filters,ui,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SignalControls.tsx",import.meta.url),"utf8"),readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MarketUI.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8")]);assert.match(page,/className="product-toggle"/);assert.match(page,/setSort\(value==="leaderboard"\?"market":"signal"\)/);assert.match(page,/className="signal-cell"/);assert.match(sealed,/className="sealed-signal-cell"/);assert.match(page,/signalSort/);assert.match(sealed,/sealedSignalSort/);assert.match(ui,/className=\{`view-toggle \$\{className\}`/);assert.match(signals,/className="signal-slider"/);assert.match(signals,/tone-\$\{value\}/);assert.doesNotMatch(filters,/filter-strictness|StrictnessControl/);assert.match(css,/\.signal-tabs\.tone-buy/);assert.match(css,/\.signal-tabs\.tone-sell/);assert.match(css,/\.product-toggle button,\.signal-tabs button\{height:46px/);assert.match(css,/\.signal-navigation\{flex-direction:column/);assert.match(css,/\.view-large \.identity \.signal-badge\{width:100%/);assert.match(css,/\.table-head\.has-signal/);assert.match(css,/\.sealed-head\.has-signal/);assert.match(sealed,/price-basis[\s\S]*<i aria-hidden="true"/)});

test("normalizes rarity and sealed product selection",async()=>{const [page,sealed,sealedFilters,multi,css,pokemon,queryState]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedView.tsx",import.meta.url),"utf8"),readFile(new URL("../app/SealedFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MultiSelectField.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8"),readFile(new URL("../public/data/sealed-pokemon.json",import.meta.url),"utf8"),readFile(new URL("../app/state/market-query.ts",import.meta.url),"utf8")]);assert.match(queryState,/pokemon:\["illustration-rares","special-illustration-rares"\]/);assert.match(queryState,/riftbound:\["overnumbered"\]/);assert.match(page,/searchable=\{false\}/);assert.match(page,/setSelectedSets\(\[\]\)/);assert.match(sealed,/setGame\(event\.target\.value as Game\);setSelectedSets\(\[\]\);setSelectedTypes\(\[\]\)/);assert.match(sealed,/label="Product type"/);assert.match(sealed,/Booster Boxes/);assert.doesNotMatch(sealed,/Booster Boxes \/ Displays/);assert.match(sealed,/profitPctMin/);assert.ok(sealed.indexOf("sealed-market-strip")<sealed.indexOf("sealed-summary"));assert.match(sealedFilters,/aria-label="Search sealed sets"/);assert.match(sealedFilters,/>All sets</);assert.match(sealedFilters,/Profit percentage/);assert.match(sealedFilters,/min\|\|max\?"has-value"/);assert.match(multi,/next\.length===options\.length\?\[\]:next/);assert.match(multi,/searchable&&<label className="multi-search"/);assert.match(css,/\.multi-options label:has\(input:checked\),\.set-filters label:has\(input:checked\)/);assert.match(css,/\.sealed-filter-panel \.price-range\{grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/\.sealed-filter-panel>\.sealed-range\.has-value/);assert.doesNotMatch(pokemon,/Attack of the Vine|Lorcana/i)});

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
