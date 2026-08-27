import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryCatalogRepository } from "../app/data/catalog-repository.ts";

const card = (productId, overrides = {}) => ({
  productId, game: "pokemon", section: "illustration-rares", rarity: "Illustration Rare",
  name: `Card ${productId}`, set: "Test Set", year: 2025, number: `${productId}/100`,
  printing: "Holofoil", marketPrice: 10, lowPrice: 8, midPrice: 10, highPrice: 14,
  image: null, url: "https://www.tcgplayer.com/product/1", ...overrides,
});
const sealed = (productId, overrides = {}) => ({
  productId, game: "pokemon", category: "Elite Trainer Boxes", name: `Product ${productId}`,
  set: "Test Set", msrp: 49.99, msrpSource: null, marketPrice: 80, midPrice: 82,
  profit: null, profitPct: null, image: null, url: "https://www.tcgplayer.com/product/2", ...overrides,
});

test("single-card peer context averages the same rarity and excludes the card itself", async () => {
  const repository = createMemoryCatalogRepository([
    card(1, { marketPrice: 100 }),
    card(2, { marketPrice: 40 }),
    card(3, { marketPrice: 60 }),
    card(4, { rarity: "Special Illustration Rare", marketPrice: 900 }),
    card(5, { game: "riftbound", marketPrice: 900 }),
  ], []);
  const detail = await repository.getDetail("single", 1);
  assert.equal(detail.peerContext.label, "Illustration Rare cards");
  assert.equal(detail.peerContext.count, 2);
  assert.equal(detail.peerContext.averagePrice, 50);
});

test("sealed peer context averages the same product type and skips unavailable prices", async () => {
  const repository = createMemoryCatalogRepository([], [
    sealed(1, { marketPrice: 100 }),
    sealed(2, { marketPrice: 60 }),
    sealed(3, { marketPrice: null }),
    sealed(4, { category: "Booster Boxes", marketPrice: 500 }),
  ]);
  const detail = await repository.getDetail("sealed", 1, "pokemon");
  assert.equal(detail.peerContext.label, "Elite Trainer Boxes");
  assert.equal(detail.peerContext.count, 1);
  assert.equal(detail.peerContext.averagePrice, 60);
});

test("peer context reports no average when every peer price is unavailable", async () => {
  const repository = createMemoryCatalogRepository([], [
    sealed(1, { marketPrice: 100 }),
    sealed(2, { marketPrice: null }),
  ]);
  const detail = await repository.getDetail("sealed", 1, "pokemon");
  assert.equal(detail.peerContext.averagePrice, null);
  assert.equal(detail.peerContext.count, 0);
});
