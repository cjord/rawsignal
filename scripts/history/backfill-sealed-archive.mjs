import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { preferredSealedPrice } from "../../core/normalize/sealed.ts";

// Todo M6 (one-shot, local): rebuild deep daily price history for the One Piece (cat 68)
// and Japanese Pokémon (cat 85) sealed catalogs from TCGCSV's daily price archives
// (prices-YYYY-MM-DD.ppmd.7z, ~4 MB each, all categories, published since 2024-02-08).
// TCGplayer's history API is thin on sealed; the archives hold exact daily prices.
//
// Output: chunked SQL for `wrangler d1 execute --remote --file`:
//   catalog-seed.sql    — INSERT OR IGNORE catalog/current_prices/sealed_details stubs for
//                         target products the walk hasn't ingested yet (satisfies the
//                         price_observations FK; the next live run re-stamps them through
//                         its normal upsert path).
//   observations-N.sql  — INSERT OR IGNORE price_observations rows ('Sealed'/'Unopened',
//                         source 'tcgcsv-archive'); existing API-sourced rows always win.
//
// Extraction uses Windows' built-in bsdtar (C:\Windows\System32\tar.exe), which reads
// PPMd 7z natively — no 7-Zip install. Archives cache in backups/ (gitignored) so
// re-runs skip downloads. The parse phase is RESUMABLE: each processed day appends to
// observations.ndjson and is skipped on re-runs, so the ~936-day walk can proceed in
// bounded invocations. Usage:
//   node scripts/history/backfill-sealed-archive.mjs --download-only   # parallel fetch pass
//   node scripts/history/backfill-sealed-archive.mjs --max-minutes 8   # parse a time slice
//   node scripts/history/backfill-sealed-archive.mjs --emit            # write SQL when done
// Optional: --from 2024-02-08 --to YYYY-MM-DD

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const has = name => process.argv.includes(`--${name}`);
const FROM = arg("from", "2024-02-08");
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const TO = arg("to", yesterday);
const CACHE = path.resolve("backups/tcgcsv-archive");
const OUT = path.resolve("backups/archive-backfill");
const NDJSON = path.join(OUT, "observations.ndjson");
const TAR = "C:/Windows/System32/tar.exe";
const CATEGORIES = ["68", "85"];
const ROWS_PER_STATEMENT = 400, STATEMENTS_PER_FILE = 50;
const DOWNLOAD_CONCURRENCY = 8;
const deadline = Date.now() + Number(arg("max-minutes", "8")) * 60000;

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const cents = value => Number(value) > 0 ? Math.round(Number(value) * 100) : null;
const esc = value => value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
const num = value => value == null ? "null" : String(value);

const onepieceFeed = await readJson("public/data/sealed-onepiece.json");
const pokemonFeed = await readJson("public/data/sealed-pokemon.json");
const targets = new Map(); // productId -> feed record (category 68 = onepiece feed, 85 = pokemon feed subset)
for (const product of onepieceFeed) targets.set(product.productId, product);
const pokemonSealedById = new Map(pokemonFeed.map(product => [product.productId, product]));

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });

const dates = [];
for (let time = Date.parse(`${FROM}T00:00:00Z`); time <= Date.parse(`${TO}T00:00:00Z`); time += 86400000) dates.push(new Date(time).toISOString().slice(0, 10));
console.error(`${dates.length} archive days ${FROM}..${TO}`);

const archivePath = date => path.join(CACHE, `prices-${date}.ppmd.7z`);
const download = async date => {
  if (existsSync(archivePath(date))) return true;
  const response = await fetch(`https://tcgcsv.com/archive/tcgplayer/prices-${date}.ppmd.7z`, { headers: { "User-Agent": "RawSignal/7.0 (sealed history backfill)" } });
  if (!response.ok) { console.error(`${date}: archive ${response.status}`); return false; }
  await writeFile(archivePath(date), Buffer.from(await response.arrayBuffer()));
  return true;
};

if (has("download-only")) {
  let fetched = 0, missing = 0;
  for (let offset = 0; offset < dates.length; offset += DOWNLOAD_CONCURRENCY) {
    const results = await Promise.all(dates.slice(offset, offset + DOWNLOAD_CONCURRENCY).map(download));
    fetched += results.filter(Boolean).length; missing += results.filter(ok => !ok).length;
    if (Date.now() > deadline) { console.log(JSON.stringify({ phase: "download", fetched, missing, remaining: dates.length - offset - DOWNLOAD_CONCURRENCY })); process.exit(0); }
  }
  console.log(JSON.stringify({ phase: "download", fetched, missing, remaining: 0 }));
  process.exit(0);
}

// Resume state: one NDJSON line per processed day.
const doneDates = new Set();
const priorLines = existsSync(NDJSON) ? (await readFile(NDJSON, "utf8")).split("\n").filter(Boolean) : [];
for (const line of priorLines) doneDates.add(JSON.parse(line).date);

