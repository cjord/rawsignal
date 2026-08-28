import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFeedCatalogRepository } from "../app/data/feed-catalog-repository.ts";
import { createMemoryCatalogRepository } from "../app/data/catalog-repository.ts";
import { calculateSealedScenario, querySealedCatalog, querySinglesCatalog } from "../app/data/catalog-query.ts";
import { catalogRequestFromUrl, executeCatalogRequest } from "../app/data/catalog-service.ts";
import { parseCards, parseSealedProducts } from "../app/domain/contracts.ts";

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const singlesOptions = overrides => ({
  market: "pokemon",
  sections: [],
  query: "",
  sets: [],
  minPrice: "",
  maxPrice: "",
  up7: false,
  down7: false,
  up30: false,
  down30: false,
  signal: "leaderboard",
  strictness: "balanced",
  sort: "market",
  direction: "desc",
  page: 1,
  perPage: 20,
  ...overrides,
});

const sealedOptions = overrides => ({
  market: "pokemon",
  productTypes: [],
  query: "",
  sets: [],
  marketMin: "",
  marketMax: "",
  msrpMin: "",
  msrpMax: "",
  profitMin: "",
  profitMax: "",
  profitPctMin: "",
  profitPctMax: "",
  profitableOnly: false,
  basis: "market",
  keepPct: 100,
  taxOn: false,
  taxRate: 8,
  shipping: 0,
  signal: "leaderboard",
  strictness: "balanced",
  sort: "market",
  direction: "desc",
  page: 1,
  perPage: 20,
  ...overrides,
});

test("shared Singles query supports multi-token fuzzy search and typo tolerance", async () => {
  const pokemon = parseCards([
    ...await json("../public/data/illustration-rares.json"),
    ...await json("../public/data/special-illustration-rares.json"),
  ]);
  const umbreon = querySinglesCatalog(pokemon, singlesOptions({ query: "umbron 161", sections: ["special-illustration-rares"] }));
  assert.ok(umbreon.total >= 1);
  assert.match(umbreon.items[0].name, /Umbreon ex - 161\/131/i);

  const riftbound = parseCards(await json("../public/data/overnumbered.json"));
  const teemo = querySinglesCatalog(riftbound, singlesOptions({ market: "riftbound", sections: ["overnumbered"], query: "teemo over", perPage: 50 }));
  assert.ok(teemo.total >= 2);
  assert.ok(teemo.allItems.every(card => /teemo/i.test(card.name) && /overnumbered/i.test(card.name)));
});

test("shared queries keep nulls last, clamp page boundaries, and preserve facets", async () => {
  const sealed = parseSealedProducts(await json("../public/data/sealed-riftbound.json"));
  for (const direction of ["asc", "desc"]) {
    const result = querySealedCatalog(sealed, sealedOptions({ market: "riftbound", direction, page: 999, perPage: 20 }));
    assert.equal(result.page, result.pages);
    const firstNull = result.allItems.findIndex(product => product.marketPrice == null);
    assert.ok(firstNull === -1 || result.allItems.slice(firstNull).every(product => product.marketPrice == null));
    assert.ok(result.facets.sets.length > 0);
    assert.ok(result.facets.productTypes.length > 0);
  }
});

test("sealed scenario calculations and filters share one implementation", async () => {
  const sealed = parseSealedProducts(await json("../public/data/sealed-pokemon.json"));
  const sample = sealed.find(product => product.msrp != null && product.marketPrice != null);
  assert.ok(sample);
  const scenario = { basis: "market", keepPct: 90, taxOn: true, taxRate: 8, shipping: 5 };
  const calculation = calculateSealedScenario(sample, scenario);
  assert.equal(calculation.proceeds, sample.marketPrice * .9);
  assert.equal(calculation.cost, sample.msrp * 1.08 + 5);
  const profitable = querySealedCatalog(sealed, sealedOptions({ ...scenario, profitableOnly: true, sort: "profitPct" }));
  assert.ok(profitable.allItems.every(product => calculateSealedScenario(product, scenario).profit > 0));
});

test("riftbound sealed categories map onto the shared product-type buckets", async () => {
  const sealed = parseSealedProducts(await json("../public/data/sealed-riftbound.json"));
  const result = querySealedCatalog(sealed, sealedOptions({ market: "riftbound" }));
  for (const type of ["Booster Packs", "Booster Boxes", "Starter / Theme Decks", "Collections"]) {
    assert.ok(result.facets.productTypes.includes(type), `missing type facet ${type}`);
  }
  // Filtering by a mapped bucket returns the riftbound products that carried the alias.
  const decks = querySealedCatalog(sealed, sealedOptions({ market: "riftbound", productTypes: ["Starter / Theme Decks"] }));
  assert.ok(decks.total >= 10);
  assert.ok(decks.allItems.every(product => product.category === "Decks"));
});

