import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseMarketQuery } from "../app/state/market-query.ts";

// The slimmed successor to rendered-html.test.mjs (decision D7, 2026-08-29): only
// genuine source contracts survive here — dependency bans, paused/removed-feature
// guards, data rules the behavioral suites cannot see, and read-side marker gates.
// Everything that pinned implementation trivia was deleted (behavior lives in the
// node behavioral suites and the Playwright journeys). Keep the bar high: add an
// assertion here only for an invariant that ONLY source or artifact text can express.

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("serves the branded dark-first shell from the production build", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]+data-theme="dark"/i);
  assert.match(html, /<meta name="color-scheme" content="dark light"/i);
  assert.match(html, /<title>Raw Signal/);
  // The scaffold/skeleton shell must never ship in place of the app (vinext hazard class).
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps the URL codec defaults stable", () => {
  const singles = parseMarketQuery("");
  assert.equal(singles.mode, "singles");
  assert.equal(singles.market, "pokemon");
  assert.deepEqual(singles.rarities, ["illustration-rares", "special-illustration-rares"]);
  assert.equal(singles.sort, "market");
  assert.equal(singles.direction, "desc");
  assert.equal(singles.view, "medium");
  assert.equal(singles.perPage, 20);
  assert.equal(singles.strictness, "balanced");
  const sealed = parseMarketQuery("?mode=sealed");
  // Market action is the default lens (audit C5): profit-vs-MSRP only covers the
  // MSRP-verified slice, so it is an opt-in sort rather than the landing order.
  assert.equal(sealed.mode, "sealed");
  assert.equal(sealed.market, "pokemon");
  assert.equal(sealed.sort, "market");
  assert.equal(sealed.direction, "desc");
  assert.equal(sealed.perPage, 20);
  assert.equal(sealed.view, "medium");
  assert.equal(sealed.basis, "market");
  assert.equal(sealed.keepPct, 100);
  assert.equal(sealed.taxOn, false);
});

test("a shared scalping URL falls back safely without the scalper preference", async () => {
  const sealed = await read("app/SealedView.tsx");
  assert.match(sealed, /state\.market === "scalping" && !scalperEnabled \? "pokemon" : state\.market/);
});

test("strictness lives only in the TopBar settings menu", async () => {
  const [page, sealed, sealedFilters, cardFilters, topBar] = await Promise.all([
    read("app/page.tsx"), read("app/SealedView.tsx"), read("app/SealedFilters.tsx"), read("app/CardFilters.tsx"), read("app/TopBar.tsx"),
  ]);
  assert.match(topBar, /<StrictnessControl\s+value=\{strictness\}/);
  assert.doesNotMatch(page, /<StrictnessControl/);
  assert.doesNotMatch(sealed, /<StrictnessControl/);
  assert.doesNotMatch(sealedFilters, /StrictnessControl|strictness/);
  assert.doesNotMatch(cardFilters, /filter-strictness|StrictnessControl/);
});

test("keeps listing extremes out of the hover history surface", async () => {
  const page = await read("app/page.tsx");
  // Data rule: displayed ranges come from the historical market series, never listing extremes.
  const hover = page.slice(page.indexOf("function HoverCard"), page.indexOf("export default function Home"));
  assert.ok(hover.length > 0, "HoverCard region not found in page.tsx — update the slice anchors");
  assert.doesNotMatch(hover, /Listing low|Listing high/);
});

test("gates complete Hot Buy and Hot Sell coverage on persisted signal readiness", async () => {
  const [page, sealed, hook, signals, catalog] = await Promise.all([
    read("app/page.tsx"), read("app/SealedView.tsx"), read("app/data/usePersistedSignals.ts"), read("app/api/signals/route.ts"), read("app/api/catalog/route.ts"),
  ]);
  // Persisted signals become authoritative ONLY after the history-signals completion
  // marker (architecture.md); this is the read-side half of that invariant.
  for (const source of [page, sealed]) {
    assert.match(source, /usePersistedSignals/);
    assert.match(source, /persistedSignals\.ready/);
    assert.match(source, /persistedSignals\.resolved/);
  }
  assert.match(page, /candidates evaluated/);
  assert.match(hook, /\/api\/signals/);
  assert.match(signals, /publishedIngestion\(db,"history-signals"\)/);
  assert.match(catalog, /options\.signal === "leaderboard" \|\| Boolean\(await publishedIngestion\(db, "history-signals"\)\)/);
});

