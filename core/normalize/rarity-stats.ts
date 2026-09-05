import { preferredPrices, riftboundSection, type SinglesPriceRow, type SinglesSourceProduct } from "./singles.ts";

// Per-tier aggregate of one TCGCSV group (todo J2, "Where the value sits"): every card in the
// group counts — the bulk commons, uncommons, and rares the catalog never tracks included —
// so a set's pack value can be priced tier by tier without a catalog row per common. Uses
// the singles normalizer's own price choice (the highest priced printing) so tracked tiers
// agree with the leaderboards. A card is anything with a rarity and a collector number;
// unpriced cards count toward `cardCount` but not `sumCents` (the average then "divides by
// every card", the honest reading for genuine bulk).
export type GroupRarityStat = { tier: string; rarity: string; section: string | null; cardCount: number; pricedCount: number; sumCents: number; topCents: number | null; topProductId: number | null };

const extended = (product: SinglesSourceProduct, key: string) => String(product.extendedData?.find(item => item.name === key)?.value ?? "");

// Riftbound's showcase tiers and its rares share rarity strings ("Showcase", "Rare"), so
// their tier is the section slug the normalizer derives from the product name; every other
// game keys tiers by the rarity string the pull-rate config uses.
export function tierFor(game: string, productName: string, rarity: string): { tier: string; section: string | null } {
  if (game === "riftbound") {
    const section = riftboundSection(productName, rarity)?.[0] ?? null;
    return { tier: section ?? rarity, section };
  }
  return { tier: rarity, section: null };
}

export function summarizeGroupRarities({ game, products, prices }: { game: string; products: SinglesSourceProduct[]; prices: SinglesPriceRow[] }): GroupRarityStat[] {
  const priceById = preferredPrices(prices);
  const tiers = new Map<string, GroupRarityStat>();
  for (const product of products) {
    const rarity = extended(product, "Rarity"), number = extended(product, "Number");
    if (!rarity || !number) continue;
    const { tier, section } = tierFor(game, product.name, rarity);
    const entry = tiers.get(tier) ?? { tier, rarity, section, cardCount: 0, pricedCount: 0, sumCents: 0, topCents: null, topProductId: null };
    entry.cardCount++;
    const price = priceById.get(Number(product.productId));
    if (price) {
      const cents = Math.round(Number(price.marketPrice) * 100);
      entry.pricedCount++;
      entry.sumCents += cents;
      if (entry.topCents == null || cents > entry.topCents) { entry.topCents = cents; entry.topProductId = Number(product.productId); }
    }
    tiers.set(tier, entry);
  }
  return [...tiers.values()].sort((a, b) => a.tier.localeCompare(b.tier));
}
