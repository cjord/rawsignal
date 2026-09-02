// Local-only validation database for extra backtest segments (docs/local-database.md):
// Japanese Pokémon chase rarities (cat 85) and Magic mythics + day-one $5 rares (cat 1),
// parsed from the cached TCGCSV daily archives into .wrangler/local-profiles/max-ext.sqlite.
// Kept SEPARATE from max.sqlite: the production schema's game check constraint has no
// 'magic', and widening it needs a table-rebuild migration production doesn't want —
// this extension holds only what the walk-forward harness reads (catalog_products +
// price_observations) and is pointed at via `npm run backtest:walk -- --db <path>`.
// Selection rules (sizing analysis 2026-09-02, scripts/local-db/analyze-categories.mjs):
//   cat 85 → rarities in JP_RARITIES (chase tiers; bulk sits under the $5 floor)
//   cat 1  → all Mythic, plus Rare with market >= $5 on the FIRST archive day
//            (start-of-window selection, so the backtest is not survivorship-biased)
//   node scripts/local-db/build-ext-db.mjs [--max-minutes 9]   (resumable per day)

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const CACHE = path.resolve("backups/tcgcsv-archive");
const OUT = path.resolve(".wrangler/local-profiles");
const NDJSON = path.join(OUT, "ext-observations.ndjson");
const DB_PATH = path.join(OUT, "max-ext.sqlite");
const TAR = "C:/Windows/System32/tar.exe";
const deadline = Date.now() + Number(arg("max-minutes", "9")) * 60000;

const JP_RARITIES = new Set(["Special Art Rare", "Art Rare", "Super Rare", "Ultra Rare", "Hyper Rare", "Character Super Rare", "Character Rare", "Rare Holo LEGEND", "Rare Holo LV.X", "Shining", "Mega Ultra Rare", "Black White Rare", "Amazing Rare"]);
const FIRST_DAY = "2024-02-08";

// --- target lists from the cached metadata (analyze-categories.mjs populated these) ---
const readMeta = async cat => {
  const dir = path.join(CACHE, `meta-${cat}`), out = [];
  for (const file of await readdir(dir)) out.push(...JSON.parse(await readFile(path.join(dir, file), "utf8")));
  return out;
};
const rarityOf = product => (product.extendedData ?? []).find(item => item.name === "Rarity")?.value ?? null;

// Group metadata (set names): cache beside the product metadata; one fetch per category.
for (const cat of ["85", "1"]) {
  const file = path.join(CACHE, `meta-${cat}-groups.json`);
  if (!existsSync(file)) {
    const response = await fetch(`https://tcgcsv.com/tcgplayer/${cat}/groups`, { headers: { "User-Agent": "RawSignal/7.0 (+validated daily market ingestion)" } });
    await writeFile(file, JSON.stringify((await response.json()).results ?? []));
  }
}

const targetsFile = path.join(OUT, "ext-targets.json");
let targets;
if (existsSync(targetsFile)) targets = JSON.parse(await readFile(targetsFile, "utf8"));
else {
  // Day-one Magic prices for the unbiased Rare cut.
  const day1Dir = path.join(os.tmpdir(), "rawsignal-ext-day1");
  await mkdir(day1Dir, { recursive: true });
  execFileSync(TAR, ["-xf", path.join(CACHE, `prices-${FIRST_DAY}.ppmd.7z`), "-C", day1Dir]);
  const day1 = new Map();
  const catDir = path.join(day1Dir, FIRST_DAY, "1");
  for (const group of await readdir(catDir)) {
    try { for (const row of JSON.parse(await readFile(path.join(catDir, group, "prices"), "utf8")).results ?? []) { const market = Number(row.marketPrice); if (market > 0 && market > (day1.get(row.productId) ?? 0)) day1.set(row.productId, market); } } catch { /* sparse group */ }
  }
  await rm(day1Dir, { recursive: true, force: true });
  targets = {};
  for (const product of await readMeta("85")) {
    const rarity = rarityOf(product);
    if (rarity && JP_RARITIES.has(rarity)) targets[product.productId] = { cat: "85", game: "pokemon-jp", rarity, name: product.name, group: product.groupId };
  }
  for (const product of await readMeta("1")) {
    const rarity = rarityOf(product);
    if (rarity === "M" || (rarity === "R" && (day1.get(product.productId) ?? 0) >= 5)) targets[product.productId] = { cat: "1", game: "magic", rarity: rarity === "M" ? "Mythic" : "Rare", name: product.name, group: product.groupId };
  }
  await writeFile(targetsFile, JSON.stringify(targets));
}
const targetIds = new Set(Object.keys(targets).map(Number));
console.error(`targets: ${targetIds.size.toLocaleString()} (${Object.values(targets).filter(t => t.cat === "85").length} JP, ${Object.values(targets).filter(t => t.cat === "1").length} MTG)`);

