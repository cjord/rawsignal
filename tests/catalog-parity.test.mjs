import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseCard, parseSealedProduct } from "../core/domain/contracts.ts";
import { createMemoryCatalogRepository } from "../core/catalog-repository.ts";
import { createD1CatalogRepository } from "../db/catalog-repository.ts";
import { completeIngestion, startIngestion, upsertCard, upsertSealedProduct } from "../db/repository.ts";

// Decision D5 parity suite: the D1 repository (SQL-narrowed candidates + facet queries
// + the shared engine) must return byte-identical pages to the pure in-memory engine
// over the same data, across the full option matrix. The SQL layer is only allowed to
// narrow to a SUPERSET of the engine's final row set — any tightening beyond the
// engine's own predicates shows up here as a missing item or a facet drift.

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

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:"); database.exec("pragma foreign_keys=on");
  const directory = new URL("../drizzle/", import.meta.url), names = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of names) { const migration = await readFile(new URL(name, directory), "utf8"); for (const statement of migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) database.exec(statement); }
  return database;
}

// --- Fixture universe: two games, a colliding set name, price/msrp edge rows, ---
// --- fuzzy targets, tie prices, off-vocabulary and case-variant categories.   ---

const RUN_ID = "parity-run", STALE_RUN_ID = "parity-stale", OBSERVED = "2026-08-30T12:00:00.000Z";

const cardFixture = (productId, overrides = {}) => ({
  game: "pokemon", section: "illustration-rares", productId, name: `Card ${productId}`, set: "Fixture Set",
  year: 2024, rarity: "Illustration Rare", number: `${productId}/100`, image: `https://example.com/${productId}.jpg`,
  url: `https://example.com/card/${productId}`, marketPrice: 10, lowPrice: 8, midPrice: 11, highPrice: 14,
  printing: "Holofoil", priceChange: null, ...overrides,
});

const cards = [
  cardFixture(101, { name: "Pikachu with Grey Felt Hat", marketPrice: 402.15, midPrice: 410 }),
  cardFixture(102, { name: "Umbreon ex - Special", section: "special-illustration-rares", marketPrice: 1450.5, midPrice: null, lowPrice: null, highPrice: null }),
  cardFixture(103, { name: "Boundary Card", marketPrice: 10, midPrice: 10 }),
  cardFixture(104, { name: "Boundary Neighbor Low", marketPrice: 9.99 }),
  cardFixture(105, { name: "Boundary Neighbor High", marketPrice: 10.01 }),
  cardFixture(106, { name: "Tie Alpha", marketPrice: 55.55 }),
  cardFixture(107, { name: "Tie Beta", marketPrice: 55.55 }),
  cardFixture(108, { name: "Unleashed Pokemon Single", set: "Unleashed", section: "promos", rarity: "Promo", marketPrice: 88.4 }),
  cardFixture(109, { game: "riftbound", section: "overnumbered", name: "Teemo Overnumber", set: "Origins", rarity: "Epic", marketPrice: 61.01, printing: "Normal" }),
  cardFixture(110, { game: "riftbound", section: "overnumbered", name: "Unleashed Rift Single", set: "Unleashed", rarity: "Rare", marketPrice: 3.02, printing: "Normal" }),
  cardFixture(111, { name: "Punctuation: The Card (Deluxe)", marketPrice: 19.95, section: "promos", rarity: "Promo" }),
];

const sealedFixture = (productId, overrides = {}) => {
  const base = {
    game: "pokemon", productId, name: `Sealed ${productId}`, set: "Fixture Set", category: "Booster Boxes",
    image: `https://example.com/s${productId}.jpg`, url: `https://example.com/sealed/${productId}`,
    msrp: 161.64, marketPrice: 240.25, midPrice: 250.1, msrpSource: "Publisher", ...overrides,
  };
  const profit = base.msrp == null || base.marketPrice == null ? null : base.marketPrice - base.msrp;
  return { ...base, profit, profitPct: profit == null || !base.msrp ? null : profit / base.msrp * 100 };
};

