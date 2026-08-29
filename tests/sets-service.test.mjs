import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { setGroupKey, setGroupsFor } from "../core/domain/eras.ts";
import { setSlug } from "../core/domain/formatters.ts";
import { parseCard, parseSealedProduct } from "../core/domain/contracts.ts";
import { completeIngestion, startIngestion, upsertCard, upsertSealedProduct } from "../db/repository.ts";
import { loadSetDetail, loadSetsDirectory } from "../db/sets-service.ts";

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

test("set grouping folds every market into its ordered group list", () => {
  assert.equal(setGroupKey("pokemon", "Surging Sparks", 2024), "sv");
  assert.equal(setGroupKey("pokemon", "Mega Evolution", 2025), "me");
  assert.equal(setGroupKey("pokemon", "Skyridge", 2003), "wotc");
  assert.equal(setGroupKey("riftbound", "Origins", 2025), "core");
  assert.equal(setGroupKey("riftbound", "Riftbound Promo Cards", 2025), "other");
  assert.equal(setGroupKey("onepiece", "Starter Deck 31: RED Monkey.D.Luffy", 2023), "st");
  assert.equal(setGroupKey("onepiece", "Set Sail Deck Set", 2023), "st");
  assert.equal(setGroupKey("onepiece", "Extra Booster: Memorial Collection", 2024), "eb");
  assert.equal(setGroupKey("onepiece", "One Piece Promotion Cards", 2023), "other");
  assert.equal(setGroupKey("onepiece", "The Time of Battle", 2024), "main");
  // Pokémon display order leads with the newest era; unknown games get one bucket.
  assert.equal(setGroupsFor("pokemon")[0].key, "me");
  assert.deepEqual(setGroupsFor("lorcana").map(group => group.key), ["other"]);
  assert.equal(setSlug("Scarlet & Violet 151"), "scarlet-and-violet-151");
  assert.equal(setSlug("HS—Unleashed"), "hs-unleashed");
});

const card = (productId, overrides = {}) => parseCard({
  game: "pokemon", section: "illustration-rares", productId, name: `Card ${productId}`, set: "Surging Sparks",
  year: 2024, rarity: "Illustration Rare", number: `${productId}/191`, image: `https://example.com/${productId}.jpg`,
  url: `https://example.com/c/${productId}`, marketPrice: 50, lowPrice: 40, midPrice: 52, highPrice: 60,
  printing: "Holofoil", priceChange: null, ...overrides,
});
const sealedProduct = (productId, overrides = {}) => parseSealedProduct({
  game: "pokemon", productId, name: `Sealed ${productId}`, set: "Surging Sparks", category: "Booster Packs",
  image: null, url: `https://example.com/s/${productId}`, msrp: 4.99, marketPrice: 9, midPrice: 9.5,
  profit: null, profitPct: null, msrpSource: null, ...overrides,
});

async function seeded() {
  const database = await migratedDatabase(), db = new LocalD1(database), observed = "2026-08-29T12:00:00.000Z";
  await startIngestion(db, "sets-run", "fixture", observed);
  // Surging Sparks: three singles (10/40/90 => median 40) and a pack + box.
  await upsertCard(db, card(1, { marketPrice: 10 }), observed, "sets-run");
  await upsertCard(db, card(2, { marketPrice: 40 }), observed, "sets-run");
  await upsertCard(db, card(3, { marketPrice: 90 }), observed, "sets-run");
  await upsertSealedProduct(db, sealedProduct(10, { marketPrice: 15 }), observed, "sets-run");
  await upsertSealedProduct(db, sealedProduct(11, { name: "Surging Box", category: "Booster Boxes", msrp: 161.64, marketPrice: 240 }), observed, "sets-run");
  // A colliding riftbound "Surging Sparks" must stay a separate row.
  await upsertCard(db, card(20, { game: "riftbound", section: "overnumbered", set: "Surging Sparks", rarity: "Epic", printing: "Normal", marketPrice: 7 }), observed, "sets-run");
  // One Piece: sealed-only set — momentum must fall back to the sealed median.
  await upsertSealedProduct(db, sealedProduct(30, { game: "onepiece", set: "The Time of Battle", category: "Booster Boxes", msrp: 89.99, marketPrice: 120 }), observed, "sets-run");
  await completeIngestion(db, "sets-run", "daily-market", observed, 7, 7);
  const metrics = [
    [1, "Holofoil", 100, 1200], [2, "Holofoil", 300, -400], [3, "Holofoil", 500, 800],
    [20, "Normal", -250, -100],
    [30, "Sealed", 40, 900],
  ];
  for (const [productId, variant, b7, b30] of metrics)
    database.prepare(`insert into market_metrics (product_id,variant,condition,as_of_date,coverage,change_7_bps,change_30_bps,updated_at)
      values (?,?,?,?,?,?,?,?)`).run(productId, variant, "Near Mint", "2026-08-29", "exact", b7, b30, "2026-08-29T10:00:00Z");
  database.prepare("insert into market_signals (product_id,side,strictness,score,confidence,reason,detail,distance_bps,cutoff_bps,as_of_date,observation_date,coverage) values (1,'buy','balanced',80,'high','r','d',100,500,'2026-08-29','2026-08-29','exact')").run();
  database.prepare("insert into market_signals (product_id,side,strictness,score,confidence,reason,detail,distance_bps,cutoff_bps,as_of_date,observation_date,coverage) values (3,'sell','balanced',70,'medium','r','d',90,400,'2026-08-29','2026-08-29','exact')").run();
  database.prepare("insert into market_signals (product_id,side,strictness,score,confidence,reason,detail,distance_bps,cutoff_bps,as_of_date,observation_date,coverage) values (2,'buy','aggressive',60,'low','r','d',80,300,'2026-08-29','2026-08-29','exact')").run();
  database.prepare("insert into product_details (product_id, published_on) values (1, '2024-11-08T00:00:00Z')").run();
  database.prepare("insert into product_details (product_id, published_on) values (2, '2024-11-10T00:00:00Z')").run();
  return { database, db };
}

