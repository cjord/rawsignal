// Pokémon era mapping (audit R2 / Phase D). Prefix wins where a set name declares its
// block; the release year breaks ties for promos, McDonald's sets, and misc groups.
// Riftbound is one young era — era grouping is a Pokémon concept here.

export type PokemonEra = { key: string; label: string };

export const POKEMON_ERAS: PokemonEra[] = [
  { key: "wotc", label: "WotC (1999–2003)" },
  { key: "ex", label: "EX (2003–2007)" },
  { key: "dp", label: "DP–HGSS (2007–2011)" },
  { key: "bw", label: "Black & White (2011–2013)" },
  { key: "xy", label: "XY (2013–2016)" },
  { key: "sm", label: "Sun & Moon (2016–2019)" },
  { key: "swsh", label: "Sword & Shield (2019–2022)" },
  { key: "sv", label: "Scarlet & Violet (2023–2025)" },
  { key: "me", label: "Mega (2025–)" },
];

const PREFIXES: [RegExp, string][] = [
  [/^ME\b|^ME\d|^Mega Evolution/i, "me"],
  [/^SV\b|^SV\d|^SV:/i, "sv"],
  [/^SWSH/i, "swsh"],
  [/^SM\b|^SM -|^SM:/i, "sm"],
  [/^XY\b/i, "xy"],
  [/^Crown Zenith/i, "swsh"],
  [/^(Black and White|BW)/i, "bw"],
  [/^EX /i, "ex"],
  [/^(Diamond and Pearl|DP|Platinum|HGSS|HS—|HS -)/i, "dp"],
];

const yearEra = (year: number) =>
  year <= 2003 ? "wotc"
  : year <= 2006 ? "ex"
  : year <= 2010 ? "dp"
  : year <= 2013 ? "bw"
  : year <= 2016 ? "xy"
  : year <= 2019 ? "sm"
  : year <= 2022 ? "swsh"
  : year <= 2025 ? "sv"
  : "me";

export function pokemonEra(setName: string, year: number | null | undefined): string {
  for (const [pattern, era] of PREFIXES) if (pattern.test(setName)) return era;
  return Number.isFinite(year) ? yearEra(year as number) : "sv";
}

export const eraLabel = (key: string) => POKEMON_ERAS.find(era => era.key === key)?.label ?? key;

// Sets-view groupings (2026-08-29): every market folds its sets into a small ordered
// group list — Pokémon by collector era, the younger games by product family. Anything
// a rule cannot place lands in that market's "Other" bucket for later refinement.
export type SetGroup = { key: string; label: string };

export const RIFTBOUND_GROUPS: SetGroup[] = [
  { key: "core", label: "Core Sets" },
  { key: "other", label: "Promos / Other" },
];

export const ONEPIECE_GROUPS: SetGroup[] = [
  { key: "main", label: "Main Sets" },
  { key: "eb", label: "Extra Boosters" },
  { key: "st", label: "Starter Decks" },
  { key: "other", label: "Other" },
];

// Display order: newest era first for Pokémon (the mockup leads with the current block).
export function setGroupsFor(game: string): SetGroup[] {
  if (game === "pokemon") return [...POKEMON_ERAS].reverse();
  if (game === "riftbound") return RIFTBOUND_GROUPS;
  if (game === "onepiece") return ONEPIECE_GROUPS;
  return [{ key: "other", label: "Other" }];
}

export function setGroupKey(game: string, setName: string, year: number | null | undefined): string {
  if (game === "pokemon") return pokemonEra(setName, year);
  if (game === "riftbound") return /\b(promo|bulk|demo)\b/i.test(setName) ? "other" : "core";
  if (game === "onepiece") {
    if (/^starter deck|deck set\b/i.test(setName)) return "st";
    if (/^extra booster/i.test(setName)) return "eb";
    if (/promotion|collection set/i.test(setName)) return "other";
    return "main";
  }
  return "other";
}

export const setGroupLabel = (game: string, key: string) =>
  setGroupsFor(game).find(group => group.key === key)?.label ?? key;