// --- parse phase: resumable one-line-per-day NDJSON over the cached archives ----------
const done = new Set();
if (existsSync(NDJSON)) for (const line of (await readFile(NDJSON, "utf8")).split("\n")) {
  if (!line) continue;
  try { done.add(JSON.parse(line).day); } catch { /* truncated tail */ }
}
const days = (await readdir(CACHE)).filter(name => /^prices-\d{4}-\d{2}-\d{2}\.ppmd\.7z$/.test(name)).map(name => name.slice(7, 17)).sort();
let parsedDays = 0;
for (const day of days) {
  if (done.has(day)) continue;
  if (Date.now() > deadline) { console.error(`time slice up after ${done.size}/${days.length} days — rerun to resume`); process.exit(0); }
  const dir = path.join(os.tmpdir(), `rawsignal-ext-${day}`);
  await mkdir(dir, { recursive: true });
  try { execFileSync(TAR, ["-xf", path.join(CACHE, `prices-${day}.ppmd.7z`), "-C", dir]); } catch { await rm(dir, { recursive: true, force: true }); await appendFile(NDJSON, JSON.stringify({ day, rows: [] }) + "\n"); done.add(day); continue; }
  const rows = [];
  for (const cat of ["85", "1"]) {
    const catDir = path.join(dir, day, cat);
    if (!existsSync(catDir)) continue;
    for (const group of await readdir(catDir)) {
      let parsed;
      try { parsed = JSON.parse(await readFile(path.join(catDir, group, "prices"), "utf8")); } catch { continue; }
      for (const row of parsed.results ?? []) {
        if (!targetIds.has(row.productId)) continue;
        const cents = Number(row.marketPrice) > 0 ? Math.round(Number(row.marketPrice) * 100) : null;
        if (cents) rows.push([row.productId, row.subTypeName ?? "Normal", cents]);
      }
    }
  }
  await rm(dir, { recursive: true, force: true });
  await appendFile(NDJSON, JSON.stringify({ day, rows }) + "\n");
  done.add(day);
  parsedDays++;
  if (parsedDays % 25 === 0) console.error(`parsed ${done.size}/${days.length} days`);
}
console.error(`parse complete: ${done.size}/${days.length} days`);

// --- build phase: load the NDJSON into max-ext.sqlite --------------------------------
await rm(DB_PATH, { force: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`create table catalog_products (product_id integer primary key, kind text not null, game text not null, set_name text not null, rarity text, product_type text, name text);
  create table price_observations (product_id integer not null, variant text not null, condition text not null, observed_date text not null, market_cents integer not null, primary key (product_id, variant, condition, observed_date));
  pragma journal_mode=off; pragma synchronous=off;`);
// Set names from the cached group metadata files.
const setNames = new Map();
for (const cat of ["85", "1"]) {
  const groups = (await (async () => { try { return JSON.parse(await readFile(path.join(CACHE, `meta-${cat}-groups.json`), "utf8")); } catch { return null; } })());
  if (groups) for (const group of groups) setNames.set(`${cat}:${group.groupId}`, group.name);
}
const insertCatalog = db.prepare("insert or ignore into catalog_products (product_id, kind, game, set_name, rarity, product_type, name) values (?,?,?,?,?,?,?)");
for (const [id, target] of Object.entries(targets)) insertCatalog.run(Number(id), "single", target.game, setNames.get(`${target.cat}:${target.group}`) ?? `group-${target.group}`, target.rarity, null, target.name);
const insertObs = db.prepare("insert or ignore into price_observations (product_id, variant, condition, observed_date, market_cents) values (?,?,'Near Mint',?,?)");
let observations = 0;
db.exec("begin");
for (const line of (await readFile(NDJSON, "utf8")).split("\n")) {
  if (!line) continue;
  let parsed; try { parsed = JSON.parse(line); } catch { continue; }
  for (const [id, variant, cents] of parsed.rows) { insertObs.run(id, variant, parsed.day, cents); observations++; }
}
db.exec("commit");
console.error(`max-ext.sqlite built: ${targetIds.size.toLocaleString()} products, ${observations.toLocaleString()} observations`);
db.close();
