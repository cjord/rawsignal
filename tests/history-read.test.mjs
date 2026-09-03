import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseCard } from "../core/domain/contracts.ts";
import { readStoredHistories, readStoredHistory, selectStoredSeries } from "../db/history-read.ts";
import { startIngestion, upsertCard, upsertHistory } from "../db/repository.ts";

class LocalStatement { constructor(s) { this.s = s; this.v = []; } bind(...v) { this.v = v; return this; } async run() { return this.s.run(...this.v); } async first() { return this.s.get(...this.v) ?? null; } async all() { return { results: this.s.all(...this.v) }; } }
class LocalD1 { constructor(d) { this.d = d; this.prepared = 0; } prepare(sql) { this.prepared++; return new LocalStatement(this.d.prepare(sql)); } async batch(st) { const out = []; for (const s of st) out.push(await s.run()); return out; } }
async function migratedDatabase() {
  const database = new DatabaseSync(":memory:"); database.exec("pragma foreign_keys=on");
  const directory = new URL("../drizzle/", import.meta.url), names = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of names) { const migration = await readFile(new URL(name, directory), "utf8"); for (const statement of migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) database.exec(statement); }
  return database;
}

const points = (...prices) => prices.map((price, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, price }));

test("series selection: exact printing, sealed fallback by condition, then the first series on file", () => {
  const series = [
    { variant: "Normal", condition: "Near Mint", points: points(1) },
    { variant: "Holofoil", condition: "Near Mint", points: points(2) },
    { variant: "Holofoil", condition: "Lightly Played", points: points(3) },
    { variant: "Sealed", condition: "Unopened", points: points(4) },
  ];
  assert.equal(selectStoredSeries(series, "holofoil", false)?.coverage, "exact");
  assert.equal(selectStoredSeries(series, "holofoil", false)?.points[0].price, 2);
  // Singles only consider Near Mint; an unknown printing falls back to the first Near Mint series.
  assert.deepEqual(selectStoredSeries(series, "Etched", false), { variant: "Normal", condition: "Near Mint", points: points(1), coverage: "fallback" });
  // Sealed products may match any condition; a missing variant prefers a sealed-looking condition.
  assert.equal(selectStoredSeries(series, "Box", true)?.variant, "Sealed");
  assert.equal(selectStoredSeries([], "Normal", false), null);
  assert.equal(selectStoredSeries(undefined, "Normal", false), null);
});

test("one stored read per product and one batched read for a page agree, and the batch is a single statement", async () => {
  const database = await migratedDatabase(), db = new LocalD1(database);
  const observed = "2026-08-03T00:00:00Z";
  await startIngestion(db, "hist-run", "fixture", observed);
  const card = (productId, printing) => parseCard({ game: "pokemon", section: "illustration-rares", productId, name: `Card ${productId}`, set: "Surging Sparks", year: 2024, rarity: "Illustration Rare", number: `${productId}/191`, image: "https://example.com/i.jpg", url: "https://example.com/c", marketPrice: 10, lowPrice: 9, midPrice: 10, highPrice: 11, printing, priceChange: null });
  await upsertCard(db, card(1, "Holofoil"), observed, "hist-run");
  await upsertCard(db, card(2, "Normal"), observed, "hist-run");
  await upsertHistory(db, 1, "Holofoil", "Near Mint", points(10, 11, 12), "2026-08-03T00:00:00Z");
  await upsertHistory(db, 1, "Normal", "Near Mint", points(5, 6), "2026-08-03T00:00:00Z");
  await upsertHistory(db, 2, "Sealed", "Unopened", points(100, 101), "2026-08-03T00:00:00Z");
  const single = await readStoredHistory(db, 1, "Holofoil", false);
  assert.equal(single?.coverage, "exact");
  assert.deepEqual(single?.points.map(p => p.price), [10, 11, 12]);
  assert.equal((await readStoredHistory(db, 1, "Etched", false))?.coverage, "fallback");
  assert.equal(await readStoredHistory(db, 3, "Normal", false), null);

  db.prepared = 0;
  const batch = await readStoredHistories(db, [
    { productId: 1, printing: "Holofoil" },
    { productId: 1, printing: "Normal" },
    { productId: 2, printing: "Normal", sealed: true },
    { productId: 3, printing: "Normal" },
  ]);
  assert.equal(db.prepared, 1, "the whole page is one statement");
  assert.deepEqual(batch.get("single:1:holofoil"), single);
  assert.deepEqual(batch.get("single:1:normal")?.points.map(p => p.price), [5, 6]);
  assert.equal(batch.get("sealed:2:normal")?.coverage, "fallback");
  assert.equal(batch.get("sealed:2:normal")?.variant, "Sealed");
  assert.equal(batch.get("single:3:normal"), null);
  assert.deepEqual(await readStoredHistories(db, []), new Map());
});