const observations = []; // {productId, date, cents}
const jpSealedIds = new Set(); // pokemon-feed ids seen under category 85 (identifies the JP subset)
let missingArchives = 0, processed = 0, outOfTime = false;

for (const [index, date] of dates.entries()) {
  if (has("emit")) break;
  if (doneDates.has(date)) continue;
  if (Date.now() > deadline) { outOfTime = true; break; }
  if (!await download(date)) { missingArchives++; await appendFile(NDJSON, `${JSON.stringify({ date, missing: true, rows: [] })}\n`); continue; }
  const dayRows = [];
  const extracted = path.join(CACHE, `x-${date}`);
  await rm(extracted, { recursive: true, force: true });
  await mkdir(extracted, { recursive: true });
  try {
    execFileSync(TAR, ["-xf", archivePath(date), "-C", extracted, ...CATEGORIES.map(category => `${date}/${category}/*`)], { stdio: ["ignore", "ignore", "pipe"] });
  } catch { /* categories can be absent from early archives (e.g. Riftbound-era gaps) — keep whatever extracted */ }
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
        const record = category === "68" ? targets.get(productId) : pokemonSealedById.get(productId);
        if (!record) continue;
        const list = byProduct.get(productId) ?? [];
        list.push(row);
        byProduct.set(productId, list);
      }
      for (const [productId, list] of byProduct) {
        const price = cents(preferredSealedPrice(list)?.marketPrice);
        if (price != null) dayRows.push([productId, price, category]);
      }
    }
  }
  await rm(extracted, { recursive: true, force: true });
  await appendFile(NDJSON, `${JSON.stringify({ date, rows: dayRows })}\n`);
  processed++;
  if (processed % 50 === 0) console.error(`${index + 1}/${dates.length} days (${processed} this run)`);
}

if (!has("emit")) {
  const remaining = dates.filter(date => !doneDates.has(date)).length - processed;
  console.log(JSON.stringify({ phase: "parse", processed, remaining: outOfTime ? remaining : 0, missingArchives }));
  process.exit(0);
}

// --emit: rebuild the full observation set from the NDJSON progress log.
for (const line of (await readFile(NDJSON, "utf8")).split("\n").filter(Boolean)) {
  const entry = JSON.parse(line);
  for (const [productId, price, category] of entry.rows ?? []) {
    if (category === "85") { jpSealedIds.add(productId); if (!targets.has(productId)) targets.set(productId, pokemonSealedById.get(productId)); }
    observations.push({ productId, date: entry.date, cents: price });
  }
}

const fetchedAt = new Date().toISOString();
// Catalog stubs for every target (OR IGNORE: no-ops where the walk already landed them).
const seedStatements = [];
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const targetRecords = [...targets.values()].filter(Boolean);
for (const slice of chunk(targetRecords, 100)) {
  seedStatements.push(`insert or ignore into catalog_products (product_id,kind,game,section,name,set_name,release_year,rarity,card_number,printing,product_type,image_url,source_url,source_updated_at,ingestion_run_id) values\n${slice.map(p => `(${p.productId},'sealed',${esc(p.game)},null,${esc(p.name)},${esc(p.set)},null,null,null,null,${esc(p.category)},${esc(p.image)},${esc(p.url)},${esc(fetchedAt)},null)`).join(",\n")};`);
  seedStatements.push(`insert or ignore into current_prices (product_id,market_cents,listing_low_cents,median_cents,listing_high_cents,currency,observed_at,source,ingestion_run_id) values\n${slice.map(p => `(${p.productId},${num(cents(p.marketPrice))},null,${num(cents(p.midPrice))},null,'USD',${esc(fetchedAt)},'tcgcsv',null)`).join(",\n")};`);
  seedStatements.push(`insert or ignore into sealed_details (product_id,msrp_cents,msrp_source) values\n${slice.map(p => `(${p.productId},${num(cents(p.msrp))},${esc(p.msrpSource)})`).join(",\n")};`);
}
await writeFile(path.join(OUT, "catalog-seed.sql"), seedStatements.join("\n"));

observations.sort((a, b) => a.productId - b.productId || a.date.localeCompare(b.date));
const statements = chunk(observations, ROWS_PER_STATEMENT).map(slice =>
  `insert or ignore into price_observations (product_id,variant,condition,observed_date,market_cents,source,fetched_at) values\n${slice.map(o => `(${o.productId},'Sealed','Unopened','${o.date}',${o.cents},'tcgcsv-archive',${esc(fetchedAt)})`).join(",\n")};`);
const files = chunk(statements, STATEMENTS_PER_FILE);
for (const [index, fileStatements] of files.entries()) {
  await writeFile(path.join(OUT, `observations-${String(index + 1).padStart(3, "0")}.sql`), fileStatements.join("\n"));
}
console.log(JSON.stringify({ days: dates.length, missingArchives, targets: targetRecords.length, jpSealed: jpSealedIds.size, onepiece: onepieceFeed.length, observations: observations.length, observationFiles: files.length }, null, 1));
