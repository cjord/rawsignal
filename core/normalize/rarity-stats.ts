import { riftboundSection, type SinglesPriceRow, type SinglesSourceProduct } from "./singles.ts";

// Per-tier aggregate of one TCGCSV group (todo J2, "Where the value sits"): every card in the
// group counts — the bulk commons, uncommons, and rares the catalog never tracks included —
// so a set's pack value can be priced tier by tier without a catalog row per common. Uses
// ordinary printing, excluding reverse/parallel premiums. A card has a rarity and number;
// unpriced cards count toward `cardCount` but not `sumCents`. Incomplete tiers are unvalued.
export type GroupRarityStat = { tier: string; rarity: string; section: string | null; cardCount: number; pricedCount: number; sumCents: number; topCents: number | null; topProductId: number | null };

const extended = (product: SinglesSourceProduct, key: string) => String(product.extendedData?.find(item => item.name === key)?.value ?? "");

// Riftbound's showcase tiers and its rares share rarity strings ("Showcase", "Rare"), so
// their tier is the section slug the normalizer derives from the product name; every other
// game keys tiers by the rarity string the pull-rate config uses.
export function tierFor(game: string, productName: string, rarity: string): { tier: string; section: string | null } {
  if (game === "riftbound") {
    const candidate = riftboundSection(productName, rarity)?.[0] ?? null;
    // Catalog expansion must not rename existing pack tiers (Common/Uncommon/Promo).
    const section = candidate?.startsWith("riftbound-") ? null : candidate;
    return { tier: section ?? rarity, section };
  }
  return { tier: rarity, section: null };
}

// An ordinary slot never receives a reverse/Master Ball/parallel price. If the ordinary
// printing exists but is unpriced, keep it unavailable instead of falling back to foil.
export function ordinaryPackPrice(rows: SinglesPriceRow[], rarity: string): number | null {
  const normal = rows.find(row => row.subTypeName === "Normal");
  const foil = rows.find(row => row.subTypeName === "Holofoil" || row.subTypeName === "Foil");
  const row = /^(Common|Uncommon)$/i.test(rarity) ? normal : normal ?? foil;
  const price = Number(row?.marketPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function summarizeGroupRarities({ game, products, prices }: { game: string; products: SinglesSourceProduct[]; prices: SinglesPriceRow[] }): GroupRarityStat[] {
  const priceById = new Map<number, SinglesPriceRow[]>();
  for (const row of prices) {
    const id = Number(row.productId), rows = priceById.get(id) ?? [];
    rows.push(row); priceById.set(id, rows);
  }
  const tiers = new Map<string, GroupRarityStat>();
  for (const product of products) {
    const rarity = extended(product, "Rarity"), number = extended(product, "Number");
    if (!rarity || !number) continue;
    const { tier, section } = tierFor(game, product.name, rarity);
    const entry = tiers.get(tier) ?? { tier, rarity, section, cardCount: 0, pricedCount: 0, sumCents: 0, topCents: null, topProductId: null };
    entry.cardCount++;
    const price = ordinaryPackPrice(priceById.get(Number(product.productId)) ?? [], rarity);
    if (price != null) {
      const cents = Math.round(price * 100);
      entry.pricedCount++;
      entry.sumCents += cents;
      if (entry.topCents == null || cents > entry.topCents) { entry.topCents = cents; entry.topProductId = Number(product.productId); }
    }
    tiers.set(tier, entry);
  }
  return [...tiers.values()].sort((a, b) => a.tier.localeCompare(b.tier));
}
