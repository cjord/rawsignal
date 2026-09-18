import { perPackFor, pullRateFor } from "../catalog-repository.ts";
import { packValueBreakdown } from "./pack-ev.ts";
import type { PullRateConfig, SetRarityStat, ValueBreakdown } from "./types.ts";
import { packProfileFor } from "./pack-profile.ts";

// Assembles a set's "Where the value sits" breakdown (todo J2) from its `set_rarity_stats`
// rows and the curated pack odds: each tier resolves cards-per-pack (`perPack`) or packs-per-hit
// with the pull-rate rules (section slug first, then rarity, set override before game default).
// Tiers are ordered the way a pack reads — bulk first, chase last — so the share bars form a
// ladder; unknown tiers follow alphabetically.

const TIER_ORDER: Record<string, string[]> = {
  riftbound: ["Common", "Uncommon", "rares", "epics", "alt-arts", "overnumbered", "signatures", "Promo"],
  pokemon: ["Common", "Uncommon", "Rare", "Holo Rare", "Reverse Holofoil", "Double Rare", "Ultra Rare", "Illustration Rare", "Special Illustration Rare", "Shiny Rare", "Shiny Holo Rare", "Shiny Ultra Rare", "Radiant Rare", "Amazing Rare", "Prism Rare", "Secret Rare", "Rainbow Rare", "Hyper Rare", "Mega Hyper Rare", "Black White Rare", "Promo"],
};
const SECTION_LABELS: Record<string, string> = { rares: "Rare", epics: "Epic", "alt-arts": "Alt art", overnumbered: "Over-numbered", signatures: "Signature" };
// The tiers that carry the CHASE badge and make up "chase prints are X% of EV": the premium
// print tiers, not every odds-based tier (Riftbound's Epics and Pokémon's double/ultra rares
// are regular pulls). Curated here, next to the tier order.
const CHASE_TIERS: Record<string, string[]> = {
  riftbound: ["alt-arts", "overnumbered", "signatures"],
  pokemon: ["Illustration Rare", "Special Illustration Rare", "Shiny Rare", "Shiny Holo Rare", "Shiny Ultra Rare", "Radiant Rare", "Amazing Rare", "Prism Rare", "Secret Rare", "Rainbow Rare", "Hyper Rare", "Mega Hyper Rare", "Black White Rare"],
};
export const isChaseTier = (game: string, tier: string) => (CHASE_TIERS[game] ?? []).includes(tier);

export const tierLabel = (stat: Pick<SetRarityStat, "tier" | "rarity">) => SECTION_LABELS[stat.tier] ?? stat.rarity;

export function tierRank(game: string, tier: string): number {
  const index = (TIER_ORDER[game] ?? []).indexOf(tier);
  return index >= 0 ? index : 1000;
}

// `era` is the set's era key (Pokémon: `pokemonEra`/`setGroupKey`); the config's era tables sit
// between a set's own override and the game default.
export function buildValueBreakdown(config: PullRateConfig | undefined, game: string, set: string, stats: SetRarityStat[], era?: string | null): ValueBreakdown | null {
  if (!stats.length) return null;
  const ordered = [...stats].sort((a, b) => tierRank(game, a.tier) - tierRank(game, b.tier) || a.tier.localeCompare(b.tier));
  const breakdown = packValueBreakdown(ordered.map(stat => {
    const card = { rarity: stat.rarity, section: stat.section ?? undefined };
    return {
      key: stat.tier, label: tierLabel(stat),
      perPack: perPackFor(config, game, set, card, era)?.perPack ?? null,
      packsPerHit: pullRateFor(config, game, set, card, era)?.packsPerHit ?? null,
      cardCount: stat.cardCount, pricedCount: stat.pricedCount, sumMarket: stat.sumMarket, topMarket: stat.topMarket, topProductId: stat.topProductId,
      chase: isChaseTier(game, stat.tier),
    };
  }));
  if (!breakdown) return null;
  const profile = packProfileFor(config, game, set);
  const expected = new Set([...Object.keys(config?.games[game]?.sets[set] ?? {}), ...Object.keys(config?.games[game]?.perPack?.sets[set] ?? {})]);
  for (const stat of stats) { expected.delete(stat.tier); expected.delete(stat.rarity); }
  return { ...breakdown, partial: true, cardsPerPack: profile?.cardsPerPack ?? null, missingTiers: [...expected], updatedAt: stats.reduce<string | null>((latest, stat) => latest == null || stat.updatedAt > latest ? stat.updatedAt : latest, null) };
}
