import assert from "node:assert/strict";
import test from "node:test";
import { cardGame, effectivePrice, filterImportCards, importSetOptions, orderByValue, pageWindow, portfolioTotals, sortImportCards, sortValueOf } from "../app/state/collectr-view.ts";

// The Collectr import table model, exercised without the page's hooks. Fixtures mirror
// the shapes /api/collectr returns: matched rows carry a tracked market price, unmatched
// rows only Collectr's own estimate.

const card = (productId, overrides = {}) => ({
  productId, kind: "single", game: "pokemon", collectrGame: "Pokemon", name: `Card ${productId}`, set: "Surging Sparks",
  number: `${productId}/191`, rarity: "Illustration Rare", condition: "Near Mint", printing: "Holofoil", quantity: 1,
  collectrPrice: 10, collectrChange: null, image: null, matched: null, ...overrides,
});
const matched = (productId, marketPrice, overrides = {}, matchOverrides = {}) => card(productId, {
  ...overrides,
  matched: { kind: overrides.kind ?? "single", matchTier: "id", name: `Card ${productId}`, set: overrides.set ?? "Surging Sparks", game: overrides.game ?? "pokemon", section: "illustration-rares", rarity: "Illustration Rare", marketPrice, image: null, detailPath: `/cards/${productId}`, ...matchOverrides },
});

const cards = [
  matched(1, 50, { quantity: 2 }),
  matched(2, 5, { set: "Prismatic Evolutions" }),
  matched(3, 120, { kind: "sealed", game: "riftbound", set: "Origins", collectrPrice: null }, { kind: "sealed" }),
  card(4, { collectrPrice: 8, name: "Loose Zard", set: "Base Set" }),
  card(5, { game: "onepiece", collectrGame: "One Piece", collectrPrice: 30, set: "OP-01" }),
];
const none = new Set();

test("effective price prefers the tracked market price and falls back to Collectr's estimate", () => {
  assert.equal(effectivePrice(cards[0]), 50);
  assert.equal(effectivePrice(cards[3]), 8);
  assert.equal(effectivePrice(card(9, { collectrPrice: null })), 0);
  assert.deepEqual(orderByValue(cards).map(c => c.productId), [3, 1, 5, 4, 2]);
});

test("unmatched One Piece rows keep their game so they only surface under All", () => {
  assert.equal(cardGame(cards[4]), "onepiece");
  assert.equal(cardGame(cards[2]), "riftbound");
  const base = { scope: "all", market: "all", lens: "all", holdIds: none, sellIds: none, query: "", setFilter: [], minPrice: "", maxPrice: "" };
  assert.deepEqual(filterImportCards(cards, base).map(c => c.productId), [1, 2, 3, 4, 5]);
  assert.deepEqual(filterImportCards(cards, { ...base, market: "pokemon" }).map(c => c.productId), [1, 2, 4]);
  assert.deepEqual(filterImportCards(cards, { ...base, market: "riftbound" }).map(c => c.productId), [3]);
});

test("filters compose: scope, lens sets, search, set names, and price bounds", () => {
  const base = { scope: "all", market: "all", lens: "all", holdIds: new Set([1]), sellIds: new Set([3]), query: "", setFilter: [], minPrice: "", maxPrice: "" };
  assert.deepEqual(filterImportCards(cards, { ...base, scope: "sealed" }).map(c => c.productId), [3]);
  assert.deepEqual(filterImportCards(cards, { ...base, lens: "hold" }).map(c => c.productId), [1]);
  assert.deepEqual(filterImportCards(cards, { ...base, lens: "sell" }).map(c => c.productId), [3]);
  assert.deepEqual(filterImportCards(cards, { ...base, query: "  ZARD " }).map(c => c.productId), [4]);
  assert.deepEqual(filterImportCards(cards, { ...base, query: "2/191" }).map(c => c.productId), [2]);
  assert.deepEqual(filterImportCards(cards, { ...base, setFilter: ["Base Set", "OP-01"] }).map(c => c.productId), [4, 5]);
  assert.deepEqual(filterImportCards(cards, { ...base, minPrice: "10", maxPrice: "100" }).map(c => c.productId), [1, 5]);
  // A non-numeric bound is ignored rather than hiding every row.
  assert.deepEqual(filterImportCards(cards, { ...base, minPrice: "abc" }).map(c => c.productId), [1, 2, 3, 4, 5]);
});

test("sorting sinks nulls to the bottom in both directions and reads signal/history through lookups", () => {
  const lookups = { signalScore: c => (c.productId === 2 ? 80 : c.productId === 1 ? 65 : null), history: c => (c.productId === 3 ? { change7: -4, change30: 12 } : undefined) };
  assert.deepEqual(sortImportCards(cards, "market", "desc", lookups).map(c => c.productId), [3, 1, 2, 4, 5]);
  assert.deepEqual(sortImportCards(cards, "market", "asc", lookups).map(c => c.productId), [2, 1, 3, 4, 5]);
  assert.deepEqual(sortImportCards(cards, "signal", "desc", lookups).map(c => c.productId), [2, 1, 3, 4, 5]);
  assert.deepEqual(sortImportCards(cards, "change30", "desc", lookups).map(c => c.productId), [3, 1, 2, 4, 5]);
  assert.deepEqual(sortImportCards(cards, "card", "asc", lookups).map(c => c.productId), [1, 2, 3, 5, 4]);
  assert.equal(sortValueOf(cards[3], "collectr", lookups), 8);
  assert.equal(sortValueOf(cards[2], "collectr", lookups), null);
  assert.equal(sortValueOf(cards[0], "qty", lookups), 2);
});

test("portfolio totals count matched rows for market value, every row for Collectr value, sell-flagged rows for sell value", () => {
  const totals = portfolioTotals(cards, new Set([1, 5]));
  assert.deepEqual(totals.matched.map(c => c.productId), [1, 2, 3]);
  assert.deepEqual(totals.unmatched.map(c => c.productId), [4, 5]);
  assert.equal(totals.marketTotal, 50 * 2 + 5 + 120);
  assert.equal(totals.collectrTotal, 10 * 2 + 10 + 0 + 8 + 30);
  assert.equal(totals.sellValue, 50 * 2 + 30);
});

test("set options follow the market tab and sort by name", () => {
  assert.deepEqual(importSetOptions(cards, "all").map(o => o.key), ["Base Set", "OP-01", "Origins", "Prismatic Evolutions", "Surging Sparks"]);
  assert.deepEqual(importSetOptions(cards, "pokemon").map(o => o.key), ["Base Set", "Prismatic Evolutions", "Surging Sparks"]);
});

test("page windows clamp the requested page into range", () => {
  const rows = Array.from({ length: 7 }, (_, i) => i + 1);
  assert.deepEqual(pageWindow(rows, 1, 3), { pages: 3, page: 1, rows: [1, 2, 3] });
  assert.deepEqual(pageWindow(rows, 3, 3), { pages: 3, page: 3, rows: [7] });
  assert.deepEqual(pageWindow(rows, 9, 3), { pages: 3, page: 3, rows: [7] });
  assert.deepEqual(pageWindow([], 4, 30), { pages: 1, page: 1, rows: [] });
  assert.deepEqual(pageWindow(rows, 0, 0), { pages: 7, page: 1, rows: [1] });
});
