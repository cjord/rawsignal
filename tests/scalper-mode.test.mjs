import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { querySealedCatalog } from "../app/data/catalog-query.ts";
import { parseSealedProducts } from "../app/domain/contracts.ts";
import { parseMarketQuery, serializeMarketQuery } from "../app/state/market-query.ts";

const text = path => readFile(new URL(path, import.meta.url), "utf8");
const json = async path => JSON.parse(await text(path));

test("Scalping is a round-trippable Sealed market, never a Singles market", () => {
  const state = parseMarketQuery("?mode=sealed&market=scalping&type=all&view=medium&sort=profitPct&direction=desc&page=1&perPage=20");
  assert.equal(state.mode, "sealed");
  assert.equal(state.market, "scalping");
  assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)), state);
  assert.equal(parseMarketQuery("?mode=singles&market=scalping").market, "pokemon");
});

test("approved Scalper feed contains only real sealed records and approved variants", async () => {
  const products = parseSealedProducts(await json("../public/data/sealed-scalping.json"));
  const ids = new Set(products.map(product => product.productId));
  assert.ok(products.length > 100);
  assert.equal(ids.size, products.length);
  assert.ok(products.every(product => ["pokemon", "onepiece", "riftbound", "yugioh", "lorcana", "football"].includes(product.game)));
  assert.ok(products.every(product => product.category !== "Other"));
  for (const productId of [654154,654156,666909,666908,671250,671249,669278,669277,669273,656487,697970]) assert.ok(ids.has(productId), `missing approved product ${productId}`);
  assert.equal(products.find(product => product.productId === 671250)?.msrp, 24.99);
  assert.equal(products.find(product => product.productId === 671249)?.msrp, 24.99);
  assert.ok(!ids.has(669298), "random-art approval excludes the Set of 3");
});

test("Scalper feed includes curated trading-card supplements and excludes merchandise", async () => {
  const products = parseSealedProducts(await json("../public/data/sealed-scalping.json"));
  const names = new Set(products.map(product => product.name));
  assert.ok(names.has("Mega Evolution—Ascended Heroes 2-Pack Blister"));
  assert.ok(names.has("Quarter Century Stampede Booster Box"));
  assert.ok(names.has("2025 Topps Chrome Football Hanger Box"));
  assert.equal(products.filter(product => product.name === "Quarter Century Stampede Booster Box").length, 1);
  assert.ok(!products.some(product => /Canon PowerShot|Sunny Days|NeeDoh/i.test(product.name)));
  const supplemental = products.find(product => product.productId === 990000001);
  assert.equal(supplemental?.msrp, 10.99);
  assert.equal(supplemental?.marketPrice, null);
  assert.equal(supplemental?.image, null);
});

test("Scalping queries the mixed sealed allowlist without filtering by source game", async () => {
  const products = parseSealedProducts(await json("../public/data/sealed-scalping.json"));
  const state = parseMarketQuery("?mode=sealed&market=scalping&type=all");
  assert.equal(state.mode, "sealed");
  const result = querySealedCatalog(products, state);
  assert.equal(result.total, products.length);
  assert.ok(result.facets.productTypes.length > 5);
});

test("Scalper controls are preference-driven and gated to Sealed rendering", async () => {
  const [page, sealed] = await Promise.all([text("../app/page.tsx"), text("../app/SealedView.tsx")]);
  assert.match(page, /raw-signal-scalper-mode/);
  assert.match(page, /setMode\(value\)/);
  assert.match(page, /scalperEnabled=\{scalperMode\s*===\s*"scalper"\}/);
  // The curated market keeps its internal "scalping" value (URL stability) under the
  // user-facing "Obey Products" label; the slider entry only exists in scalper mode.
  assert.match(page, /const scalpingMarket = \{ key: "scalping", label: "Obey Products" \}/);
  assert.match(page, /scalperMode === "scalper" \? \[scalpingMarket\] : \[\]/);
  assert.match(sealed, /beforeControls=\{\s*isScalping\s*\?\s*\(?\s*<SaleScenario/);
});

test("scalper mode swaps the 30D range for closing profit columns; regular hides profit", async () => {
  const [page, sealed] = await Promise.all([text("../app/page.tsx"), text("../app/SealedView.tsx")]);
  // Regular mirrors singles; scalper ends with Profit / Profit %.
  assert.match(sealed, /REGULAR_SORTS[\s\S]*?"low"[\s\S]*?"high"[\s\S]*?"change7"[\s\S]*?"change30"/);
  assert.match(sealed, /SCALPER_SORTS[\s\S]*?"change30"[\s\S]*?"profit"[\s\S]*?"profitPct"/);
  assert.doesNotMatch(sealed.slice(sealed.indexOf("SCALPER_SORTS")), /SCALPER_SORTS[\s\S]{0,600}"low"/);
  // Profit tiles, filters, and chips are scalper-gated; the market slider and summary flag the mode.
  assert.match(sealed, /\.\.\.\(isScalping\s*\?\s*\[\s*\{ label: "Profit"/);
  assert.match(sealed, /showProfit=\{isScalping\}/);
  assert.match(sealed, /isScalping && \(profitMin \|\| profitMax\)/);
  assert.match(page, /mode === "sealed" && scalperMode === "scalper" \? "is-scalper" : ""/);
  // The trailing space is deliberate: it keeps the accessible name "Scalping X Sealed".
  assert.match(sealed, /className="scalping-flag">Scalping <\/em>/);
});
