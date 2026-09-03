// New-release guidance constants (todo P7), curated from the release-curve studies
// (`scripts/release-curves/study.mjs` + `dynamic.mjs`, docs/backtests.md). Ratios are
// CURRENT-era (2025H2 onward) median settled prices vs the launch-window reference —
// the product's own first observed week: street-date week for singles, the presale
// listing week for sealed (which lists ~75 days early). Regenerate after each set
// launch via the studies; per the P7 normalization rule these are inputs, never
// per-set parameters.
export type ReleaseSettle = { d14?: number; d30: number; d60: number };
export const RELEASE_SETTLE: Record<string, { single: Record<string, ReleaseSettle>; sealed: Record<string, ReleaseSettle> }> = {
  pokemon: {
    single: {
      "Special Illustration Rare": { d14: .89, d30: .76, d60: .65 },
      "Illustration Rare": { d14: .83, d30: .72, d60: .69 },
      "Ultra Rare": { d14: .67, d30: .55, d60: .41 },
      "Double Rare": { d14: .54, d30: .38, d60: .39 },
      "Mega Hyper Rare": { d14: .99, d30: .83, d60: .69 },
      "Hyper Rare": { d30: .81, d60: .78 },
    },
    sealed: {
      "Booster Boxes": { d14: .87, d30: .80, d60: .75 },
      "Elite Trainer Boxes": { d14: .50, d30: .48, d60: .45 },
      "Booster Bundles": { d14: .52, d30: .51, d60: .56 },
      "Booster Packs": { d14: .48, d30: .52, d60: .48 },
      "Blisters": { d14: .83, d30: .81, d60: .74 },
      "Tins": { d14: .65, d30: .61, d60: .53 },
      "Collections": { d14: .67, d30: .54, d60: .55 },
      "Build & Battle": { d14: .87, d30: .67, d60: .66 },
      "Cases": { d14: .89, d30: .86, d60: .79 },
    },
  },
  riftbound: {
    single: {
      "Epic": { d14: .52, d30: .38, d60: .35 },
      "Rare": { d14: .10, d30: .10, d60: .10 },
      "Showcase": { d14: .93, d30: .88, d60: .69 },
    },
    sealed: {
      // Riftbound boxes lack day-60 depth (3 observations); day-30 held flat, carried.
      "Booster Boxes": { d14: .69, d30: .71, d60: .71 },
      "Booster Packs": { d14: .91, d30: 1.0, d60: .99 },
      "Starter / Theme Decks": { d14: .73, d30: .65, d60: .60 },
    },
  },
};

export const releaseSettleFor = (game: string, kind: "single" | "sealed", rung: string | null): ReleaseSettle | null =>
  (rung && RELEASE_SETTLE[game]?.[kind]?.[rung]) || null;

// Log-linear decay-curve position at a given age (days since release). The reference
// window is the first observed week, so the curve is 1.0 through day 7; beyond the
// last measured node it holds the day-60 ratio (settled).
export const settleRatioAt = (settle: ReleaseSettle, ageDays: number): number => {
  const nodes: [number, number][] = [[7, 1]];
  if (settle.d14 != null) nodes.push([14, settle.d14]);
  nodes.push([30, settle.d30], [60, settle.d60]);
  if (ageDays <= nodes[0][0]) return 1;
  for (let i = 1; i < nodes.length; i++) {
    const [day, ratio] = nodes[i], [prevDay, prevRatio] = nodes[i - 1];
    if (ageDays <= day) {
      const t = (ageDays - prevDay) / (day - prevDay);
      return Math.exp(Math.log(prevRatio) + t * (Math.log(ratio) - Math.log(prevRatio)));
    }
  }
  return settle.d60;
};

// Dynamic blend (user 2026-09-03: the estimate must adjust rapidly as launch prices
// are discovered). Validated in `dynamic.mjs`: projecting the product's OWN price down
// the remaining decay curve beats the static cohort anchor from ~7 observed days and
// deserves full weight by ~14 (holdouts: age-7 error 0.21 vs 0.50; age-14 0.13 vs
// 0.50). Presale trading gets weight too but keeps a cohort tether (cap 0.75) — the
// presale→settle path is only curve-validated for sealed, whose reference IS the
// presale listing week.
export const OWN_WEIGHT_FULL_DAYS = 14;
export const PRESALE_WEIGHT_CAP = 0.75;
const BLEND_RESIDUAL_LOG = 0.16; // median |log err| of the own projection at mid ages

export type EarlyValueBlend = { median: number; q25: number; q75: number; ownWeight: number };
export function blendEarlyValue(input: {
  anchor: { median: number; q25: number; q75: number };
  currentPrice: number | null;
  observedDays: number;
  ageDays: number | null; // days since estimated release; null = presale / unreleased
  settle: ReleaseSettle | null;
}): EarlyValueBlend {
  const { anchor, currentPrice, observedDays, ageDays, settle } = input;
  const presale = ageDays == null;
  let weight = Math.min(observedDays / OWN_WEIGHT_FULL_DAYS, 1);
  if (presale) weight = Math.min(weight, PRESALE_WEIGHT_CAP);
  if (!settle || !currentPrice || currentPrice <= 0 || weight <= 0)
    return { median: anchor.median, q25: anchor.q25, q75: anchor.q75, ownWeight: 0 };
  const projection = currentPrice * (settle.d60 / settleRatioAt(settle, presale ? 0 : ageDays));
  const median = Math.exp((1 - weight) * Math.log(anchor.median) + weight * Math.log(projection));
  const lowBand = (1 - weight) * Math.log(anchor.median / anchor.q25) + weight * BLEND_RESIDUAL_LOG;
  const highBand = (1 - weight) * Math.log(anchor.q75 / anchor.median) + weight * BLEND_RESIDUAL_LOG;
  return {
    median: Number(median.toFixed(2)),
    q25: Number((median * Math.exp(-lowBand)).toFixed(2)),
    q75: Number((median * Math.exp(highBand)).toFixed(2)),
    ownWeight: Number(weight.toFixed(2)),
  };
}

// Marquee-chase display band (study: mainline SIR-class chases settled 2–19× their
// in-set rarity cohort at day 60; Mega Hyper Rare chases far higher). Shown as context
// on chase-class rarities — the EVE range deliberately EXCLUDES this premium.
export const MARQUEE_CHASE_RARITIES = new Set(["Special Illustration Rare", "Mega Hyper Rare", "Hyper Rare"]);
export const MARQUEE_BAND = "2–19×";

// Sets whose pricing has no meaningful cohort analog (EVE validation losers):
// promos, academy/calendar/program products, fast-food tie-ins, special premium sets.
export const eveIneligibleSet = (setName: string, rarity: string | null) =>
  /promo|academy|calendar|program|mcdonald|celebration/i.test(setName) || rarity === "Promo";

export const releaseGuidance = (game: string, kind: "single" | "sealed", rung: string | null): string | null => {
  const settle = releaseSettleFor(game, kind, rung);
  if (!settle) return null;
  return kind === "sealed"
    ? `${rung} have recently settled around ${Math.round(settle.d60 * 100)}% of their first-listing-week price by day 60 (${Math.round(settle.d30 * 100)}% by day 30).`
    : `${rung} cards have recently settled around ${Math.round(settle.d60 * 100)}% of their launch-week price by day 60 (${Math.round(settle.d30 * 100)}% by day 30).`;
};
