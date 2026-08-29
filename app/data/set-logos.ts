import setLogos from "../../public/data/set-logos.json";

// Pokémon set logo lookup (sets view 2026-08-29). Keys in set-logos.json are
// pokemontcg.io names normalized by the SAME rules as `normalize` below (the sync
// script mirrors it). TCGCSV names drift from pokemontcg.io's in three known ways,
// each handled by one retry tier: leading set codes ("SV08: Surging Sparks"),
// dropped "and" joiners ("HeartGold SoulSilver" vs "HeartGold & SoulSilver"), and a
// short manual alias list for outright renames. Other markets have no source yet.
export type SetLogo = { logo: string; symbol: string | null };
const table = (setLogos as { sets: Record<string, SetLogo> }).sets;

const normalize = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const dropAnd = (value: string) => value.replace(/\band\b/g, " ").replace(/\s+/g, " ").trim();

const ALIASES: Record<string, string> = {
  "base set": "base",
  "base set shadowless": "base",
  "expedition": "expedition base set",
  "scarlet and violet base set": "scarlet and violet",
  "sword and shield base set": "sword and shield",
  "sm base set": "sun and moon",
  "scarlet and violet 151": "151",
};

const byDropAnd = new Map<string, SetLogo>();
for (const [key, value] of Object.entries(table)) { const folded = dropAnd(key); if (!byDropAnd.has(folded)) byDropAnd.set(folded, value); }

export function setLogoFor(game: string, set: string): SetLogo | null {
  if (game !== "pokemon") return null;
  const key = normalize(set);
  const stripped = key.replace(/^(?:sv|swsh|sm|xy|bw|hs|ex|dp|me|pop|hgss)\s*\d*(?:\s*pt\s*\d+)?\s+/, "");
  return table[key] ?? table[stripped] ?? table[ALIASES[key] ?? ALIASES[stripped] ?? ""] ?? byDropAnd.get(dropAnd(key)) ?? byDropAnd.get(dropAnd(stripped)) ?? null;
}
