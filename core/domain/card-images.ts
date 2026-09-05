// Card-image fallback (2026-09-04). TCGplayer's CDN carries every catalog image today (0 of
// 18,361 rows missing, 0 of 60 sampled URLs broken), so this is resilience, not coverage: when
// a Pokémon card's image fails to load, the client swaps in TCGdex's scan of the same card.
// The set index comes from scripts/sets/sync-tcgdex.mjs (app/data/tcgdex-sets.json); the
// resolver here is pure so the lookup rules are testable without the JSON.

export type TcgdexSetEntry = { lang: string; serie: string; id: string; padded: boolean };
export type TcgdexIndex = { sets: Record<string, TcgdexSetEntry>; codes: Record<string, TcgdexSetEntry> };

export const TCGDEX_ASSETS = "https://assets.tcgdex.net";

export const normalizeSetName = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

const SET_ALIASES: Record<string, string> = {
  "base set": "base set",
  "scarlet and violet base set": "scarlet and violet",
  "sword and shield base set": "sword and shield",
  "sm base set": "sun and moon",
  "scarlet and violet 151": "151",
};

// TCGCSV set names carry the set code up front ("SV10: Destined Rivals", "S10D: Time Gazer");
// the code is the TCGdex id for every era that has one, so it is tried before the name.
export function resolveTcgdexSet(index: TcgdexIndex, setName: string): TcgdexSetEntry | null {
  const coded = setName.match(/^([A-Za-z0-9.-]+):\s/);
  if (coded) {
    const code = coded[1].toLowerCase();
    const byCode = index.codes[code] ?? index.codes[code.replace(/-/g, "")];
    if (byCode) return byCode;
  }
  const key = normalizeSetName(setName);
  const stripped = key.replace(/^(?:sv|swsh|sm|xy|bw|hs|ex|dp|me|pop|hgss)\s*\d*(?:\s*pt\s*\d+)?\s+/, "");
  return index.sets[key] ?? index.sets[stripped] ?? index.sets[SET_ALIASES[key] ?? SET_ALIASES[stripped] ?? ""] ?? null;
}

// "171/131" → "171" (padded to three digits for modern sets), "TG01/TG30" → "TG01".
export function tcgdexCardUrl(entry: TcgdexSetEntry, number: string): string | null {
  const local = number.split("/")[0]?.trim();
  if (!local) return null;
  const numeric = /^\d+$/.test(local);
  const localId = numeric ? (entry.padded ? String(Number(local)).padStart(3, "0") : String(Number(local))) : local;
  return `${TCGDEX_ASSETS}/${entry.lang}/${entry.serie}/${entry.id}/${localId}/high.webp`;
}

export function cardImageFallbackFor(index: TcgdexIndex, card: { game: string; set: string; number?: string | null }): string | null {
  if (card.game !== "pokemon" || !card.number) return null;
  const entry = resolveTcgdexSet(index, card.set);
  return entry ? tcgdexCardUrl(entry, card.number) : null;
}