test("the sets directory aggregates counts, momentum, releases, and signals per game+set", async () => {
  const { database, db } = await seeded();
  const payload = await loadSetsDirectory(db);
  const bySet = new Map(payload.sets.map(row => [`${row.game}|${row.set}`, row]));
  const surging = bySet.get("pokemon|Surging Sparks");
  assert.deepEqual({ chase: surging.chase, sealed: surging.sealed, group: surging.group, slug: surging.slug, releaseDate: surging.releaseDate, buy: surging.buySignals, sell: surging.sellSignals },
    { chase: 3, sealed: 2, group: "sv", slug: "surging-sparks", releaseDate: "2024-11-08", buy: 1, sell: 1 });
  assert.equal(surging.trackedValue, 140);
  // Median of 100/300/500 bps = 3% (7D) and -400/800/1200 => 800 bps = 8% (30D).
  assert.equal(surging.change7, 3);
  assert.equal(surging.change30, 8);
  // The riftbound name-collision stays its own row with its own momentum.
  const rift = bySet.get("riftbound|Surging Sparks");
  assert.deepEqual({ chase: rift.chase, change7: rift.change7, group: rift.group }, { chase: 1, change7: -2.5, group: "core" });
  // Sealed-only sets read their sealed momentum, not an empty singles median.
  const onepiece = bySet.get("onepiece|The Time of Battle");
  assert.deepEqual({ sealed: onepiece.sealed, chase: onepiece.chase, change30: onepiece.change30, group: onepiece.group }, { sealed: 1, chase: 0, change30: 9, group: "main" });
  // Balanced strictness only: the aggressive-only signal on card 2 counts nowhere.
  assert.equal(surging.buySignals + surging.sellSignals, 2);
  database.close();
});

test("set detail resolves slugs, applies the chase cutoff and the index coverage floor", async () => {
  const { database, db } = await seeded();
  // Daily observations: two full days, one sparse day (1 of 3 members) that must drop.
  const observations = [
    [1, "Holofoil", "2026-08-27", 900], [2, "Holofoil", "2026-08-27", 3900], [3, "Holofoil", "2026-08-27", 8800],
    [1, "Holofoil", "2026-08-28", 950], [2, "Holofoil", "2026-08-28", 3950], [3, "Holofoil", "2026-08-28", 8900],
    [1, "Holofoil", "2026-08-29", 1000],
    [10, "Sealed", "2026-08-28", 1400], [10, "Sealed", "2026-08-29", 1500],
    // A second variant on the same product/date must not double-count (variant != printing).
    [1, "Normal", "2026-08-28", 99999],
  ];
  for (const [productId, variant, date, cents] of observations)
    database.prepare("insert into price_observations (product_id,variant,condition,observed_date,market_cents,source,fetched_at) values (?,?,?,?,?,?,?)")
      .run(productId, variant, "Near Mint", date, cents, "fixture", `${date}T09:00:00Z`);
  const detail = await loadSetDetail(db, "pokemon", "surging-sparks");
  assert.equal(detail.set, "Surging Sparks");
  // Pack price 15 gates the chase list: cards at 40 and 90 qualify, the 10 does not.
  assert.deepEqual({ packPrice: detail.packPrice, chaseCount: detail.chaseCount, chaseMarket: detail.chaseMarket, sealedCount: detail.sealedCount },
    { packPrice: 15, chaseCount: 2, chaseMarket: 130, sealedCount: 2 });
  // The sparse 08-29 singles day (1/3 members) drops; full days sum the printing-matched variants only.
  assert.deepEqual(detail.singlesIndex, [{ date: "2026-08-27", price: 136 }, { date: "2026-08-28", price: 138 }]);
  assert.deepEqual(detail.sealedIndex, [{ date: "2026-08-28", price: 14 }, { date: "2026-08-29", price: 15 }]);
  assert.equal(detail.singlesChange30, 8);
  assert.equal(detail.cards.length, 3);
  assert.equal(await loadSetDetail(db, "pokemon", "no-such-set"), null);
  // The riftbound collision resolves to ITS set, not the Pokémon one.
  const rift = await loadSetDetail(db, "riftbound", "surging-sparks");
  assert.deepEqual({ game: rift.game, chaseCount: rift.chaseCount, sealedCount: rift.sealedCount }, { game: "riftbound", chaseCount: 1, sealedCount: 0 });
  database.close();
});