const sealed = [
  sealedFixture(201, { name: "Surging Sparks Booster Box" }),
  sealedFixture(202, { name: "Prismatic ETB", category: "Elite Trainer Boxes", msrp: 49.99, marketPrice: 91.3, midPrice: 90 }),
  sealedFixture(203, { name: "Regional Gift Bundle", category: "Boxes / Bundles", msrp: null, marketPrice: null, midPrice: null, msrpSource: null }),
  sealedFixture(204, { name: "Unpriced Median Box", msrp: 100, marketPrice: null, midPrice: 118.4 }),
  sealedFixture(205, { name: "Loss Leader Tin", category: "Tins", msrp: 24.99, marketPrice: 18.5, midPrice: 19 }),
  sealedFixture(206, { name: "Unleashed Booster Pack", set: "Unleashed", category: "Booster Packs", msrp: 4.99, marketPrice: 404.84, midPrice: 400 }),
  sealedFixture(207, { name: "Mystery Crate Oddity", category: "Booster Boxes" }), // becomes off-vocabulary below
  sealedFixture(208, { name: "Lowercase Packs", category: "Booster Packs", msrp: 4.99, marketPrice: 12.75, midPrice: 12 }), // becomes "booster packs" below
  sealedFixture(209, { game: "riftbound", name: "Unleashed - Booster Pack", set: "Unleashed", category: "Booster Packs", msrp: 5.99, marketPrice: 6.35, midPrice: 6.5 }),
  sealedFixture(210, { game: "riftbound", name: "Origins Champion Deck", set: "Origins", category: "Starter / Theme Decks", msrp: 19.99, marketPrice: 24.4, midPrice: null }),
  sealedFixture(211, { game: "onepiece", name: "Romance Dawn Booster Box", set: "Romance Dawn", category: "Booster Boxes", msrp: 89.99, marketPrice: 240.25, midPrice: 235 }),
  sealedFixture(212, { name: "Tie Box Alpha", marketPrice: 240.25, midPrice: 250.1 }),
  // Seeded as category "Other", then product_type is NULLed by direct SQL below —
  // toSealed's ?? "Other" and the SQL coalesce backstop must agree on this row.
  sealedFixture(213, { name: "Nullified Bundle", category: "Other", msrp: 30, marketPrice: 44.5, midPrice: null }),
];

// Post-seed rewrites applied straight to D1 AND to the reference objects: an
// off-vocabulary category (engine buckets it "Other") and a case-variant canonical.
const CATEGORY_REWRITES = { 207: "Mystery Crate", 208: "booster packs" };

const metricRows = [
  { productId: 101, variant: "Holofoil", change7Bps: 210, change30Bps: -1240, low30Cents: 39000, high30Cents: 42250, updatedAt: "2026-08-30T10:00:00Z" },
  // Older row for 101 under another variant: loadDerived must keep the LATEST row only.
  { productId: 101, variant: "Normal", change7Bps: -9999, change30Bps: 9999, low30Cents: 1, high30Cents: 2, updatedAt: "2026-08-29T10:00:00Z" },
  { productId: 102, variant: "Holofoil", change7Bps: -35, change30Bps: 480, low30Cents: 140000, high30Cents: 149000, updatedAt: "2026-08-30T10:01:00Z" },
  { productId: 106, variant: "Holofoil", change7Bps: 0, change30Bps: null, low30Cents: null, high30Cents: null, updatedAt: "2026-08-30T10:02:00Z" },
  { productId: 108, variant: "Holofoil", change7Bps: 150, change30Bps: 300, low30Cents: 8000, high30Cents: 9100, updatedAt: "2026-08-30T10:03:00Z" },
  { productId: 109, variant: "Normal", change7Bps: -220, change30Bps: -400, low30Cents: 5800, high30Cents: 6600, updatedAt: "2026-08-30T10:04:00Z" },
  { productId: 201, variant: "Sealed", change7Bps: 120, change30Bps: 890, low30Cents: 21000, high30Cents: 24500, updatedAt: "2026-08-30T10:05:00Z" },
  { productId: 205, variant: "Sealed", change7Bps: -60, change30Bps: -180, low30Cents: 1700, high30Cents: 2100, updatedAt: "2026-08-30T10:06:00Z" },
  { productId: 209, variant: "Sealed", change7Bps: 45, change30Bps: 95, low30Cents: 580, high30Cents: 680, updatedAt: "2026-08-30T10:07:00Z" },
  // Equal-timestamp variants: loadDerived's (updated_at desc, variant asc, condition asc)
  // tiebreak must pick "Alt" deterministically — history-backfill really writes multi-variant
  // rows with one shared timestamp.
  { productId: 202, variant: "Alt", change7Bps: 777, change30Bps: 120, low30Cents: 8000, high30Cents: 9500, updatedAt: "2026-08-30T10:08:00Z" },
  { productId: 202, variant: "Sealed", change7Bps: -777, change30Bps: -120, low30Cents: 7000, high30Cents: 9000, updatedAt: "2026-08-30T10:08:00Z" },
];

