// New-release guidance constants (todo P7), curated from the release-curve study
// (`scripts/release-curves/study.mjs`, docs/backtests.md). Values are the CURRENT-era
// median settled ratios (day-30/day-60 price vs the launch-week reference) — the
// 2026H1 cells, i.e. the post-shortage normalized market. Regenerate after each set
// launch via the study; per the P7 normalization rule these are inputs, never
// per-set parameters.
export type ReleaseSettle = { d30: number; d60: number };
export const RELEASE_SETTLE: Record<string, Record<string, ReleaseSettle>> = {
  pokemon: {
    "Special Illustration Rare": { d30: .71, d60: .65 },
    "Illustration Rare": { d30: .58, d60: .50 },
    "Ultra Rare": { d30: .58, d60: .41 },
    "Hyper Rare": { d30: .81, d60: .78 },
  },
};

// Marquee-chase display band (study: mainline SIR-class chases settled 2–19× their
// in-set rarity cohort at day 60; Mega Hyper Rare chases far higher). Shown as context
// on chase-class rarities — the EVE range deliberately EXCLUDES this premium.
export const MARQUEE_CHASE_RARITIES = new Set(["Special Illustration Rare", "Mega Hyper Rare", "Hyper Rare"]);
export const MARQUEE_BAND = "2–19×";

// Sets whose pricing has no meaningful cohort analog (EVE validation losers):
// promos, academy/calendar/program products, fast-food tie-ins, special premium sets.
export const eveIneligibleSet = (setName: string, rarity: string | null) =>
  /promo|academy|calendar|program|mcdonald|celebration/i.test(setName) || rarity === "Promo";

export const releaseGuidance = (game: string, rarity: string | null): string | null => {
  const settle = rarity ? RELEASE_SETTLE[game]?.[rarity] : null;
  if (!settle) return null;
  return `${rarity} cards have recently settled around ${Math.round(settle.d60 * 100)}% of their launch-week price by day 60 (${Math.round(settle.d30 * 100)}% by day 30).`;
};
