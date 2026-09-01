import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseCards, parseSealedProducts, parseCatalogDetailEnrichments } from "../../core/domain/contracts.ts";
import { allowedRarities } from "../../core/market-state.ts";
import { persistDerivedHistory, runDailyMarketIngestion } from "../../db/daily-ingestion.ts";
import { runMetricsRollup } from "../../db/metrics-ingestion.ts";
import { completeIngestion, startIngestion, upsertProductDetail } from "../../db/repository.ts";

// Local max-profile database, phase 2 (docs/local-database.md): assemble
// .wrangler/local-profiles/max.sqlite from the bundled feeds plus the archive
// observation log produced by parse-archives.mjs. Strictly local development tooling —
// this database is richer than staging/production D1 (full 2.5-year daily history for
// every tracked product, at zero cloud cost) and never leaves the machine
// (.wrangler/ is gitignored and absent from deploy bundles).
//   node scripts/local-db/build-local-db.mjs
// Steps: migrate → catalog seed (same ingestion code the Worker runs) → detail
// enrichments → archive observations → per-product derived metrics/signals → metrics
// rollup backfill → readiness markers. Swap it in with `npm run db:local:max`.

const OUT = path.resolve(".wrangler/local-profiles");
const NDJSON = path.join(OUT, "archive-observations.ndjson");
const TARGET = path.join(OUT, "max.sqlite");

