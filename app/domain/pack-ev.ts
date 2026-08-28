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
