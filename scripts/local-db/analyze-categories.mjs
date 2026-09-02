// Local-only sizing analysis for new backtest categories (Japanese Pokémon cat 85,
// Magic cat 1): fetches TCGCSV product metadata per group (cached under
// backups/tcgcsv-archive/meta-<cat>/ so the later target-list build reuses it), joins
// the latest cached archive day's prices, and reports rarity × price-band counts so we
// can choose which slices are worth parsing into the max-profile database.
//   node scripts/local-db/analyze-categories.mjs [--cats 85,1] [--concurrency 6]

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const CATS = arg("cats", "85,1").split(",");
const CONCURRENCY = Number(arg("concurrency", "6"));
const CACHE = path.resolve("backups/tcgcsv-archive");
const TAR = "C:/Windows/System32/tar.exe";
const UA = { "User-Agent": "RawSignal/7.0 (+validated daily market ingestion)" };

const fetchJson = async url => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { const response = await fetch(url, { headers: UA }); if (response.ok) return await response.json(); }
    catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
  }
  return null;
};

// Latest cached archive day → per-product best price (max of subtype prices, market).
const days = (await readdir(CACHE)).filter(name => /^prices-\d{4}-\d{2}-\d{2}\.ppmd\.7z$/.test(name)).sort();
const latest = days.at(-1);
const day = latest.slice(7, 17);
const extractDir = path.join(os.tmpdir(), `rawsignal-analyze-${day}`);
if (!existsSync(extractDir)) {
  await mkdir(extractDir, { recursive: true });
  execFileSync(TAR, ["-xf", path.join(CACHE, latest), "-C", extractDir]);
}
console.error(`prices from archive day ${day}`);

const priceOf = new Map(); // cat -> Map(productId -> {market, sub})
for (const cat of CATS) {
  const map = new Map();
  const catDir = path.join(extractDir, day, cat);
  if (!existsSync(catDir)) { console.error(`cat ${cat}: no archive dir`); priceOf.set(cat, map); continue; }
  for (const group of await readdir(catDir)) {
    let parsed;
    try { parsed = JSON.parse(await readFile(path.join(catDir, group, "prices"), "utf8")); } catch { continue; }
    for (const row of parsed.results ?? []) {
      const market = Number(row.marketPrice) > 0 ? Number(row.marketPrice) : null;
      if (!market) continue;
      const prev = map.get(row.productId);
      if (!prev || market > prev.market) map.set(row.productId, { market, sub: row.subTypeName });
    }
  }
  priceOf.set(cat, map);
  console.error(`cat ${cat}: ${map.size.toLocaleString()} priced products on ${day}`);
}

for (const cat of CATS) {
  const groups = (await fetchJson(`https://tcgcsv.com/tcgplayer/${cat}/groups`))?.results ?? [];
  console.error(`cat ${cat}: ${groups.length} groups`);
  const metaDir = path.join(CACHE, `meta-${cat}`);
  await mkdir(metaDir, { recursive: true });
  const byRarity = new Map(); // rarity -> {n, priced, p5, p20, prices[]}
  let index = 0;
  const worker = async () => {
    while (index < groups.length) {
      const group = groups[index++];
      const file = path.join(metaDir, `${group.groupId}.json`);
      let products;
      if (existsSync(file)) { try { products = JSON.parse(await readFile(file, "utf8")); } catch { products = null; } }
      if (!products) {
        products = (await fetchJson(`https://tcgcsv.com/tcgplayer/${cat}/${group.groupId}/products`))?.results ?? [];
        await writeFile(file, JSON.stringify(products));
      }
      for (const product of products) {
        const rarity = (product.extendedData ?? []).find(item => item.name === "Rarity")?.value ?? "(none)";
        const isCard = (product.extendedData ?? []).some(item => item.name === "Number" || item.name === "Rarity");
        if (!isCard) continue;
        const cell = byRarity.get(rarity) ?? byRarity.set(rarity, { n: 0, priced: 0, p5: 0, p20: 0, prices: [] }).get(rarity);
        cell.n++;
        const price = priceOf.get(cat)?.get(product.productId);
        if (price) { cell.priced++; if (price.market >= 5) cell.p5++; if (price.market >= 20) cell.p20++; cell.prices.push(price.market); }
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const rows = [...byRarity.entries()].map(([rarity, cell]) => {
    cell.prices.sort((a, b) => a - b);
    const med = cell.prices.length ? cell.prices[Math.floor(cell.prices.length / 2)] : 0;
    return { rarity, ...cell, med };
  }).sort((a, b) => b.p5 - a.p5);
  console.log(`\n== category ${cat} — cards by rarity (archive day ${day}) ==`);
  console.log("rarity | products | priced | ≥$5 | ≥$20 | median$");
  for (const row of rows) console.log(`${row.rarity} | ${row.n.toLocaleString()} | ${row.priced.toLocaleString()} | ${row.p5.toLocaleString()} | ${row.p20.toLocaleString()} | ${row.med.toFixed(2)}`);
}
await rm(extractDir, { recursive: true, force: true });
