import { existsSync } from "node:fs";
import { copyFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Local max-profile database, phase 3 (docs/local-database.md): swap which database the
// dev server's miniflare D1 binding sees. Two profiles:
//   max   — the seeded testbed built by build-local-db.mjs (richer than production)
//   empty — a zero-byte database: the feed-fallback contract the gate's Playwright
//           specs historically ran against
//   node scripts/local-db/db-profile.mjs max|empty|status
// Stop the dev server before swapping (miniflare holds the WAL open).

const STATE = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const MAX = path.resolve(".wrangler/local-profiles/max.sqlite");
const command = process.argv[2];

const activeFile = async () => {
  if (!existsSync(STATE)) throw new Error("No local D1 state yet — run the dev server once so miniflare creates its database file");
  const name = (await readdir(STATE)).find(file => file.endsWith(".sqlite") && !file.startsWith("metadata"));
  if (!name) throw new Error("No miniflare D1 database file found — run the dev server once first");
  return path.join(STATE, name);
};

const clearSidecars = async file => { await rm(`${file}-wal`, { force: true }); await rm(`${file}-shm`, { force: true }); };

if (command === "max") {
  if (!existsSync(MAX)) throw new Error("Build the max profile first: npm run db:local:build");
  const active = await activeFile();
  await clearSidecars(active);
  await copyFile(MAX, active);
  console.log(`max profile active (${active})`);
} else if (command === "empty") {
  const active = await activeFile();
  await clearSidecars(active);
  await writeFile(active, "");
  console.log(`empty profile active — dev serves the bundled-feed fallback (${active})`);
} else if (command === "status") {
  const active = await activeFile();
  const database = new DatabaseSync(active, { readOnly: true });
  const version = database.prepare("pragma user_version").get().user_version;
  const tables = database.prepare("select count(*) n from sqlite_master where type='table'").get().n;
  const counts = tables
    ? Object.fromEntries(["catalog_products", "price_observations", "market_signals"].map(table => {
        try { return [table, database.prepare(`select count(*) n from "${table}"`).get().n]; } catch { return [table, null]; }
      }))
    : {};
  database.close();
  console.log(JSON.stringify({ active, profile: version === 2 ? "max" : tables === 0 ? "empty" : "other", tables, ...counts, maxBuilt: existsSync(MAX) }, null, 1));
} else {
  throw new Error("Usage: db-profile.mjs max|empty|status");
}
