import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseCard } from "../core/domain/contracts.ts";
import { classifyRegime } from "../core/domain/regime.ts";
import { marketSignal } from "../core/signal-utils.ts";
import { persistDerivedHistory, shadowSignalStatements, signalStatements } from "../db/daily-ingestion.ts";
import { startIngestion, upsertCard } from "../db/repository.ts";

// The derived pass — metrics row, six champion signal rows, two shadow rows — against a
// migrated in-memory D1. Points come from the signal characterization fixtures so the
// expected signals are the ones the evaluator itself pins.

class LocalStatement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { return this.statement.run(...this.values); }
  async first() { return this.statement.get(...this.values) ?? null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class LocalD1 {
  constructor(database) { this.database = database; this.batches = 0; }
  prepare(sql) { return new LocalStatement(this.database.prepare(sql)); }
  async batch(statements) {
    this.batches += 1;
    this.database.exec("begin");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.database.exec("commit"); return results; }
    catch (error) { this.database.exec("rollback"); throw error; }
  }
}
async function migratedDatabase() {
  const database = new DatabaseSync(":memory:"); database.exec("pragma foreign_keys=on");
  const directory = new URL("../drizzle/", import.meta.url), names = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of names) { const migration = await readFile(new URL(name, directory), "utf8"); for (const statement of migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) database.exec(statement); }
  return database;
}

const { fixtures } = JSON.parse(await readFile(new URL("./fixtures/signal-cases.json", import.meta.url), "utf8"));
const OBSERVED = "2026-01-31T12:00:00.000Z";
const PRODUCT = 664881;

async function seeded() {
  const database = await migratedDatabase(), db = new LocalD1(database);
  await startIngestion(db, "derived-run", "fixture", OBSERVED);
  await upsertCard(db, parseCard({
    game: "pokemon", section: "illustration-rares", productId: PRODUCT, name: "Fixture Card", set: "Surging Sparks", year: 2024,
    rarity: "Illustration Rare", number: "1/191", image: "https://example.com/1.jpg", url: "https://example.com/c/1", marketPrice: 14, lowPrice: 12,
    midPrice: 14, highPrice: 16, printing: "Holofoil", priceChange: null,
  }), OBSERVED, "derived-run");
  db.batches = 0; // count only the derived pass, not the seeding batch
  return { database, db };
}

// node:sqlite rows carry a null prototype; copy them so deepEqual compares plain objects.
const rows = (database, sql) => database.prepare(sql).all(PRODUCT).map(row => ({ ...row }));
const signalRows = database => rows(database, "select side, strictness, score from market_signals where product_id=? order by side, strictness");
const shadowRows = database => rows(database, "select side, score from shadow_signals where product_id=? order by side");
const metricsRow = database => database.prepare("select as_of_date as asOfDate, coverage, regime, sales_7 as sales7, sales_30 as sales30, sales_30_prior as sales30Prior from market_metrics where product_id=?").get(PRODUCT);

// What the evaluator says for these points under the context the derived pass builds on
// an empty database: no stored liquidity, no demand buckets, no cohort, regime from points.
function expectedSignals(points, currentPrice, model) {
  const context = { liquidity: null, demand: null, regime: classifyRegime(points, currentPrice, null, undefined), cohort: null, ...(model ? { model } : {}) };
  const out = [];
  for (const strictness of model ? ["balanced"] : ["conservative", "balanced", "aggressive"])
    for (const side of ["buy", "sell"]) {
      const signal = marketSignal(points, side, strictness, currentPrice, context);
      if (signal) out.push({ side, strictness, score: signal.score });
    }
  return out.sort((a, b) => a.side.localeCompare(b.side) || a.strictness.localeCompare(b.strictness));
}

