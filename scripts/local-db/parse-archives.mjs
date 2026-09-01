import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { allowedRarities } from "../../core/market-state.ts";
import { preferredSealedPrice } from "../../core/normalize/sealed.ts";

// Local max-profile database, phase 1 (docs/local-database.md): parse the cached TCGCSV
// daily price archives (backups/tcgcsv-archive/, downloaded by the M6 backfill) into an
// NDJSON observation log covering EVERY tracked product — singles and sealed, categories
// 3/68/85/89 — for the full archive range. Local-only: this feeds the seeded dev
// database, never a Cloudflare environment. Resumable: one NDJSON line per processed
// day; re-runs skip done days, so the ~936-day walk runs in bounded slices.
//   node scripts/local-db/parse-archives.mjs [--max-minutes 9] [--from ...] [--to ...]
// Singles match their feed printing against the archive row's subTypeName (Near Mint
// column only, like the daily walk); sealed use the shared preferred-price rule.

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const FROM = arg("from", "2024-02-08");
const TO = arg("to", new Date(Date.now() - 86400000).toISOString().slice(0, 10));
const CACHE = path.resolve("backups/tcgcsv-archive");
const OUT = path.resolve(".wrangler/local-profiles");
const NDJSON = path.join(OUT, "archive-observations.ndjson");
const TAR = "C:/Windows/System32/tar.exe";
const CATEGORIES = ["3", "68", "85", "89"];
const deadline = Date.now() + Number(arg("max-minutes", "9")) * 60000;

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const cents = value => Number(value) > 0 ? Math.round(Number(value) * 100) : null;

// Targets from the bundled feeds: singles keep their printing for variant matching.
const singlesPrinting = new Map();
const sections = [...new Set([...allowedRarities.pokemon, ...allowedRarities.riftbound])].filter(section => section !== "all");
for (const section of sections) {
  try { for (const card of await readJson(`public/data/${section}.json`)) singlesPrinting.set(Number(card.productId), card.printing ?? "Normal"); }
  catch { /* a section feed can be absent locally (e.g. japanese-promos is D1-built) */ }
}
const sealedIds = new Set();
for (const market of ["pokemon", "riftbound", "onepiece"]) {
  try { for (const product of await readJson(`public/data/sealed-${market}.json`)) sealedIds.add(Number(product.productId)); }
  catch { /* optional */ }
}
console.error(`targets: ${singlesPrinting.size} singles, ${sealedIds.size} sealed`);

await mkdir(OUT, { recursive: true });
const dates = [];
for (let time = Date.parse(`${FROM}T00:00:00Z`); time <= Date.parse(`${TO}T00:00:00Z`); time += 86400000) dates.push(new Date(time).toISOString().slice(0, 10));

const doneDates = new Set();
// A killed run can leave a truncated final line — skip it; that day just re-parses.
if (existsSync(NDJSON)) for (const line of (await readFile(NDJSON, "utf8")).split("\n").filter(Boolean)) { try { doneDates.add(JSON.parse(line).date); } catch { /* truncated tail */ } }

let processed = 0, outOfTime = false, missingArchives = 0;
for (const date of dates) {
  if (doneDates.has(date)) continue;
  if (Date.now() > deadline) { outOfTime = true; break; }
  const archive = path.join(CACHE, `prices-${date}.ppmd.7z`);
  if (!existsSync(archive)) {
    const response = await fetch(`https://tcgcsv.com/archive/tcgplayer/prices-${date}.ppmd.7z`, { headers: { "User-Agent": "RawSignal/7.0 (local max profile)" } });
    if (!response.ok) { missingArchives++; await appendFile(NDJSON, `${JSON.stringify({ date, missing: true, rows: [] })}\n`); continue; }
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  }
  // Extract OUTSIDE the repo: the dev server's file watcher crashes (EBUSY) on these
  // transient files if they appear under the project tree while it is running.
  const extracted = path.join(os.tmpdir(), "rawsignal-archive-x", date);
  await rm(extracted, { recursive: true, force: true });
  await mkdir(extracted, { recursive: true });
  try {
    execFileSync(TAR, ["-xf", archive, "-C", extracted, ...CATEGORIES.map(category => `${date}/${category}/*`)], { stdio: ["ignore", "ignore", "pipe"] });
  } catch { /* a category can be absent from early archives */ }
  const dayRows = []; // [productId, cents, "S"|"N"]
  for (const category of CATEGORIES) {
    const root = path.join(extracted, date, category);
    if (!existsSync(root)) continue;
    for (const group of await readdir(root)) {
      let rows;
      try {
        const parsed = await readJson(path.join(root, group, "prices"));
        rows = Array.isArray(parsed) ? parsed : parsed.results ?? [];
      } catch { continue; }
      const byProduct = new Map();
      for (const row of rows) {
        const productId = Number(row.productId);
        if (!sealedIds.has(productId) && !singlesPrinting.has(productId)) continue;
        const list = byProduct.get(productId) ?? [];
        list.push(row);
        byProduct.set(productId, list);
      }
      for (const [productId, list] of byProduct) {
        if (sealedIds.has(productId)) {
          const price = cents(preferredSealedPrice(list)?.marketPrice);
          if (price != null) dayRows.push([productId, price, "S"]);
        } else {
          const printing = singlesPrinting.get(productId);
          const match = list.find(row => row.subTypeName === printing && Number(row.marketPrice) > 0) ?? list.find(row => Number(row.marketPrice) > 0);
          const price = cents(match?.marketPrice);
          if (price != null) dayRows.push([productId, price, "N"]);
        }
      }
    }
  }
  await rm(extracted, { recursive: true, force: true });
  await appendFile(NDJSON, `${JSON.stringify({ date, rows: dayRows })}\n`);
  processed++;
  if (processed % 25 === 0) console.error(`${processed} days this run (${doneDates.size + processed}/${dates.length} total)`);
}

const remaining = dates.length - doneDates.size - processed;
console.log(JSON.stringify({ phase: "parse", processed, remaining: outOfTime ? remaining : Math.max(0, remaining), missingArchives, total: dates.length }));
