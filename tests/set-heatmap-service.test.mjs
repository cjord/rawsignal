import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { loadSetHeatmap } from "../db/set-heatmap.ts";

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.statement.get(...this.values) ?? null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
const dbFor = database => ({ prepare: sql => new Statement(database.prepare(sql)) });

test("heatmap matches published source dates, exact printings, and archive cutoffs", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`create table ingestion_runs (id text primary key,source text,status text,started_at text,completed_at text,source_updated_at text,records_written integer,records_rejected integer,duplicate_decisions integer,schema_version integer,stats_json text);
    create table refresh_state (key text primary key,ingestion_run_id text,last_success_at text);
    create table catalog_products (product_id integer primary key,game text,kind text,set_name text,section text,printing text,source_updated_at text);
    create table price_observations (product_id integer,variant text,condition text,observed_date text,market_cents integer,source text,fetched_at text);
    create index idx_test_history on price_observations(product_id,variant,condition,observed_date);`);
  sqlite.prepare("insert into ingestion_runs(id,source,status,started_at,completed_at,source_updated_at) values (?,?,?,?,?,?)")
    .run("live-daily:2026-10-08", "tcgcsv-live", "succeeded", "2026-10-08T20:00:00Z", "2026-10-09T01:00:00Z", "2026-10-08T16:00:00-04:00");
  sqlite.prepare("insert into refresh_state(key,ingestion_run_id,last_success_at) values (?,?,?)")
    .run("daily-market", "live-daily:2026-10-08", "2026-10-09T01:00:00Z");
  const card = sqlite.prepare("insert into catalog_products values (?,?,?,?,?,?,?)");
  card.run(1, "pokemon", "single", "Shared Set", "illustration-rares", "Normal", "2026-10-08T16:00:00-04:00");
  card.run(2, "pokemon", "single", "Shared Set", "promos", "Normal", "2026-10-08T16:00:00-04:00");
  // Product timestamps can postdate the published run's source timestamp even
  // when those products belong to the published run.
  card.run(3, "riftbound", "single", "Shared Set", "signatures", "Normal", "2026-10-09T00:30:00Z");
  const history = sqlite.prepare("insert into price_observations values (?,?,?,?,?,?,?)");
  history.run(1, "Normal", "Near Mint", "2026-10-09", 12000, "tcgcsv-daily", "2026-10-09T00:30:00Z");
  history.run(1, "Normal", "Near Mint", "2026-10-01", 10000, "tcgcsv-archive", "2026-08-28T00:00:00Z");
  history.run(1, "Normal", "Near Mint", "2026-09-08", 10000, "tcgcsv-archive", "2026-08-28T00:00:00Z");
  history.run(1, "Normal", "Near Mint", "2026-07-10", 10000, "tcgcsv-archive", "2026-08-28T00:00:00Z");
  history.run(1, "Holofoil", "Near Mint", "2026-10-09", 999900, "tcgcsv-daily", "2026-10-09T00:30:00Z");
  history.run(1, "Normal", "Near Mint", "2026-10-09", 999900, "tcgplayer", "2026-10-09T00:30:00Z");
  history.run(3, "Normal", "Near Mint", "2026-10-08", 5000, "tcgcsv-daily", "2026-10-08T22:00:00Z");
  history.run(3, "Normal", "Near Mint", "2026-10-01", 10000, "tcgcsv-archive", "2026-08-28T00:00:00Z");
  const payload = await loadSetHeatmap(dbFor(sqlite));
  assert.equal(payload.asOfDate, "2026-10-08");
  const pokemon = payload.rows.find(row => row.game === "pokemon");
  const riftbound = payload.rows.find(row => row.game === "riftbound");
  assert.equal(pokemon.cells.all[7].total, 2);
  assert.equal(pokemon.cells.all[7].eligible, 1);
  assert.equal(pokemon.cells.all[7].reason, "low-coverage");
  assert.equal(pokemon.cells["illustration-rares"][7].change, 20);
  assert.equal(riftbound.cells.signatures[7].change, -50);
  sqlite.close();
});