test("the derived pass writes metrics, champion signals, and shadow rows in one batch", async () => {
  const { database, db } = await seeded();
  const points = fixtures.breakout, current = points.at(-1).price;
  const result = await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", current, points, "exact", OBSERVED);
  const expected = expectedSignals(points, current);
  assert.ok(expected.length > 0, "the breakout fixture must produce at least one champion signal");
  assert.deepEqual(result, { signalsWritten: expected.length, eligible: true });
  assert.deepEqual(signalRows(database), expected);
  assert.deepEqual(shadowRows(database).map(row => row.side), expectedSignals(points, current, "v2").map(s => s.side));
  const metrics = metricsRow(database);
  assert.equal(metrics.asOfDate, points.at(-1).date);
  assert.equal(metrics.coverage, "exact");
  assert.equal(typeof metrics.regime, "string");
  // No sales buckets on a daily pass: liquidity columns stay null rather than being zeroed.
  assert.equal(metrics.sales30, null);
  assert.equal(db.batches, 1, "metrics + signals + shadow land in a single batch");
});

test("a later pass deletes the signals that no longer qualify in the same batch that writes the new ones", async () => {
  const { database, db } = await seeded();
  const sellPoints = fixtures.breakout, buyPoints = fixtures.bounce;
  await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", sellPoints.at(-1).price, sellPoints, "exact", OBSERVED);
  assert.ok(signalRows(database).some(row => row.side === "sell"));
  const result = await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", buyPoints.at(-1).price, buyPoints, "exact", OBSERVED);
  const expected = expectedSignals(buyPoints, buyPoints.at(-1).price);
  assert.ok(expected.length > 0 && expected.every(row => row.side === "buy"), "the bounce fixture must produce only buy signals");
  assert.equal(result.signalsWritten, expected.length);
  assert.deepEqual(signalRows(database), expected);
  assert.equal(db.batches, 2);
});

test("a single observation is ineligible: metrics land, every signal row is cleared", async () => {
  const { database, db } = await seeded();
  await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", 14, fixtures.breakout, "exact", OBSERVED);
  const result = await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", 14, [{ date: "2026-01-31", price: 14 }], "fallback", OBSERVED);
  assert.deepEqual(result, { signalsWritten: 0, eligible: false });
  assert.deepEqual(signalRows(database), []);
  assert.deepEqual(shadowRows(database), []);
  assert.equal(metricsRow(database).coverage, "fallback");
});

test("sales buckets from a history fetch persist the liquidity and demand columns", async () => {
  const { database, db } = await seeded();
  const points = fixtures.breakout, last = points.at(-1).date;
  const day = offset => { const d = new Date(`${last}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - offset); return d.toISOString().slice(0, 10); };
  const bucket = (offset, quantity) => ({ date: day(offset), quantity, low: 10, high: 20, lowWithShipping: null, highWithShipping: null });
  const sales = { windowDays: 90, totalQuantity: 9, totalTransactions: 9, buckets: [bucket(45, 4), bucket(20, 3), bucket(2, 2)] };
  await persistDerivedHistory(db, PRODUCT, "Holofoil", "Near Mint", points.at(-1).price, points, "exact", OBSERVED, sales);
  const metrics = metricsRow(database);
  assert.equal(metrics.sales7, 2);
  assert.equal(metrics.sales30, 5);
  assert.equal(metrics.sales30Prior, 4);
});

test("the statement builders produce exactly one write per side × strictness and per shadow side", () => {
  const captured = [];
  const db = { prepare: sql => ({ bind: (...values) => { const s = { sql, values }; captured.push(s); return s; } }) };
  const points = fixtures.breakout, current = points.at(-1).price;
  const context = { liquidity: null, demand: null, regime: classifyRegime(points, current, null, undefined), cohort: null };
  const champion = signalStatements(db, PRODUCT, points, current, "2026-01-31", "exact", context);
  assert.equal(champion.writes.length, 6);
  assert.equal(champion.signalsWritten, expectedSignals(points, current).length);
  assert.equal(champion.writes.filter(w => /insert into market_signals/i.test(w.sql)).length, champion.signalsWritten);
  assert.equal(champion.writes.filter(w => /delete from market_signals/i.test(w.sql)).length, 6 - champion.signalsWritten);
  const shadow = shadowSignalStatements(db, PRODUCT, points, current, "2026-01-31", OBSERVED, context);
  assert.equal(shadow.length, 2);
});
