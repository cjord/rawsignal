import assert from "node:assert/strict";
import test from "node:test";
import { buildDetailFeeds, fallbackCardEnrichment, fallbackSealedEnrichment, productEnrichment } from "../scripts/details/enrichment.mjs";
import { parseCatalogDetailEnrichments } from "../app/domain/contracts.ts";

const group = { groupId: 24688, abbreviation: "PBL", publishedOn: "2026-07-17T00:00:00" };
const product = {
  productId: 692938,
  modifiedOn: "2026-07-17T04:10:35.46",
  imageCount: 1,
  presaleInfo: { isPresale: false, note: null },
  extendedData: [
    { name: "CardText", displayName: "Card Text", value: "Three packs and a promo." },
    { name: "UPC", displayName: "UPC", value: 196214157477 },
    { name: "Empty", displayName: "Empty", value: "  " },
    { name: "Description", displayName: "Description", value: 'Draw 1.<br><br><span style="color: red;">Non-foil &amp; promo only.</span>' },
  ],
};
const prices = [
  { productId: 692938, subTypeName: "Normal", marketPrice: 22.74, lowPrice: 17.95, directLowPrice: null, midPrice: 24.72, highPrice: 55 },
  { productId: 692938, subTypeName: "Foil", marketPrice: Number.NaN, lowPrice: undefined, directLowPrice: 30, midPrice: null, highPrice: 90 },
];
const card = (productId, overrides = {}) => ({
  productId, game: "pokemon", section: "illustration-rares", rarity: "Illustration Rare",
  name: `Card ${productId}`, set: "Test Set", year: 2025, number: `${productId}/100`,
  printing: "Holofoil", marketPrice: 10, lowPrice: 8, midPrice: 10, highPrice: 14,
  image: null, url: "https://www.tcgplayer.com/product/1", ...overrides,
});
const sealed = (productId, overrides = {}) => ({
  productId, game: "pokemon", category: "Elite Trainer Boxes", name: `Product ${productId}`,
  set: "Test Set", image: null, url: "https://www.tcgplayer.com/product/2",
  msrp: null, marketPrice: 49.99, midPrice: 54.99, profit: null, profitPct: null, msrpSource: null, ...overrides,
});

test("productEnrichment maps TCGCSV metadata, printing prices, and source provenance", () => {
  const enrichment = productEnrichment({ kind: "sealed", product, prices, group, categoryId: 3, sourceUpdatedAt: "2026-08-26T20:06:18+0000" });
  assert.deepEqual(enrichment.metadata, [
    { name: "CardText", label: "Card Text", value: "Three packs and a promo." },
    { name: "UPC", label: "UPC", value: "196214157477" },
    { name: "Description", label: "Description", value: "Draw 1.\n\nNon-foil & promo only." },
  ]);
  assert.deepEqual(enrichment.priceVariants, [
    { printing: "Normal", marketPrice: 22.74, lowPrice: 17.95, directLowPrice: null, midPrice: 24.72, highPrice: 55 },
    { printing: "Foil", marketPrice: null, lowPrice: null, directLowPrice: 30, midPrice: null, highPrice: 90 },
  ]);
  assert.deepEqual(enrichment.source, {
    categoryId: 3, groupId: 24688, setAbbreviation: "PBL", publishedOn: "2026-07-17T00:00:00",
    modifiedOn: "2026-07-17T04:10:35.46", imageCount: 1, isPresale: false, presaleNote: null,
    sourceUpdatedAt: "2026-08-26T20:06:18+0000",
  });
  assert.equal(parseCatalogDetailEnrichments([enrichment]).length, 1);
});

test("fallback enrichments carry feed prices with a null source and satisfy the contract", () => {
  const single = fallbackCardEnrichment(card(670598, { game: "riftbound", printing: "Foil", marketPrice: 684.89, lowPrice: 594.99, midPrice: 879.99, highPrice: 2500 }));
  assert.deepEqual(single.priceVariants, [{ printing: "Foil", marketPrice: 684.89, lowPrice: 594.99, directLowPrice: null, midPrice: 879.99, highPrice: 2500 }]);
  assert.equal(single.source.categoryId, null);
  const box = fallbackSealedEnrichment(sealed(690384, { game: "lorcana", marketPrice: 204.49, midPrice: 219.95 }));
  assert.deepEqual(box.priceVariants, [{ printing: "Sealed", marketPrice: 204.49, lowPrice: null, directLowPrice: null, midPrice: 219.95, highPrice: null }]);
  assert.equal(parseCatalogDetailEnrichments([single, box]).length, 2);
});

test("buildDetailFeeds routes matched products to group chunks and the rest to per-game fallbacks", () => {
  const { manifest, chunks, stats } = buildDetailFeeds({
    singles: [card(692001), card(670598, { game: "riftbound" })],
    sealed: [sealed(692938), sealed(690384, { game: "lorcana" })],
    groups: [{
      categoryId: 3,
      group,
      products: [product, { ...product, productId: 692001 }, { ...product, productId: 999999 }],
      prices,
    }],
    sourceUpdatedAt: "2026-08-26T20:06:18+0000",
  });
  assert.deepEqual(manifest, {
    "sealed:690384": "/data/details/fallback-sealed-lorcana.json",
    "sealed:692938": "/data/details/3-24688.json",
    "single:670598": "/data/details/fallback-single-riftbound.json",
    "single:692001": "/data/details/3-24688.json",
  });
  assert.deepEqual(chunks["3-24688.json"].map(row => [row.kind, row.productId]), [["single", 692001], ["sealed", 692938]]);
  assert.equal(chunks["3-24688.json"].every(row => row.source.groupId === 24688), true);
  assert.deepEqual(stats, { entries: 4, enriched: 2, fallback: 2 });
  for (const rows of Object.values(chunks)) parseCatalogDetailEnrichments(rows);
});

test("buildDetailFeeds keeps the first group's enrichment when a product repeats across groups", () => {
  const later = { groupId: 24700, abbreviation: "XXX", publishedOn: "2026-08-01T00:00:00" };
  const { manifest, chunks } = buildDetailFeeds({
    singles: [],
    sealed: [sealed(692938)],
    groups: [
      { categoryId: 3, group, products: [product], prices },
      { categoryId: 3, group: later, products: [product], prices },
    ],
  });
  assert.equal(manifest["sealed:692938"], "/data/details/3-24688.json");
  assert.equal("3-24700.json" in chunks, false);
});
