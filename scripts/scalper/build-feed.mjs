import { readFile } from "node:fs/promises";
import { createTcgcsvClient } from "../clients/tcgcsv.mjs";
import { publishCatalogSnapshot } from "../io/last-good.mjs";
import { preferredSealedPrice } from "../normalize/sealed.mjs";
import { ingestionManifest } from "../validate/catalog.mjs";
import { normalizeProductType } from "../../sealed-product-utils.mjs";

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const positive = value => Number(value) > 0 ? Number(value) : null;
const categoryGame = new Map([[2, "yugioh"], [3, "pokemon"], [68, "onepiece"], [71, "lorcana"], [89, "riftbound"]]);

const report = await readJson("../../docs/scalper-reconciliation.json");
const candidates = await readJson("../../docs/scalper-candidates.json");
const approved = await readJson("./approved-variants.json");
const byProductId = new Map(candidates.map(candidate => [Number(candidate.productId), candidate]));
const reportEntries = [...report.matched, ...report.ambiguous, ...report.unmatched];
const selected = new Map();

for (const entry of reportEntries) {
  const replacement = approved[String(entry.lineNumber)];
  const productIds = replacement ?? (entry.candidates.length === 1 ? [entry.candidates[0].productId] : []);
  for (const productId of productIds) {
    const candidate = byProductId.get(Number(productId));
    if (!candidate) throw new Error(`Approved TCGCSV product ${productId} is absent from the candidate cache`);
    const current = selected.get(Number(productId));
    selected.set(Number(productId), {
      candidate,
      msrpOverride: entry.msrpOverride ?? current?.msrpOverride ?? null,
      sourceLines: [...new Set([...(current?.sourceLines ?? []), entry.lineNumber])],
    });
  }
}

const regularFeeds = await Promise.all(["pokemon", "onepiece", "riftbound"].map(async market => {
  try { return await readJson(`../../public/data/sealed-${market}.json`); } catch { return []; }
}));
const regularById = new Map(regularFeeds.flat().map(product => [Number(product.productId), product]));
const groups = new Map();
for (const record of selected.values()) {
  const key = `${record.candidate.categoryId}:${record.candidate.groupId}`;
  groups.set(key, { categoryId: record.candidate.categoryId, groupId: record.candidate.groupId });
}

const client = createTcgcsvClient({ throttleMs: 110 });
const pricesByProduct = new Map();
for (const group of groups.values()) {
  const prices = await client.prices(group.categoryId, group.groupId);
  for (const price of prices) {
    const rows = pricesByProduct.get(Number(price.productId)) ?? [];
    rows.push(price);
    pricesByProduct.set(Number(price.productId), rows);
  }
}

const products = [...selected.values()].map(({ candidate, msrpOverride }) => {
  const regular = regularById.get(Number(candidate.productId));
  const price = preferredSealedPrice(pricesByProduct.get(Number(candidate.productId)));
  const marketPrice = positive(price?.marketPrice), midPrice = positive(price?.midPrice);
  const msrp = positive(msrpOverride) ?? positive(regular?.msrp);
  const profit = msrp != null && marketPrice != null ? Number((marketPrice - msrp).toFixed(2)) : null;
  const game = categoryGame.get(Number(candidate.categoryId));
  if (!game) throw new Error(`Unsupported approved sealed category ${candidate.categoryId}`);
  return {
    game,
    productId: Number(candidate.productId),
    name: candidate.name,
    set: candidate.set,
    category: normalizeProductType(candidate.name),
    image: candidate.imageUrl?.replace("_200w", "_in_1000x1000") ?? null,
    url: candidate.url ?? "",
    msrp,
    marketPrice,
    midPrice,
    profit,
    profitPct: profit != null && msrp ? Number((profit / msrp * 100).toFixed(1)) : null,
    msrpSource: msrpOverride != null ? "Scalper watchlist MSRP override" : regular?.msrpSource ?? null,
  };
}).sort((a, b) => (b.marketPrice ?? -1) - (a.marketPrice ?? -1) || a.name.localeCompare(b.name));

const generatedAt = new Date().toISOString();
const counts = { records: products.length, withMarket: products.filter(product => product.marketPrice != null).length, withMsrp: products.filter(product => product.msrp != null).length };
const manifest = ingestionManifest({ source: "TCGCSV sealed products filtered by approved scalper.txt allowlist", sourceUpdatedAt: report.generatedAt, generatedAt, counts, rejected: { unmatchedWatchlistEntries: report.counts.unmatched } });
await publishCatalogSnapshot({ sealed: products }, {
  "public/data/sealed-scalping.json": products,
  "public/data/sealed-scalping-manifest.json": manifest,
}, { validation: { minimumRecords: 50 } });
console.log(JSON.stringify(counts));
