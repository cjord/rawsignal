import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("keeps core controls and chart interactions accessible", async () => {
  const [page, sealed, marketUi, priceChart] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MarketUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PriceChart.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["Singles market", "Card rarity", "Cards per page"])
    assert.match(page, new RegExp(`aria-label=\\"${label}\\"`));
  for (const label of ["Sealed market", "Sealed set", "Sealed products per page"])
    assert.match(sealed, new RegExp(`aria-label=\\"${label}\\"`));
  assert.match(page, /label="Card view"/);
  assert.match(page, /label="Leaderboard pages"/);
  assert.match(sealed, /label="Sealed product view"/);
  assert.match(sealed, /label="Sealed product pages"/);
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
  assert.match(sealed, /sealed=1/);
  assert.match(sealed, /<HistoryPanel/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /30D Low/);
  assert.match(page, /touch-open/);
  assert.match(page, /dataset\.expand=rect\.right\+430>window\.innerWidth\?"left":"right"/);
  assert.match(page, /view!=="large"&&window\.matchMedia/);
  assert.match(page, /change90:nearestChange\(points,90\)/);
  assert.match(page, /movement\("90 day",history\?\.change90\)/);
  assert.match(page, /view==="large"\|\|view==="full"\?<SortToolbar/);
  assert.match(sealed, /view==="full"\?<SortToolbar/);
  assert.match(page, /metrics=\{cardHistoryMetrics\(card,history\)\}/);
  const hover = page.slice(page.indexOf("function HoverCard"), page.indexOf("export default function Home"));
  assert.doesNotMatch(hover, /Listing low|Listing high/);
});

test("includes server pagination and resilient image fallbacks", async () => {
  const [route, historyRoute, historyUtils, image] = await Promise.all([
    readFile(new URL("../app/api/cards/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/history-utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/DeferredImage.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /perPage/);
  assert.match(route, /cards\.slice\(start,start\+perPage\)/);
  assert.match(route, /Cache-Control/);
  assert.match(historyRoute, /history\(productId,"annual"\)/);
  assert.match(historyRoute, /mergeHistoryBuckets/);
  assert.match(historyUtils, /new Map<string,number>/);
  assert.match(image, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(image, /Image<br\/>unavailable/);
});

test("keeps full charts unconstrained and large hover surfaces identical",async()=>{const css=await readFile(new URL("../app/market-views.css",import.meta.url),"utf8");assert.match(css,/grid-template-columns: none !important/);assert.match(css,/\.full-history \.chart-canvas/);assert.match(css,/backdrop-filter: none !important/);assert.match(css,/background-color: var\(--surface\) !important/);assert.match(css,/\.view-large \.hover-card[\s\S]*box-shadow: none !important/)});

test("provides animated view selection and accessible card filters",async()=>{const [page,filters,ui,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),readFile(new URL("../app/MarketUI.tsx",import.meta.url),"utf8"),readFile(new URL("../app/market-views.css",import.meta.url),"utf8")]);assert.match(ui,/className="view-slider"/);assert.match(css,/--selected-index/);assert.match(css,/\.view-large \.leader-row:hover \{ box-shadow: none !important/);assert.match(filters,/Minimum market price/);assert.match(filters,/Available sets/);for(const label of ["7D increases","7D decreases","30D increases","30D decreases"])assert.match(filters,new RegExp(label));assert.match(page,/setSelectedSets/);assert.match(page,/History high/);assert.match(page,/metrics=\{\[\]\}/)});

test("validates rarity order, high prices, and regional N/A records", async () => {
  const index = JSON.parse(await readFile(new URL("../tcg-index.json", import.meta.url), "utf8"));
  assert.deepEqual(index.rarities.pokemon.map(x => x.key), ["illustration-and-special-rares", "illustration-rares", "special-illustration-rares", "promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares", "vintage", "all"]);
  assert.deepEqual(index.rarities.riftbound.map(x => x.key), ["rares", "epics", "alt-arts", "overnumbered", "signatures", "all"]);
  assert.equal(index.rarities.magic.at(-1).key, "all");
  const cards = JSON.parse(await readFile(new URL("../public/data/illustration-rares.json", import.meta.url), "utf8"));
  assert.ok(cards.length > 0 && cards.every(card => Object.hasOwn(card, "highPrice")));
  const combined = JSON.parse(await readFile(new URL("../public/data/illustration-and-special-rares.json", import.meta.url), "utf8"));
  const special = JSON.parse(await readFile(new URL("../public/data/special-illustration-rares.json", import.meta.url), "utf8"));
  assert.equal(combined.length, cards.length + special.length);
  for (const key of ["promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares"])
    assert.ok(JSON.parse(await readFile(new URL(`../public/data/${key}.json`, import.meta.url), "utf8")).length >= 50);
  const sealed = JSON.parse(await readFile(new URL("../public/data/sealed-riftbound.json", import.meta.url), "utf8"));
  const regional = sealed.filter(product => product.productId < 0);
  assert.equal(regional.length, 6);
  assert.ok(regional.every(product => product.marketPrice === null && product.profit === null));
});
