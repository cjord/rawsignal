import test from "node:test";
import assert from "node:assert/strict";
import { buildRiftboundPairMetrics, riftboundPriceWarning } from "../core/domain/riftbound-pairs.ts";

const card = (productId, section, name, set, number, marketPrice, prices = {}) => ({
  game: "riftbound",
  section,
  productId,
  name: `${name} (${section === "signatures" ? "Signature" : "Overnumbered"})`,
  set,
  year: 2026,
  rarity: "Showcase",
  number,
  image: "https://example.com/card.jpg",
  url: "https://example.com/card",
  marketPrice,
  lowPrice: prices.lowPrice ?? marketPrice,
  midPrice: prices.midPrice ?? marketPrice,
  highPrice: prices.highPrice ?? marketPrice,
  printing: "Foil",
  priceChange: null,
});

test("Riftbound pairs require the same normalized set, name, and collector number", () => {
  const cards = [
    card(1, "signatures", "Ahri", "Origins", "301*/298", 100),
    card(2, "overnumbered", "Ahri", "Origins", "301/298", 20),
    card(3, "signatures", "Jinx", "Origins", "302*/298", 90),
    card(4, "overnumbered", "Jinx", "Origins", "302/298", 30),
    card(5, "signatures", "Lux", "Spiritforged", "225*/221", 80),
    card(6, "overnumbered", "Lux", "Spiritforged", "225/221", 10),
    card(7, "signatures", "Wrong number", "Origins", "999*/298", 50),
    card(8, "overnumbered", "Wrong number", "Origins", "998/298", 10),
  ];

  const metrics = buildRiftboundPairMetrics(cards);
  assert.equal(metrics.size, 6);
  assert.equal(metrics.has(7), false);
  assert.equal(metrics.has(8), false);

  const ahri = metrics.get(1);
  assert.equal(ahri.multiplier, 5);
  assert.equal(ahri.averageMultiplier, 16 / 3);
  assert.equal(ahri.setAverageMultiplier, 4);
  assert.equal(ahri.differenceFromAverage, 5 - 16 / 3);
  assert.equal(ahri.differenceFromSetAverage, 1);
  assert.equal(ahri.pairCount, 3);
  assert.equal(ahri.setPairCount, 2);
  assert.equal(ahri.counterpartProductId, 2);
  assert.equal(metrics.get(2).counterpartProductId, 1);
});

test("ambiguous duplicate pair groups fail closed", () => {
  const cards = [
    card(1, "signatures", "Ahri", "Origins", "301*/298", 100),
    card(2, "signatures", "Ahri", "Origins", "301*/298", 110),
    card(3, "overnumbered", "Ahri", "Origins", "301/298", 20),
  ];
  assert.equal(buildRiftboundPairMetrics(cards).size, 0);
});

test("price warnings report material Median disagreement without changing the price basis", () => {
  const wide = card(1, "signatures", "Ahri", "Origins", "301*/298", 100, { lowPrice: 80, midPrice: 150 });
  assert.deepEqual(riftboundPriceWarning(wide), {
    medianPrice: 150,
    market: { price: 100, differencePct: 50 },
    listingLow: { price: 80, differencePct: 87.5 },
  });

  const close = card(2, "overnumbered", "Ahri", "Origins", "301/298", 100, { lowPrice: 95, midPrice: 110 });
  assert.equal(riftboundPriceWarning(close), null);
  assert.equal(riftboundPriceWarning({ ...wide, game: "pokemon" }), null);
});
