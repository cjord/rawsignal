// Chase EV per pack (audit Phase C): the expected value of a pack's tracked chase slots —
// the sum over pull-rate tiers of (average tier card price ÷ packs per hit). Bulk commons
// are not tracked, so this is a floor on pack value; every surface labels it a
// community-estimate derivation, per the pull-rate data rules.

export type EvTier = { packsPerHit: number; averageMarket: number | null };

export function packChaseEv(tiers: EvTier[]): number | null {
  const parts = tiers.filter(tier => tier.packsPerHit > 0 && tier.averageMarket != null);
  if (!parts.length) return null;
  return parts.reduce((sum, tier) => sum + (tier.averageMarket as number) / tier.packsPerHit, 0);
}

// Ratio above 1 means ripping beats buying the singles at current prices (before bulk).
export function evRatio(ev: number | null, packPrice: number | null): number | null {
  return ev != null && packPrice != null && packPrice > 0 ? ev / packPrice : null;
}

// "Where the value sits" (todo J2): per-tier pack value with bulk included. A guaranteed slot
// tier is worth its average × cards per pack; a chase tier its average ÷ packs per hit. The
// average divides the priced sum by EVERY card in the tier (unpriced counts as zero — honest
// for bulk, and it understates rather than overstates). Tiers with neither kind of odds are
// listed as unrated and sit outside the total; the implied pack size (Σ slots + Σ 1/odds) is
// the check that a curated composition matches the printed pack.
export type BreakdownInput = {
  key: string; label: string; perPack: number | null; packsPerHit: number | null;
  cardCount: number; pricedCount: number; sumMarket: number; topMarket: number | null; topProductId: number | null;
  chase?: boolean;
};
export type BreakdownTier = BreakdownInput & { kind: "slot" | "chase" | "unrated"; average: number | null; evPerPack: number | null; share: number | null; chase: boolean };
export type Breakdown = { tiers: BreakdownTier[]; totalEv: number; chaseEv: number; chaseShare: number | null; impliedPackSize: number; unratedTiers: string[] };

export function packValueBreakdown(inputs: BreakdownInput[]): Breakdown | null {
  const tiers: BreakdownTier[] = inputs.map(input => {
    const kind: BreakdownTier["kind"] = input.perPack != null && input.perPack > 0 ? "slot" : input.packsPerHit != null && input.packsPerHit > 0 ? "chase" : "unrated";
    const average = input.cardCount > 0 ? input.sumMarket / input.cardCount : null;
    const evPerPack = average == null || kind === "unrated" ? null : kind === "slot" ? average * (input.perPack as number) : average / (input.packsPerHit as number);
    return { ...input, kind, average, evPerPack, share: null, chase: input.chase ?? kind === "chase" };
  });
  const rated = tiers.filter(tier => tier.evPerPack != null);
  if (!rated.length) return null;
  const totalEv = rated.reduce((sum, tier) => sum + (tier.evPerPack as number), 0);
  const chaseEv = rated.filter(tier => tier.chase).reduce((sum, tier) => sum + (tier.evPerPack as number), 0);
  for (const tier of tiers) tier.share = tier.evPerPack != null && totalEv > 0 ? tier.evPerPack / totalEv : null;
  const impliedPackSize = tiers.reduce((sum, tier) => sum + (tier.kind === "slot" ? (tier.perPack as number) : tier.kind === "chase" ? 1 / (tier.packsPerHit as number) : 0), 0);
  return { tiers, totalEv, chaseEv, chaseShare: totalEv > 0 ? chaseEv / totalEv : null, impliedPackSize, unratedTiers: tiers.filter(tier => tier.kind === "unrated").map(tier => tier.label) };
}