class LocalStatement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { return this.statement.run(...this.values); }
  async first() { return this.statement.get(...this.values) ?? null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class LocalD1 {
  constructor(database) { this.database = database; }
  prepare(sql) { return new LocalStatement(this.database.prepare(sql)); }
  async batch(statements) { this.database.exec("begin"); try { const results = []; for (const statement of statements) results.push(await statement.run()); this.database.exec("commit"); return results; } catch (error) { this.database.exec("rollback"); throw error; } }
}

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const now = new Date(), nowIso = now.toISOString();

if (!existsSync(NDJSON)) throw new Error("Run scripts/local-db/parse-archives.mjs to completion first (archive-observations.ndjson missing)");

await mkdir(OUT, { recursive: true });
await rm(TARGET, { force: true });
await rm(`${TARGET}-wal`, { force: true });
await rm(`${TARGET}-shm`, { force: true });
const database = new DatabaseSync(TARGET);
database.exec("pragma journal_mode = wal; pragma synchronous = off; pragma foreign_keys = on;");
const db = new LocalD1(database);

// 1. Migrations (same harness as the tests).
const migrationsDir = new URL("../../drizzle/", import.meta.url);
const { readdir } = await import("node:fs/promises");
const names = (await readdir(migrationsDir)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
for (const name of names) {
  const migration = await readFile(new URL(name, migrationsDir), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) database.exec(statement);
}
console.error(`migrated (${names.length} files)`);

// 2. Catalog seed through the real ingestion path (writes catalog, prices, day-one
// observations, derived metrics/signals, and the daily-market readiness marker).
const sections = [...new Set([...allowedRarities.pokemon, ...allowedRarities.riftbound])].filter(section => section !== "all");
const cards = [];
for (const section of sections) {
  try { cards.push(...parseCards(await readJson(`public/data/${section}.json`))); } catch { /* optional section */ }
}
const sealed = [];
for (const market of ["pokemon", "riftbound", "onepiece"]) {
  try { sealed.push(...parseSealedProducts(await readJson(`public/data/sealed-${market}.json`))); } catch { /* optional */ }
}
const seenIds = new Set(), uniqueCards = [], uniqueSealed = [];
for (const card of cards) { if (!seenIds.has(card.productId)) { seenIds.add(card.productId); uniqueCards.push(card); } }
for (const product of sealed) { if (!seenIds.has(product.productId)) { seenIds.add(product.productId); uniqueSealed.push(product); } }
await runDailyMarketIngestion(db, { cards: uniqueCards, sealed: uniqueSealed, source: "local-max-seed", sourceUpdatedAt: nowIso, schemaVersion: 1 }, now);
console.error(`catalog seeded: ${uniqueCards.length} singles, ${uniqueSealed.length} sealed`);

// 3. Detail enrichments (D1 detail pages).
let detailCount = 0;
try {
  const manifest = await readJson("public/data/detail-manifest.json");
  for (const chunkPath of [...new Set(Object.values(manifest))]) {
    const enrichments = parseCatalogDetailEnrichments(await readJson(`public${chunkPath}`));
    database.exec("begin");
    for (const enrichment of enrichments) { if (seenIds.has(enrichment.productId)) { await upsertProductDetail(db, enrichment); detailCount++; } }
    database.exec("commit");
  }
} catch (error) { console.error(`detail enrichment skipped: ${error.message}`); }
console.error(`details: ${detailCount}`);

// 4. Archive observations (full history for singles AND sealed).
const insert = database.prepare(`insert into price_observations (product_id,variant,condition,observed_date,market_cents,source,fetched_at)
  values (?,?,?,?,?,'tcgcsv-archive',?) on conflict(product_id,variant,condition,observed_date) do nothing`);
const printingOf = new Map(uniqueCards.map(card => [card.productId, card.printing ?? "Normal"]));
let observationCount = 0;
database.exec("begin");
for (const line of (await readFile(NDJSON, "utf8")).split("\n").filter(Boolean)) {
  let entry;
  try { entry = JSON.parse(line); } catch { continue; } // truncated tail from a killed parse
  for (const [productId, cents, flag] of entry.rows ?? []) {
    if (!seenIds.has(productId)) continue;
    const [variant, condition] = flag === "S" ? ["Sealed", "Unopened"] : [printingOf.get(productId) ?? "Normal", "Near Mint"];
    insert.run(productId, variant, condition, entry.date, cents, nowIso);
    if (++observationCount % 200000 === 0) { database.exec("commit"); database.exec("begin"); console.error(`observations: ${observationCount}`); }
  }
}
database.exec("commit");
console.error(`observations loaded: ${observationCount}`);

// 5. Re-derive metrics + signals from the full history (the seed derived from 1 point).
const products = database.prepare(`select p.product_id as productId, p.kind, p.printing, cp.market_cents as marketCents
  from catalog_products p join current_prices cp on cp.product_id=p.product_id where cp.market_cents>0`).all();
const history = database.prepare(`select observed_date as date, market_cents as cents from price_observations
  where product_id=? and variant=? and condition=? order by observed_date`);
let derived = 0;
for (const product of products) {
  const [variant, condition] = product.kind === "sealed" ? ["Sealed", "Unopened"] : [product.printing ?? "Normal", "Near Mint"];
  const points = history.all(product.productId, variant, condition).map(row => ({ date: row.date, price: row.cents / 100 }));
  if (points.length < 2) continue;
  await persistDerivedHistory(db, product.productId, variant, condition, product.marketCents / 100, points, "exact", nowIso);
  if (++derived % 2000 === 0) console.error(`derived: ${derived}/${products.length}`);
}
console.error(`derived: ${derived}`);

// 6. Metrics rollup backfill (index/median series across the whole archive range).
const rollup = await runMetricsRollup(db, { mode: "backfill" });
console.error(`metrics: ${rollup.series} series, ${rollup.seriesRows} rows`);

// 7. Signal readiness marker so the persisted-signal surfaces go live locally.
const signalRunId = `local-max-history:${nowIso.slice(0, 10)}`;
await startIngestion(db, signalRunId, "local-max-seed", nowIso);
await completeIngestion(db, signalRunId, "history-signals", nowIso, derived, derived);

database.exec("pragma user_version = 2;"); // tags this file as the max profile
database.exec("pragma wal_checkpoint(truncate);");
database.close();
const signals = new DatabaseSync(TARGET, { readOnly: true });
const counts = Object.fromEntries(["catalog_products", "price_observations", "market_signals", "market_metrics", "market_daily_metrics", "product_details"].map(table => [table, signals.prepare(`select count(*) n from "${table}"`).get().n]));
signals.close();
console.log(JSON.stringify({ profile: TARGET, ...counts }, null, 1));
