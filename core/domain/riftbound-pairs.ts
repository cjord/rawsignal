import type { Card } from "./types.ts";

const PAIR_SECTIONS = new Set(["signatures", "overnumbered"]);

export type RiftboundPairMetrics = {
  counterpartProductId: number;
  counterpartMarketPrice: number;
  signatureMarketPrice: number;
  overnumberedMarketPrice: number;
  multiplier: number;
  averageMultiplier: number;
  setAverageMultiplier: number;
  differenceFromAverage: number;
  differenceFromSetAverage: number;
  pairCount: number;
  setPairCount: number;
};

export type PriceReferenceDifference = {
  price: number;
  differencePct: number;
};

export type RiftboundPriceWarning = {
  medianPrice: number;
  market: PriceReferenceDifference | null;
  listingLow: PriceReferenceDifference | null;
};

const positive = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0;

const normalizedName = (name: string) =>
  name
    .replace(/\s*\((signature|overnumbered)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizedNumber = (number: string) =>
  number.replace(/\*/g, "").replace(/\s+/g, "").toUpperCase();

const normalizedSet = (set: string) => set.replace(/\s+/g, " ").trim().toLowerCase();

const pairKey = (card: Card) =>
  `${normalizedSet(card.set)}\u0000${normalizedName(card.name)}\u0000${normalizedNumber(card.number)}`;

type EligiblePair = { signature: Card; overnumbered: Card; multiplier: number };

/**
 * Pair Riftbound Signature and Overnumbered printings conservatively. A title alone is
 * insufficient: set and collector number (with the Signature asterisk removed) must
 * match, and ambiguous duplicate groups fail closed.
 */
export function buildRiftboundPairMetrics(cards: readonly Card[]): Map<number, RiftboundPairMetrics> {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    if (card.game !== "riftbound" || !PAIR_SECTIONS.has(card.section) || !positive(card.marketPrice)) continue;
    const key = pairKey(card), group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }

  const pairs: EligiblePair[] = [];
  for (const group of groups.values()) {
    const signatures = group.filter(card => card.section === "signatures");
    const overnumbered = group.filter(card => card.section === "overnumbered");
    if (signatures.length !== 1 || overnumbered.length !== 1) continue;
    pairs.push({
      signature: signatures[0],
      overnumbered: overnumbered[0],
      multiplier: signatures[0].marketPrice / overnumbered[0].marketPrice,
    });
  }
  if (!pairs.length) return new Map();

  const averageMultiplier = pairs.reduce((sum, pair) => sum + pair.multiplier, 0) / pairs.length;
  const bySet = new Map<string, EligiblePair[]>();
  for (const pair of pairs) {
    const key = normalizedSet(pair.signature.set), group = bySet.get(key) ?? [];
    group.push(pair);
    bySet.set(key, group);
  }

  const metrics = new Map<number, RiftboundPairMetrics>();
  for (const pair of pairs) {
    const setPairs = bySet.get(normalizedSet(pair.signature.set)) ?? [pair];
    const setAverageMultiplier = setPairs.reduce((sum, item) => sum + item.multiplier, 0) / setPairs.length;
    const common = {
      signatureMarketPrice: pair.signature.marketPrice,
      overnumberedMarketPrice: pair.overnumbered.marketPrice,
      multiplier: pair.multiplier,
      averageMultiplier,
      setAverageMultiplier,
      differenceFromAverage: pair.multiplier - averageMultiplier,
      differenceFromSetAverage: pair.multiplier - setAverageMultiplier,
      pairCount: pairs.length,
      setPairCount: setPairs.length,
    };
    metrics.set(pair.signature.productId, {
      ...common,
      counterpartProductId: pair.overnumbered.productId,
      counterpartMarketPrice: pair.overnumbered.marketPrice,
    });
    metrics.set(pair.overnumbered.productId, {
      ...common,
      counterpartProductId: pair.signature.productId,
      counterpartMarketPrice: pair.signature.marketPrice,
    });
  }
  return metrics;
}

/**
 * Report only material price-reference disagreement. Market remains the trend basis;
 * this warning gives the current asking-price references equal visibility without
 * silently blending them into a synthetic valuation.
 */
export function riftboundPriceWarning(card: Pick<Card, "game" | "section" | "marketPrice" | "lowPrice" | "midPrice">, threshold = 0.2): RiftboundPriceWarning | null {
  if (card.game !== "riftbound" || !PAIR_SECTIONS.has(card.section) || !positive(card.midPrice)) return null;
  const compare = (price: number | null): PriceReferenceDifference | null => {
    if (!positive(price)) return null;
    const differencePct = (card.midPrice! / price - 1) * 100;
    return Math.abs(differencePct) >= threshold * 100 ? { price, differencePct } : null;
  };
  const market = compare(card.marketPrice), listingLow = compare(card.lowPrice);
  return market || listingLow ? { medianPrice: card.midPrice, market, listingLow } : null;
}