const signalRows = [
  { productId: 101, side: "buy", strictness: "balanced", score: 82, confidence: "high", reason: "Near 30D low", detail: "2.1% above the floor", distanceBps: 210, cutoffBps: 600 },
  { productId: 101, side: "buy", strictness: "conservative", score: 74, confidence: "medium", reason: "Near 30D low", detail: "conservative gate", distanceBps: 210, cutoffBps: 400 },
  { productId: 102, side: "sell", strictness: "balanced", score: 91, confidence: "high", reason: "At 30D high", detail: "0.4% under the ceiling", distanceBps: 40, cutoffBps: 500 },
  { productId: 108, side: "buy", strictness: "balanced", score: 55, confidence: "low", reason: "Drifting down", detail: "watch", distanceBps: 480, cutoffBps: 600 },
  { productId: 201, side: "buy", strictness: "balanced", score: 68, confidence: "medium", reason: "Sealed dip", detail: "buy window", distanceBps: 300, cutoffBps: 700 },
  { productId: 205, side: "sell", strictness: "aggressive", score: 61, confidence: "low", reason: "Peak fade", detail: "sell window", distanceBps: 90, cutoffBps: 400 },
];

async function seededDatabase() {
  const database = await migratedDatabase(), db = new LocalD1(database);
  await startIngestion(db, RUN_ID, "fixture", OBSERVED);
  for (const card of cards) await upsertCard(db, parseCard(card), OBSERVED, RUN_ID);
  for (const product of sealed) await upsertSealedProduct(db, parseSealedProduct(product), OBSERVED, RUN_ID);
  await completeIngestion(db, RUN_ID, "daily-market", OBSERVED, cards.length + sealed.length, cards.length + sealed.length);
  // A stale second run whose rows must stay invisible to a run-pinned repository. The
  // set/section/category are deliberately DISTINCT from every main-run value so a facet
  // query that loses its run pin leaks a visible "Stale Vault"/"stale-era"/"Troves" facet
  // and fails parity (delisted products keep their old run ids in production).
  await startIngestion(db, STALE_RUN_ID, "fixture", OBSERVED);
  await upsertCard(db, parseCard(cardFixture(901, { name: "Stale Card", set: "Stale Vault", section: "stale-era", marketPrice: 1 })), OBSERVED, STALE_RUN_ID);
  await upsertSealedProduct(db, parseSealedProduct(sealedFixture(902, { name: "Stale Sealed", set: "Stale Vault", category: "Troves" })), OBSERVED, STALE_RUN_ID);
  await completeIngestion(db, STALE_RUN_ID, "daily-market", OBSERVED, 2, 2);
  // Priceless singles under the MAIN run: one with no current_prices row, one with a NULL
  // market_cents. toCard drops both, so the engine's facets never see "Priceless Set" —
  // the facet queries' price-presence guards must exclude them the same way.
  await upsertCard(db, parseCard(cardFixture(120, { name: "Priceless Alpha", set: "Priceless Set", marketPrice: 1 })), OBSERVED, RUN_ID);
  await upsertCard(db, parseCard(cardFixture(121, { name: "Priceless Beta", set: "Priceless Set", marketPrice: 1 })), OBSERVED, RUN_ID);
  database.prepare("delete from current_prices where product_id=120").run();
  database.prepare("update current_prices set market_cents=null where product_id=121").run();
  database.prepare("update catalog_products set product_type=null where product_id=213").run();
  for (const [productId, category] of Object.entries(CATEGORY_REWRITES))
    database.prepare("update catalog_products set product_type=? where product_id=?").run(category, Number(productId));
  for (const row of metricRows)
    database.prepare(`insert into market_metrics (product_id,variant,condition,as_of_date,coverage,change_7_bps,change_30_bps,low_30_cents,high_30_cents,updated_at)
      values (?,?,?,?,?,?,?,?,?,?)`).run(row.productId, row.variant, "Near Mint", "2026-08-30", "exact", row.change7Bps, row.change30Bps, row.low30Cents, row.high30Cents, row.updatedAt);
  for (const row of signalRows)
    database.prepare(`insert into market_signals (product_id,side,strictness,score,confidence,reason,detail,distance_bps,cutoff_bps,as_of_date,observation_date,coverage)
      values (?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.productId, row.side, row.strictness, row.score, row.confidence, row.reason, row.detail, row.distanceBps, row.cutoffBps, "2026-08-30", "2026-08-30", "exact");
  return { database, db };
}

// Reference derived map — replicates db/catalog-repository loadDerived exactly:
// latest metrics row per product wins (updated_at desc, then variant asc — all fixture
// conditions are constant); the signal joins on side+strictness and is forced null on
// the leaderboard lens.
function referenceDerived(kindIds, options) {
  const side = options.signal === "leaderboard" ? "buy" : options.signal;
  const derived = {};
  for (const row of [...metricRows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.variant.localeCompare(b.variant))) {
    if (!kindIds.has(row.productId) || derived[row.productId]) continue;
    const signal = signalRows.find(s => s.productId === row.productId && s.side === side && s.strictness === options.strictness) ?? null;
    derived[row.productId] = {
      change7: row.change7Bps == null ? null : row.change7Bps / 100,
      change30: row.change30Bps == null ? null : row.change30Bps / 100,
      low30: row.low30Cents == null ? null : row.low30Cents / 100,
      high30: row.high30Cents == null ? null : row.high30Cents / 100,
      signal: options.signal === "leaderboard" || !signal ? null : {
        side: signal.side, score: signal.score, confidence: signal.confidence,
        reason: signal.reason, detail: signal.detail, distance: signal.distanceBps / 100, cutoff: signal.cutoffBps / 100,
      },
    };
  }
  return derived;
}

// The engine references, fed rows in productId order to match the D1 path's
// deterministic ORDER BY (stable-sort tie order must agree on both sides).
const referenceCards = [...cards].sort((a, b) => a.productId - b.productId);
const referenceSealed = [...sealed].sort((a, b) => a.productId - b.productId)
  .map(product => CATEGORY_REWRITES[product.productId] ? { ...product, category: CATEGORY_REWRITES[product.productId] } : product);
const cardIds = new Set(cards.map(card => card.productId));
const sealedIds = new Set(sealed.map(product => product.productId));

const singlesDefaults = {
  market: "pokemon", sections: [], query: "", sets: [], minPrice: "", maxPrice: "",
  up7: false, down7: false, up30: false, down30: false, signal: "leaderboard", strictness: "balanced",
  sort: "market", direction: "desc", page: 1, perPage: 5,
};
const sealedDefaults = {
  market: "pokemon", productTypes: [], query: "", sets: [], marketMin: "", marketMax: "",
  msrpMin: "", msrpMax: "", profitMin: "", profitMax: "", profitPctMin: "", profitPctMax: "",
  profitableOnly: false, basis: "market", keepPct: 100, taxOn: false, taxRate: 8, shipping: 0,
  signal: "leaderboard", strictness: "balanced", sort: "market", direction: "desc", page: 1, perPage: 5,
};

const singlesVariations = [
  ...["market", "name", "set", "signal", "low", "high", "change7", "change30"].flatMap(sort => [{ sort, direction: "asc" }, { sort, direction: "desc" }]),
  { market: "riftbound" }, { market: "riftbound", sections: ["overnumbered"] },
  { sections: ["illustration-rares"] }, { sections: ["promos", "special-illustration-rares"] }, { sections: ["missing-section"] },
  { sets: ["Unleashed"] }, { sets: ["Fixture Set", "Unleashed"] }, { sets: ["No Such Set"] },
  { query: "pikachu felt" }, { query: "umbreon" }, { query: "PUNCTUATION deluxe" }, { query: "zzz-no-match" }, { query: "1/100" },
  { minPrice: "10" }, { maxPrice: "10" }, { minPrice: "10", maxPrice: "10" }, { minPrice: "9.995" }, { maxPrice: "55.55" }, { minPrice: "not-a-number" },
  { up7: true }, { down7: true }, { up30: true }, { down30: true }, { up7: true, down7: true }, { up7: true, down30: true },
  ...["buy", "sell"].flatMap(signal => ["conservative", "balanced", "aggressive"].map(strictness => ({ signal, strictness }))),
  { page: 2 }, { page: 999 }, { perPage: 2 }, { perPage: 50 },
  { sort: "market", direction: "desc", perPage: 2, page: 2 }, // tie split across pages
];

const sealedVariations = [
  ...["market", "name", "set", "signal", "msrp", "low", "high", "change7", "change30", "profit", "profitPct"].flatMap(sort => [{ sort, direction: "asc" }, { sort, direction: "desc" }]),
  { market: "riftbound" }, { market: "onepiece" },
  { productTypes: ["Booster Packs"] }, { productTypes: ["Booster Boxes", "Tins"] }, { productTypes: ["Other"] },
  { productTypes: ["Other", "Booster Packs"] }, { productTypes: ["booster packs"] }, { productTypes: ["Mystery Crate"] },
  { sets: ["Unleashed"] }, { sets: ["No Such Set"] },
  { query: "unleashed booster" }, { query: "crate" }, { query: "Booster Packs" }, { query: "zzz-no-match" },
  { marketMin: "100" }, { marketMax: "100" }, { marketMin: "6.35", marketMax: "6.35" },
  { basis: "median" }, { basis: "median", marketMin: "118.40" }, { basis: "median", sort: "market", direction: "asc" },
  { msrpMin: "49.99" }, { msrpMax: "5" }, { msrpMin: "not-a-number" },
  { profitMin: "0" }, { profitMin: "50" }, { profitMax: "0" }, { profitPctMin: "80" }, { profitPctMax: "-1" }, { profitableOnly: true },
  { profitableOnly: true, keepPct: 85, taxOn: true, taxRate: 8, shipping: 4.5 },
  { keepPct: 85 }, { taxOn: true }, { shipping: 12.5 }, { basis: "median", keepPct: 90, taxOn: true, shipping: 3 },
  ...["buy", "sell"].flatMap(signal => ["balanced", "aggressive"].map(strictness => ({ signal, strictness }))),
  { page: 2 }, { page: 999 }, { perPage: 2 }, { perPage: 50 },
];

// Deterministic LCG for the interaction sweep (Math.random is banned by convention here:
// a seeded generator keeps failures reproducible).
function lcg(seed) { let state = seed; return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648; }
const pick = (random, values) => values[Math.floor(random() * values.length)];

function randomSinglesOptions(random) {
  return {
    ...singlesDefaults,
    market: pick(random, ["pokemon", "riftbound"]),
    sections: pick(random, [[], ["illustration-rares"], ["overnumbered"], ["promos", "illustration-rares"]]),
    query: pick(random, ["", "unleashed", "tie", "card"]),
    sets: pick(random, [[], ["Unleashed"], ["Fixture Set"]]),
    minPrice: pick(random, ["", "5", "55.55", "100"]),
    maxPrice: pick(random, ["", "20", "55.55", "500"]),
    up7: random() < 0.3, down7: random() < 0.3, up30: random() < 0.3, down30: random() < 0.3,
    signal: pick(random, ["leaderboard", "buy", "sell"]),
    strictness: pick(random, ["conservative", "balanced", "aggressive"]),
    sort: pick(random, ["market", "name", "set", "signal", "low", "high", "change7", "change30"]),
    direction: pick(random, ["asc", "desc"]),
    page: pick(random, [1, 2, 3]),
    perPage: pick(random, [2, 5, 20]),
  };
}

function randomSealedOptions(random) {
  return {
    ...sealedDefaults,
    market: pick(random, ["pokemon", "riftbound", "onepiece"]),
    productTypes: pick(random, [[], ["Booster Packs"], ["Other"], ["Booster Boxes", "Booster Packs"], ["Tins", "Other"]]),
    query: pick(random, ["", "unleashed", "box"]),
    sets: pick(random, [[], ["Unleashed"], ["Fixture Set"]]),
    marketMin: pick(random, ["", "6", "100"]), marketMax: pick(random, ["", "6.35", "250"]),
    msrpMin: pick(random, ["", "5"]), msrpMax: pick(random, ["", "100"]),
    profitMin: pick(random, ["", "0", "50"]), profitMax: pick(random, ["", "100"]),
    profitPctMin: pick(random, ["", "10"]), profitPctMax: pick(random, ["", "500"]),
    profitableOnly: random() < 0.3,
    basis: pick(random, ["market", "median"]),
    keepPct: pick(random, [100, 85]), taxOn: random() < 0.4, taxRate: pick(random, [0, 8]), shipping: pick(random, [0, 4.5]),
    signal: pick(random, ["leaderboard", "buy", "sell"]),
    strictness: pick(random, ["balanced", "aggressive"]),
    sort: pick(random, ["market", "name", "set", "signal", "msrp", "profit", "profitPct", "change30"]),
    direction: pick(random, ["asc", "desc"]),
    page: pick(random, [1, 2]),
    perPage: pick(random, [2, 5, 20]),
  };
}

test("D1 singles queries match the pure engine across the option matrix", async () => {
  const { database, db } = await seededDatabase();
  const repository = createD1CatalogRepository(db, RUN_ID);
  const memory = createMemoryCatalogRepository(referenceCards, []);
  const random = lcg(20260830);
  const optionSets = [singlesDefaults, ...singlesVariations.map(variation => ({ ...singlesDefaults, ...variation })),
    ...Array.from({ length: 250 }, () => randomSinglesOptions(random))];
  for (const options of optionSets) {
    const [d1Page, memoryPage] = [await repository.querySingles(options), await memory.querySingles(options, referenceDerived(cardIds, options))];
    assert.deepEqual(d1Page, memoryPage, `singles parity failed for ${JSON.stringify(options)}`);
  }
  database.close();
});

test("D1 sealed queries match the pure engine across the option matrix", async () => {
  const { database, db } = await seededDatabase();
  const repository = createD1CatalogRepository(db, RUN_ID);
  const memory = createMemoryCatalogRepository([], referenceSealed);
  const random = lcg(20260831);
  const optionSets = [sealedDefaults, ...sealedVariations.map(variation => ({ ...sealedDefaults, ...variation })),
    ...Array.from({ length: 250 }, () => randomSealedOptions(random))];
  for (const options of optionSets) {
    const [d1Page, memoryPage] = [await repository.querySealed(options), await memory.querySealed(options, referenceDerived(sealedIds, options))];
    assert.deepEqual(d1Page, memoryPage, `sealed parity failed for ${JSON.stringify(options)}`);
  }
  database.close();
});

test("a run-pinned repository never surfaces another run's rows", async () => {
  const { database, db } = await seededDatabase();
  const repository = createD1CatalogRepository(db, RUN_ID);
  const singles = await repository.querySingles({ ...singlesDefaults, query: "stale", perPage: 50 });
  const sealedPage = await repository.querySealed({ ...sealedDefaults, query: "stale", perPage: 50 });
  assert.equal(singles.total, 0);
  assert.equal(sealedPage.total, 0);
  // Facets are run-pinned too: the stale run's distinct set/section/category must not leak.
  assert.equal(singles.facets.sets.includes("Stale Vault"), false);
  assert.equal(singles.facets.sections.includes("stale-era"), false);
  assert.equal(sealedPage.facets.sets.includes("Stale Vault"), false);
  assert.equal(sealedPage.facets.productTypes.includes("Troves"), false);
  const unpinned = createD1CatalogRepository(db);
  const unpinnedSingles = await unpinned.querySingles({ ...singlesDefaults, query: "stale", perPage: 50 });
  assert.equal(unpinnedSingles.total, 1);
  assert.equal(unpinnedSingles.facets.sets.includes("Stale Vault"), true);
  database.close();
});

test("the aggregate D1 scopes keep their pre-pushdown semantics (empty pages)", async () => {
  // The route hands market straight to the repository; "all" and "scalping" have never
  // matched a D1 game value and must stay empty rather than throwing (the feed
  // fallback owns those scopes).
  const { database, db } = await seededDatabase();
  const repository = createD1CatalogRepository(db, RUN_ID);
  const singles = await repository.querySingles({ ...singlesDefaults, market: "all" });
  const scalping = await repository.querySealed({ ...sealedDefaults, market: "scalping" });
  assert.deepEqual({ total: singles.total, items: singles.items, facets: singles.facets }, { total: 0, items: [], facets: { sets: [], sections: [], productTypes: [] } });
  assert.deepEqual({ total: scalping.total, items: scalping.items, facets: scalping.facets }, { total: 0, items: [], facets: { sets: [], sections: [], productTypes: [] } });
  database.close();
});
