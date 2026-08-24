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
  const [page, sealed] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SealedView.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["Singles market", "Card rarity", "Cards per page", "Card view", "Leaderboard pages"])
    assert.match(page, new RegExp(`aria-label=\\"${label}\\"`));
  for (const label of ["Sealed market", "Sealed set", "Sort sealed products", "Sealed products per page"])
    assert.match(sealed, new RegExp(`aria-label=\\"${label}\\"`));
  assert.match(page, /onPointerMove=\{move\}/);
  assert.match(page, /className="chart-cursor"/);
  assert.match(page, /Math\.abs\(times\[i\]-target\)/);
  assert.match(page, /aria-sort=/);
  assert.match(page, /aria-current=/);
  assert.match(page, /label:"Full"/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /30D Low/);
  assert.match(page, /touch-open/);
});

test("includes server pagination and resilient image fallbacks", async () => {
  const [route, image] = await Promise.all([
    readFile(new URL("../app/api/cards/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/DeferredImage.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /perPage/);
  assert.match(route, /cards\.slice\(start,start\+perPage\)/);
  assert.match(route, /Cache-Control/);
  assert.match(image, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(image, /Image<br\/>unavailable/);
});

test("validates rarity order, high prices, and regional N/A records", async () => {
  const index = JSON.parse(await readFile(new URL("../tcg-index.json", import.meta.url), "utf8"));
  assert.deepEqual(index.rarities.pokemon.map(x => x.key), ["illustration-rares", "special-illustration-rares", "vintage", "all"]);
  assert.deepEqual(index.rarities.riftbound.map(x => x.key), ["rares", "epics", "alt-arts", "overnumbered", "signatures", "all"]);
  assert.equal(index.rarities.magic.at(-1).key, "all");
  const cards = JSON.parse(await readFile(new URL("../public/data/illustration-rares.json", import.meta.url), "utf8"));
  assert.ok(cards.length > 0 && cards.every(card => Object.hasOwn(card, "highPrice")));
  const sealed = JSON.parse(await readFile(new URL("../public/data/sealed-riftbound.json", import.meta.url), "utf8"));
  const regional = sealed.filter(product => product.productId < 0);
  assert.equal(regional.length, 6);
  assert.ok(regional.every(product => product.marketPrice === null && product.profit === null));
});
