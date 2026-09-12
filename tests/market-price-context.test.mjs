import test from "node:test";
import assert from "node:assert/strict";
import { marketPriceWarning } from "../core/domain/market-price-context.ts";

test("Singles and Sealed warn when Market differs from Listed Median by at least 15%", () => {
  for (const item of [
    { marketPrice: 85, midPrice: 100 },
    { marketPrice: 115, midPrice: 100 },
  ]) assert.ok(marketPriceWarning(item));
  assert.deepEqual(marketPriceWarning({ marketPrice: 85, midPrice: 100 }), {
    medianPrice: 100,
    marketPrice: 85,
    marketDifferencePct: -15,
  });
  assert.deepEqual(marketPriceWarning({ marketPrice: 115, midPrice: 100 }), {
    medianPrice: 100,
    marketPrice: 115,
    marketDifferencePct: 15,
  });
  assert.equal(marketPriceWarning({ marketPrice: 86, midPrice: 100 }), null);
  assert.equal(marketPriceWarning({ marketPrice: 114, midPrice: 100 }), null);
});

test("price warnings ignore listing lows and require both price references", () => {
  assert.equal(marketPriceWarning({ marketPrice: 100, midPrice: null }), null);
  assert.equal(marketPriceWarning({ marketPrice: 0, midPrice: 100 }), null);
  assert.equal(marketPriceWarning({ marketPrice: 100, midPrice: 100 }), null);
});
