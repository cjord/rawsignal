// Regenerates public/data/detail-manifest.json and public/data/details/ from the bundled
// feeds plus (with --enrich) TCGCSV per-group product metadata and printing-level prices.
// Flags:
//   --enrich         fetch TCGCSV groups/products/prices for real chunks (npm data:build:details)
//   --require-fresh  exit 3 without writing when TCGCSV has not published since the last sync
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTcgcsvClient } from "../../core/clients/tcgcsv.ts";
import { publishValidatedFiles } from "../io/last-good.mjs";
import { buildDetailFeeds } from "./enrichment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const flags = new Set(process.argv.slice(2));
const enrich = flags.has("--enrich"), requireFresh = flags.has("--require-fresh");
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));

const index = await readJson("tcg-index.json");
let sourceUpdatedAt = null;
if (enrich || requireFresh) {
  try {
    const response = await fetch("https://tcgcsv.com/last-updated.txt", { headers: { "User-Agent": "RawSignal/7.0 (+validated daily market ingestion)" } });
    if (!response.ok) throw new Error(`TCGCSV last-updated unavailable: ${response.status}`);
    sourceUpdatedAt = (await response.text()).trim();
  } catch (error) {
    // --require-fresh cannot decide without the stamp; a plain --enrich build can proceed unstamped.
    if (requireFresh) throw error;
    console.warn(`WARNING: ${error.message}; detail sources will carry sourceUpdatedAt: null.`);
  }
}
if (requireFresh && sourceUpdatedAt === index.sourceUpdatedAt) {
  console.log(`SKIP: TCGCSV still at ${sourceUpdatedAt}; no new publish since the last sync.`);
  process.exit(3);
}

const singlesById = new Map();
for (const sections of Object.values(index.rarities ?? {})) {
  for (const { key } of sections) {
    if (key === "all") continue;
    for (const card of await readJson(`public/data/${key}.json`)) {
      if (!singlesById.has(card.productId)) singlesById.set(card.productId, card);
    }
  }
}
const sealedById = new Map();
for (const feed of ["sealed-pokemon", "sealed-riftbound", "sealed-onepiece", "sealed-scalping"]) {
  for (const product of await readJson(`public/data/${feed}.json`)) {
    if (!sealedById.has(product.productId)) sealedById.set(product.productId, product);
  }
}

const groupData = [];
if (enrich) {
  const categories = [{ id: 3, game: "pokemon" }, { id: 68, game: "onepiece" }, { id: 89, game: "riftbound" }];
  const client = createTcgcsvClient(), now = new Date();
  const wanted = id => singlesById.has(id) || sealedById.has(id);
  for (const category of categories) {
    const groups = (await client.groups(category.id)).filter(group => new Date(group.publishedOn) <= now);
    for (const [i, group] of groups.entries()) {
      const [products, prices] = await Promise.all([
        client.products(category.id, group.groupId),
        client.prices(category.id, group.groupId),
      ]);
      if (products.some(product => wanted(Number(product.productId)))) {
        groupData.push({ categoryId: category.id, group, products, prices });
      }
      if ((i + 1) % 25 === 0) console.error(`${category.game}: ${i + 1}/${groups.length} groups`);
    }
  }
} else {
  console.warn("WARNING: --enrich not set; building fallback-only detail feeds without TCGCSV metadata or printing variants.");
}

const { manifest, chunks, stats } = buildDetailFeeds({
  singles: [...singlesById.values()],
  sealed: [...sealedById.values()],
  groups: groupData,
  sourceUpdatedAt,
});

if (stats.entries < 1000) throw new Error(`Refusing to publish: only ${stats.entries} manifest entries.`);
for (const target of Object.values(manifest)) {
  if (!chunks[target.replace("/data/details/", "")]) throw new Error(`Manifest references missing chunk: ${target}`);
}

const detailsDir = path.join(root, "public", "data", "details");
const files = { [path.join(root, "public", "data", "detail-manifest.json")]: manifest };
for (const [name, rows] of Object.entries(chunks)) files[path.join(detailsDir, name)] = rows;
await publishValidatedFiles(files);

let pruned = 0;
for (const name of await fs.readdir(detailsDir)) {
  if (name.endsWith(".json") && !(name in chunks)) {
    await fs.rm(path.join(detailsDir, name));
    pruned += 1;
  }
}
console.log({ ...stats, chunkFiles: Object.keys(chunks).length, pruned, sourceUpdatedAt });