test("keeps rows and artwork non-navigational", async () => {
  const [page, sealed] = await Promise.all([read("app/page.tsx"), read("app/SealedView.tsx")]);
  // Reliability boundary (architecture.md): rows are disclosures, not marketplace links.
  for (const source of [page, sealed]) {
    assert.doesNotMatch(source, /href=\{(?:c|card|product)\.url\}/);
    assert.doesNotMatch(source, /Tap again to open TCGplayer|Click again to open TCGplayer/);
  }
});

test("keeps removed and paused features removed", async () => {
  const [page, sealed, layout, sync, rawIndex, queryState, catalogQuery] = await Promise.all([
    read("app/page.tsx"), read("app/SealedView.tsx"), read("app/layout.tsx"), read("sync-tcgcsv.mjs"), read("tcg-index.json"), read("app/state/market-query.ts"), read("core/catalog-query.ts"),
  ]);
  // Magic stays paused on every active surface — no isolated UI, codec, index, or pipeline branch.
  for (const source of [page, sealed, layout]) assert.doesNotMatch(source, /value="magic"|Magic: The Gathering/);
  assert.match(queryState, /choice\(params\.get\("market"\),\["pokemon","riftbound","all"\] as const,"pokemon"\)/);
  assert.doesNotMatch(sync, /collect\(1,"magic"\)/);
  const index = JSON.parse(rawIndex);
  assert.equal(Object.hasOwn(index.rarities, "magic"), false);
  assert.equal(Object.hasOwn(index.totals, "magic"), false);
  // The removed market strip must not regrow, and the renamed sealed label stays renamed.
  assert.doesNotMatch(sealed, /sealed-market-strip/);
  assert.match(catalogQuery, /Booster Boxes/);
  assert.doesNotMatch(catalogQuery, /Booster Boxes \/ Displays/);
});

test("keeps the generated feeds inside their contracts", async () => {
  const index = JSON.parse(await read("tcg-index.json"));
  assert.deepEqual(Object.keys(index.rarities), ["pokemon", "riftbound"]);
  assert.deepEqual(Object.keys(index.totals), ["pokemon", "riftbound"]);
  // TRIPWIRE: page.tsx injects japanese-promos only while the index lacks it. A feed
  // regeneration that adds it to the index silently flips that guard — this deepEqual
  // makes the flip loud instead. Update BOTH sides together (docs/codebase-audit §couplings).
  assert.deepEqual(index.rarities.pokemon.map(x => x.key), ["illustration-rares", "special-illustration-rares", "promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares", "vintage", "all"]);
  assert.deepEqual(index.rarities.riftbound.map(x => x.key), ["rares", "epics", "alt-arts", "overnumbered", "signatures", "all"]);
  for (const key of ["promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares"])
    assert.ok(JSON.parse(await read(`public/data/${key}.json`)).length >= 50);
  // Regional sealed records keep explicit nulls — never estimated prices or profit.
  const sealed = JSON.parse(await read("public/data/sealed-riftbound.json"));
  const regional = sealed.filter(product => product.productId < 0);
  assert.ok(regional.length > 0);
  assert.ok(regional.every(product => product.marketPrice === null && product.profit === null));
  // Pokemon feeds must not carry cross-market records.
  assert.doesNotMatch(await read("public/data/sealed-pokemon.json"), /Attack of the Vine|Lorcana/i);
});

test("keeps resilient image fallback and data-saver respect", async () => {
  const [image, prefetch] = await Promise.all([read("app/DeferredImage.tsx"), read("app/leaderboard/detail-prefetch.ts")]);
  assert.match(image, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(prefetch, /saveData/);
});
