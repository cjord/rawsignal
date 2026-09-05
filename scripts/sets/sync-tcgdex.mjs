import { writeFile } from "node:fs/promises";

// TCGdex set index for the card-image fallback (2026-09-04): when a TCGplayer CDN image
// fails to load, a Pokémon card can fall back to TCGdex's scan at
// https://assets.tcgdex.net/{lang}/{serie}/{set}/{localId}/high.webp. This regenerates
// app/data/tcgdex-sets.json (bundled module data) — English sets keyed by normalized name (plus era-stripped
// aliases, the set-logos rule) and every set (English and Japanese) keyed by its lowercased
// TCGdex id, which matches the code prefix TCGCSV puts on set names ("SV10: Destined
// Rivals" → sv10, "SV2a: Pokemon Card 151" → sv2a). Sets without cards on TCGdex are
// skipped. Run manually when new sets ship: node scripts/sets/sync-tcgdex.mjs

const normalize = value => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const API = "https://api.tcgdex.net/v2";

async function getJson(path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${API}${path}`, { headers: { "User-Agent": "raw-signal-tcgdex-sync" } });
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    if (attempt === 3) throw new Error(`TCGdex ${path} returned HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
  }
}

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index], index); }
  }));
  return results;
}

const entries = { sets: {}, codes: {} };
let count = 0;
for (const lang of ["en", "ja"]) {
  const sets = (await getJson(`/${lang}/sets`)) ?? [];
  if (!sets.length) throw new Error(`TCGdex returned no ${lang} sets — refusing to overwrite the index`);
  const details = await mapWithConcurrency(sets, 4, set => getJson(`/${lang}/sets/${encodeURIComponent(set.id)}`));
  for (const [index, set] of sets.entries()) {
    const detail = details[index];
    const first = detail?.cards?.[0];
    if (!detail?.serie?.id || !first) continue;
    // Modern sets (SV, ME) number cards "001"; older sets "1" — the fallback pads to match.
    const entry = { lang, serie: detail.serie.id, id: set.id, padded: /^\d{3}$/.test(String(first.localId)) };
    entries.codes[set.id.toLowerCase()] = entry;
    count++;
    if (lang !== "en") continue;
    const key = normalize(set.name);
    if (!entries.sets[key]) entries.sets[key] = entry;
    const stripped = normalize(set.name.replace(/^(HS|EX|BW|XY|SM|SWSH|SV|DP|POP)[\s—:-]+/i, ""));
    if (stripped && stripped !== key && !entries.sets[stripped]) entries.sets[stripped] = entry;
  }
}
const payload = { source: "api.tcgdex.net/v2 (en + ja sets)", syncedAt: new Date().toISOString(), count, ...entries };
await writeFile(new URL("../../app/data/tcgdex-sets.json", import.meta.url), `${JSON.stringify(payload)}\n`);
console.log(`tcgdex-sets.json written: ${count} sets, ${Object.keys(entries.sets).length} name keys, ${Object.keys(entries.codes).length} code keys`);