test("sealed regular-mode sorts rank by the derived 30-day metrics, unknowns last", async () => {
  const sealed = parseSealedProducts(await json("../public/data/sealed-pokemon.json")).slice(0, 3);
  const [a, b, c] = sealed.map(product => product.productId);
  const derived = {
    [a]: { change7: 1, change30: -2, low30: 30, high30: 90, signal: null },
    [b]: { change7: 5, change30: 4, low30: 10, high30: 50, signal: null },
    // c has no derived metrics — it sorts last in either direction.
  };
  const byChange7 = querySealedCatalog(sealed, sealedOptions({ sort: "change7" }), derived);
  assert.deepEqual(byChange7.allItems.map(product => product.productId), [b, a, c]);
  const byLow = querySealedCatalog(sealed, sealedOptions({ sort: "low", direction: "asc" }), derived);
  assert.deepEqual(byLow.allItems.map(product => product.productId), [b, a, c]);
  const byHigh = querySealedCatalog(sealed, sealedOptions({ sort: "high" }), derived);
  assert.deepEqual(byHigh.allItems.map(product => product.productId), [a, b, c]);
});

test("memory and feed repositories return the same IDs and totals", async () => {
  const cards = parseCards(await json("../public/data/overnumbered.json"));
  const sealed = parseSealedProducts(await json("../public/data/sealed-riftbound.json"));
  const directRepository = createMemoryCatalogRepository(cards, sealed);
  const directOptions = singlesOptions({ market: "riftbound", sections: ["overnumbered"], query: "teemo over", perPage: 30 });
  const direct = await directRepository.querySingles(directOptions);

  const fetcher = async input => {
    assert.ok(input instanceof Request);
    const url = new URL(input.url);
    try {
      return new Response(await readFile(new URL(`../public${url.pathname}`, import.meta.url)), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
  const feedRepository = await createFeedCatalogRepository("https://raw-signal.test", fetcher);
  const feed = await feedRepository.querySingles(directOptions);
  assert.equal(feed.total, direct.total);
  assert.deepEqual(feed.items.map(card => card.productId), direct.items.map(card => card.productId));
});

test("signal and movement filters consume the same derived catalog fields", async () => {
  const cards = parseCards((await json("../public/data/overnumbered.json")).slice(0, 3));
  const selected = cards[1];
  const derived = {
    [selected.productId]: {
      change7: 4,
      change30: -8,
      low30: 10,
      high30: 20,
      signal: { side: "buy", score: 88, confidence: "high", reason: "New 30-day low", detail: "At the low", distance: 0, cutoff: 2 },
    },
  };
  const result = querySinglesCatalog(cards, singlesOptions({ market: "riftbound", signal: "buy", sort: "signal", up7: true }), derived);
  assert.deepEqual(result.items.map(card => card.productId), [selected.productId]);
});

test("a Cases product reports its price multiple against the matching unit product", async () => {
  const unit = { game: "pokemon", productId: 70, name: "Fixture Booster Display", set: "Fixture Set", category: "Booster Boxes", image: null, url: "https://example.com/u", msrp: null, marketPrice: 100, midPrice: null, profit: null, profitPct: null, msrpSource: null };
  const kase = { ...unit, productId: 71, name: "Fixture Booster Display Case", category: "Cases", marketPrice: 590 };
  const repository = createMemoryCatalogRepository([], [unit, kase]);
  const detail = await repository.getDetail("sealed", 71);
  assert.equal(detail.caseUnit.productId, 70);
  assert.equal(detail.caseUnit.multiple, 5.9);
  // Non-case products, and cases without a matching unit, carry no multiple.
  assert.equal((await repository.getDetail("sealed", 70)).caseUnit, null);
});

test("hot boards list every qualifying signal, strongest first; the leaderboard stays exhaustive", async () => {
  const cards = parseCards((await json("../public/data/overnumbered.json")).slice(0, 40));
  const withSignal = cards.slice(0, 30);
  const derived = Object.fromEntries(withSignal.map((card, index) => [card.productId, {
    change7: null, change30: null, low30: null, high30: null,
    signal: { side: "sell", score: 40 + index, confidence: "medium", reason: "Near high", detail: "x", distance: 1, cutoff: 4 },
  }]));
  const hot = querySinglesCatalog(cards, singlesOptions({ market: "riftbound", signal: "sell", sort: "signal", perPage: 50 }), derived);
  // No top-N curation (removed 2026-08-28): every card carrying a signal is on the board,
  // signal-less cards are not, and the default order is score descending.
  assert.equal(hot.total, withSignal.length);
  const scores = hot.allItems.map(card => derived[card.productId].signal.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  const leaderboard = querySinglesCatalog(cards, singlesOptions({ market: "riftbound", perPage: 50 }), derived);
  assert.equal(leaderboard.total, cards.length);
});

test("catalog service returns a compact paged API response", async () => {
  const cards = parseCards(await json("../public/data/overnumbered.json"));
  const repository = createMemoryCatalogRepository(cards, []);
  const request = catalogRequestFromUrl(new URL("https://raw-signal.test/api/catalog?market=riftbound&rarity=overnumbered&q=teemo%20over&page=1&perPage=20&mode=singles&sort=market&direction=desc&signal=leaderboard&strictness=balanced"));
  const body = await executeCatalogRequest(request, repository, "feed");
  assert.equal(body.source, "feed");
  assert.ok(body.total >= 2);
  assert.ok(body.items.every(card => /teemo/i.test(card.name)));
  assert.equal("allItems" in body, false);
});
