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

test("set-scoped peer context averages only the same set and rarity", async () => {
  const repository = createMemoryCatalogRepository([
    card(1, { marketPrice: 100 }),
    card(2, { marketPrice: 40 }),
    card(3, { set: "Other Set", marketPrice: 900 }),
    card(4, { rarity: "Special Illustration Rare", marketPrice: 900 }),
  ], []);
  const detail = await repository.getDetail("single", 1);
  assert.equal(detail.setPeerContext.label, "Illustration Rare cards in Test Set");
  assert.equal(detail.setPeerContext.count, 1);
  assert.equal(detail.setPeerContext.averagePrice, 40);
});

test("chase cards use the cheapest pack price as cutoff and cap at twelve", async () => {
  const cards = [
    ...Array.from({ length: 20 }, (_, index) => card(100 + index, { marketPrice: 50 - index })),
    card(200, { marketPrice: 3 }),
    card(201, { set: "Other Set", marketPrice: 500 }),
  ];
  const products = [
    sealed(1, { category: "Elite Trainer Boxes", marketPrice: 80 }),
    sealed(2, { category: "Booster Packs", marketPrice: 9 }),
    sealed(3, { category: "Booster Packs", marketPrice: 14, name: "Sleeved Booster" }),
  ];
  const detail = await repository(cards, products).getDetail("sealed", 1, "pokemon");
  assert.equal(detail.packPrice, 9);
  assert.equal(detail.chaseCards.length, 12);
  assert.ok(detail.chaseCards.every(item => item.marketPrice > 9 && item.set === "Test Set"));
  assert.equal(detail.chaseCards[0].marketPrice, 50);
});

test("chase cards fall back to the top of the set when no pack price exists", async () => {
  const detail = await repository(
    [card(1, { marketPrice: 4 }), card(2, { marketPrice: 2 })],
    [sealed(1, { marketPrice: 80 })],
  ).getDetail("sealed", 1, "pokemon");
  assert.equal(detail.packPrice, null);
  assert.deepEqual(detail.chaseCards.map(item => item.productId), [1, 2]);
});

test("related sealed lists the same set sorted by market and excludes the product", async () => {
  const detail = await repository([], [
    sealed(1, { marketPrice: 80 }),
    sealed(2, { marketPrice: 300, category: "Booster Boxes" }),
    sealed(3, { marketPrice: null, category: "Tins" }),
    sealed(4, { set: "Other Set", marketPrice: 900 }),
  ]).getDetail("sealed", 1, "pokemon");
  assert.deepEqual(detail.relatedSealed.map(item => item.productId), [2, 3]);
});

const repository = (cards, products) => createMemoryCatalogRepository(cards, products);

test("peer context reports no average when every peer price is unavailable", async () => {
  const repository = createMemoryCatalogRepository([], [
    sealed(1, { marketPrice: 100 }),
    sealed(2, { marketPrice: null }),
  ]);
  const detail = await repository.getDetail("sealed", 1, "pokemon");
  assert.equal(detail.peerContext.averagePrice, null);
  assert.equal(detail.peerContext.count, 0);
});

test("section-keyed pull rates distinguish tiers that share a rarity string", async () => {
  const config = { games: { riftbound: { default: { signatures: 720, overnumbered: 72 }, sets: {} } } };
  const cards = [
    card(1, { game: "riftbound", rarity: "Showcase", section: "signatures", marketPrice: 400 }),
    card(2, { game: "riftbound", rarity: "Showcase", section: "signatures", marketPrice: 200 }),
    card(3, { game: "riftbound", rarity: "Showcase", section: "overnumbered", marketPrice: 50 }),
  ];
  const products = [sealed(9, { game: "riftbound", category: "Booster Packs", marketPrice: 5 })];
  const repo = createMemoryCatalogRepository(cards, products, [], config);
  const detail = await repo.getDetail("single", 1);
  assert.equal(detail.pullRate.packsPerHit, 720);
  assert.equal(detail.pullRate.packsPerCard, 1440);
  assert.equal(detail.pullRate.costPerCard, 7200);
  const sealedDetail = await repo.getDetail("sealed", 9, "riftbound");
  const rows = Object.fromEntries(sealedDetail.pullRates.map(r => [r.rarity, r]));
  assert.equal(rows.Signatures.cardCount, 2);
  assert.equal(rows.Signatures.costPerHit, 3600);
  assert.equal(rows.Overnumbered.cardCount, 1);
});
