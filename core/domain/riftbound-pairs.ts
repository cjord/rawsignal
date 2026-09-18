import type { Card, RiftboundPairMetrics } from "./types.ts";
import { hasMarketPrice } from "./prices.ts";

const PAIR_SECTIONS = new Set(["signatures", "overnumbered"]);

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

type PricedCard = Card & { marketPrice: number };
type EligiblePair = { signature: PricedCard; overnumbered: PricedCard; multiplier: number };

/**
 * Pair Riftbound Signature and Overnumbered printings conservatively. A title alone is
 * insufficient: set and collector number (with the Signature asterisk removed) must
 * match, and ambiguous duplicate groups fail closed.
 */
export function buildRiftboundPairMetrics(cards: readonly Card[]): Map<number, RiftboundPairMetrics> {
  const groups = new Map<string, PricedCard[]>();
  for (const card of cards) {
    if (card.game !== "riftbound" || !PAIR_SECTIONS.has(card.section) || !hasMarketPrice(card)) continue;
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
