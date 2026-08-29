import { writeFile } from "node:fs/promises";

// Pokémon set logo/symbol art for the sets view (2026-08-29): pokemontcg.io is the one
// free, stable source of official set imagery. This regenerates
// public/data/set-logos.json — keys are normalized set names, matched by the view with
// the same normalizer. Riftbound/One Piece have no source yet and render typographic
// tiles. Run manually when new Pokémon sets ship: node scripts/sets/sync-set-logos.mjs
// The newest sets can lag on pokemontcg.io — a missing entry falls back gracefully.

const normalize = value => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

async function fetchPage(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`https://api.pokemontcg.io/v2/sets?page=${page}&pageSize=250`, {
      headers: { "User-Agent": "raw-signal-set-logos" },
    });
    if (response.ok) return response.json();
    if (attempt === 3) throw new Error(`pokemontcg.io returned HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
  }
}

const sets = [];
for (let page = 1; page <= 4; page++) {
  const body = await fetchPage(page);
  sets.push(...(body.data ?? []));
  if ((body.data?.length ?? 0) < 250) break;
}
if (!sets.length) throw new Error("pokemontcg.io returned no sets — refusing to overwrite the mapping");

const mapping = {};
const register = (key, set) => {
  if (!key) return;
  // Later (newer) sets win name collisions — reprints like "151" resolve to the modern set.
  mapping[key] = { logo: set.images.logo, symbol: set.images.symbol ?? null, series: set.series ?? null };
};
const aliases = {};
for (const set of sets) {
  if (!set?.name || !set?.images?.logo) continue;
  register(normalize(set.name), set);
  // TCGCSV drops era prefixes pokemontcg.io keeps ("HS—Unleashed" is just "Unleashed"
  // upstream): stripped names become aliases that only land when no exact name uses them.
  const stripped = normalize(set.name.replace(/^(HS|EX|BW|XY|SM|SWSH|SV|DP|POP)[\s—:-]+/i, ""));
  if (stripped && stripped !== normalize(set.name)) aliases[stripped] = set;
}
for (const [key, set] of Object.entries(aliases)) if (!mapping[key]) register(key, set);

const payload = { source: "pokemontcg.io/v2/sets", syncedAt: new Date().toISOString(), count: Object.keys(mapping).length, sets: mapping };
await writeFile(new URL("../../public/data/set-logos.json", import.meta.url), `${JSON.stringify(payload)}\n`);
console.log(`set-logos.json written: ${payload.count} sets`);
