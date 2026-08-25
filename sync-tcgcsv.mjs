import fs from "node:fs/promises";
import { createTcgcsvClient } from "./scripts/clients/tcgcsv.mjs";
import { publishCatalogSnapshot } from "./scripts/io/last-good.mjs";
import { normalizeSinglesGroup } from "./scripts/normalize/singles.mjs";
import { ingestionManifest, validateCatalogSnapshot } from "./scripts/validate/catalog.mjs";

const categories = [{ id: 3, game: "pokemon" }, { id: 89, game: "riftbound" }];
const order = {
  pokemon: ["illustration-rares", "special-illustration-rares", "promos", "ultra-rares", "double-rares", "secret-hyper-rares", "shiny-radiant-rares", "vintage"],
  riftbound: ["rares", "epics", "alt-arts", "overnumbered", "signatures"],
};
const addCounts = (target, source) => { for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value; };

async function previousPrices() {
  const result = new Map();
  try {
    const names = await fs.readdir("public/data");
    for (const name of names.filter(name => name.endsWith(".json") && !name.startsWith("sealed-") && name !== "illustration-and-special-rares.json")) {
      const rows = JSON.parse(await fs.readFile(`public/data/${name}`, "utf8"));
      for (const card of rows) if (Number.isInteger(card.productId) && Number.isFinite(card.marketPrice)) result.set(`${card.game}:${card.productId}`, card.marketPrice);
    }
  } catch { /* A first sync has no previous good snapshot. */ }
  return result;
}

const client = createTcgcsvClient(), previous = await previousPrices(), today = new Date();
const records = new Map(), rarityLabels = { pokemon: new Map(), riftbound: new Map() };
const rejected = {}, duplicateDecisions = [];

for (const category of categories) {
  const groups = (await client.groups(category.id)).filter(group => new Date(group.publishedOn) <= today);
  for (const [index, group] of groups.entries()) {
    const [products, prices] = await Promise.all([client.products(category.id, group.groupId), client.prices(category.id, group.groupId)]);
    const normalized = normalizeSinglesGroup({ game: category.game, group, products, prices, previous });
    addCounts(rejected, normalized.rejected);
    for (const [section, label] of normalized.labels) rarityLabels[category.game].set(section, label);
    for (const card of normalized.cards) {
      const key = `${card.game}:${card.productId}`, existing = records.get(key);
      if (!existing || card.marketPrice > existing.marketPrice) {
        if (existing) duplicateDecisions.push({ key, kept: card.set, rejected: existing.set, rule: "higher-market-price" });
        records.set(key, card);
      } else duplicateDecisions.push({ key, kept: existing.set, rejected: card.set, rule: "higher-market-price" });
    }
    if ((index + 1) % 25 === 0) console.error(`${category.game}: ${index + 1}/${groups.length}`);
  }
}

const cards = [...records.values()];
const counts = validateCatalogSnapshot({ cards, minimumRecords: 1000 });
const sections = {};
for (const card of cards) (sections[card.section] ??= []).push(card);
for (const rows of Object.values(sections)) rows.sort((a, b) => b.marketPrice - a.marketPrice || a.name.localeCompare(b.name));
sections["illustration-and-special-rares"] = [...(sections["illustration-rares"] ?? []), ...(sections["special-illustration-rares"] ?? [])]
  .sort((a, b) => b.marketPrice - a.marketPrice || a.name.localeCompare(b.name));

const rarities = { pokemon: [], riftbound: [] };
for (const game of Object.keys(rarities)) {
  rarities[game] = [...rarityLabels[game]].map(([key, label]) => ({ key, label })).sort((a, b) => order[game].indexOf(a.key) - order[game].indexOf(b.key));
  rarities[game].push({ key: "all", label: "All" });
}
const sourceUpdatedAt = await fetch("https://tcgcsv.com/last-updated.txt").then(response => response.ok ? response.text() : Promise.reject()).catch(() => today.toISOString());
const totals = Object.fromEntries(Object.keys(rarities).map(game => [game, cards.filter(card => card.game === game).length]));
const generatedAt = new Date().toISOString();
const index = { source: "TCGCSV / TCGplayer", syncedAt: generatedAt, sourceUpdatedAt: sourceUpdatedAt.trim(), rarities, totals };
const manifest = ingestionManifest({ source: index.source, sourceUpdatedAt: index.sourceUpdatedAt, generatedAt, counts, rejected, duplicateDecisions });
const files = Object.fromEntries(Object.entries(sections).map(([key, rows]) => [`public/data/${key}.json`, rows]));
files["tcg-index.json"] = index;
files["public/data/catalog-manifest.json"] = manifest;
await publishCatalogSnapshot({ cards }, files, { validation: { minimumRecords: 1000 } });
console.log({ totals, sections: Object.keys(sections).length, rejected, duplicateDecisions: duplicateDecisions.length });
