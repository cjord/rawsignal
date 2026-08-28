// Standard-pricing MSRPs derived by product type and era (audit Phase C, user-approved
// "verified + derived, badged"; research in docs/product-audit-2026-08-28.md and
// docs/msrp-sources.md). These are ESTIMATES by design: every derived value carries the
// "Standard pricing (derived)" source so no surface can present it as verified.
//
// Verified anchors: TPCi raised packs $3.99 -> $4.49 with Scarlet & Violet (Mar 2023) and
// held it through the Mega era; ETBs moved $39.99 -> $49.99 at the same boundary. Only
// name patterns with near-universal standard pricing derive a value; everything variable
// (collections, tins, box sets, imports, Pokemon Center exclusives) stays null for the
// hand-curated pass. Pre-2020 standards are unverified — no derivation.

const SV_ERA_START = 2023;

const RULES = [
  { type: "Elite Trainer Box", pattern: /\belite trainer box\b/i, exclude: /pokemon center/i, prices: [39.99, 49.99] },
  { type: "Booster Bundle", pattern: /\bbooster bundle\b/i, exclude: /\b(display|case)\b/i, prices: [23.94, 26.94] },
  { type: "Booster Box (36)", pattern: /\bbooster (box|display)\b/i, exclude: /\b(case|japanese)\b/i, prices: [143.64, 161.64] },
  { type: "Booster Pack", pattern: /\bbooster pack\b/i, exclude: /\b(sleeved|blister|3 pack|three pack|double|case|display|art bundle)\b/i, prices: [3.99, 4.49] },
  { type: "Ultra-Premium Collection", pattern: /\bultra-?premium collection\b/i, exclude: null, prices: [119.99, 119.99] },
];

export const DERIVED_MSRP_SOURCE = "Standard pricing (derived)";

export function derivedPokemonMsrp(name = "", year = null) {
  if (!Number.isFinite(year) || year < 2020) return null;
  const eraIndex = year >= SV_ERA_START ? 1 : 0;
  for (const rule of RULES) {
    if (!rule.pattern.test(name)) continue;
    if (rule.exclude && rule.exclude.test(name)) return null;
    return { msrp: rule.prices[eraIndex], msrpSource: DERIVED_MSRP_SOURCE };
  }
  return null;
}

export const DERIVED_RULES = RULES.map(rule => ({ type: rule.type, swsh: rule.prices[0], sv: rule.prices[1] }));
