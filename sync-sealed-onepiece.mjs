import { createTcgcsvClient } from "./core/clients/tcgcsv.ts";
import { publishCatalogSnapshot } from "./scripts/io/last-good.mjs";
import { normalizeOnePieceSealedProduct, preferredSealedPrice, sealedIdentity } from "./core/normalize/sealed.ts";
import { ingestionManifest, validateCatalogSnapshot } from "./scripts/validate/catalog.mjs";

// Full One Piece sealed feed from the TCGCSV category-68 walk (todo L2, 2026-08-31).
// Replaces the retired hand-curated 23-product feed; its Bandai MSRPs moved into
// core/msrp/verified-msrp.ts so regeneration never loses them. Sealed-only by design —
// One Piece singles are a separate, curated-rarity phase.
const client = createTcgcsvClient(), groups = await client.groups(68);
const products = [], seenIds = new Set(), seenExact = new Set(), rejected = {}, duplicateDecisions = [];
const reject = reason => rejected[reason] = (rejected[reason] ?? 0) + 1;

for (const [index, group] of groups.entries()) {
  const [groupProducts, groupPrices] = await Promise.all([client.products(68, group.groupId), client.prices(68, group.groupId)]);
  const pricesByProduct = new Map();
  for (const row of groupPrices) {
    const rows = pricesByProduct.get(Number(row.productId)) ?? [];
    rows.push(row);
    pricesByProduct.set(Number(row.productId), rows);
  }
  for (const product of groupProducts) {
    const normalized = normalizeOnePieceSealedProduct(product, group, preferredSealedPrice(pricesByProduct.get(Number(product.productId))));
    if (!normalized) { reject("not-onepiece-sealed"); continue; }
    const productId = Number(product.productId), exactKey = sealedIdentity(product, group);
    if (seenIds.has(productId)) { reject("duplicate-product-id"); duplicateDecisions.push({ key: `onepiece:${productId}`, rule: "first-product-id" }); continue; }
    if (seenExact.has(exactKey)) { reject("duplicate-normalized-product"); duplicateDecisions.push({ key: exactKey, rule: "first-normalized-product" }); continue; }
    seenIds.add(productId); seenExact.add(exactKey); products.push(normalized);
  }
  if ((index + 1) % 20 === 0) console.error(`onepiece: ${index + 1}/${groups.length}`);
}

products.sort((a, b) => (b.marketPrice ?? -1) - (a.marketPrice ?? -1) || a.name.localeCompare(b.name));
const counts = validateCatalogSnapshot({ sealed: products, minimumRecords: 100 });
const generatedAt = new Date().toISOString();
const manifest = ingestionManifest({ source: "TCGCSV / TCGplayer + verified Bandai MSRP", sourceUpdatedAt: generatedAt, generatedAt, counts, rejected, duplicateDecisions });
await publishCatalogSnapshot({ sealed: products }, {
  "public/data/sealed-onepiece.json": products,
  "public/data/sealed-onepiece-manifest.json": manifest,
}, { validation: { minimumRecords: 100 } });
console.log({ onepiece: products.length, withMarket: products.filter(item => item.marketPrice != null).length, withMsrp: products.filter(item => item.msrp != null).length, rejected, duplicateDecisions: duplicateDecisions.length });
