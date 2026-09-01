import { createTcgcsvClient } from "./core/clients/tcgcsv.ts";
import { fetchJson } from "./core/clients/http-json.ts";
import { publishCatalogSnapshot } from "./scripts/io/last-good.mjs";
import { normalizeJapaneseSealedProduct, normalizePokemonSealedProduct, preferredSealedPrice, sealedIdentity } from "./core/normalize/sealed.ts";
import { JAPANESE_SEALED_SINCE } from "./core/sealed-product-utils.ts";
import { ingestionManifest, validateCatalogSnapshot } from "./scripts/validate/catalog.mjs";

const tracker = await fetchJson("https://tcg-price-tracker.shizukaziye.workers.dev/data/data.json", { headers: { "User-Agent": "RawSignal/7.0" } });
const msrpById = new Map((tracker.items ?? []).filter(item => item.matched && Number(item.msrp) > 0).map(item => [Number(item.productId ?? item.id), item]));
const client = createTcgcsvClient(), groups = await client.groups(3);
const products = [], seenIds = new Set(), seenExact = new Set(), rejected = {}, duplicateDecisions = [];
const reject = reason => rejected[reason] = (rejected[reason] ?? 0) + 1;

for (const [index, group] of groups.entries()) {
  const [groupProducts, groupPrices] = await Promise.all([client.products(3, group.groupId), client.prices(3, group.groupId)]);
  const pricesByProduct = new Map();
  for (const row of groupPrices) {
    const rows = pricesByProduct.get(Number(row.productId)) ?? [];
    rows.push(row);
    pricesByProduct.set(Number(row.productId), rows);
  }
  for (const product of groupProducts) {
    const normalized = normalizePokemonSealedProduct(product, group, preferredSealedPrice(pricesByProduct.get(Number(product.productId))), msrpById.get(Number(product.productId)));
    if (!normalized) { reject("not-pokemon-sealed"); continue; }
    const productId = Number(product.productId), exactKey = sealedIdentity(product, group);
    if (seenIds.has(productId)) { reject("duplicate-product-id"); duplicateDecisions.push({ key: `pokemon:${productId}`, rule: "first-product-id" }); continue; }
    if (seenExact.has(exactKey)) { reject("duplicate-normalized-product"); duplicateDecisions.push({ key: exactKey, rule: "first-normalized-product" }); continue; }
    seenIds.add(productId); seenExact.add(exactKey); products.push(normalized);
  }
  if ((index + 1) % 20 === 0) console.error(`pokemon: ${index + 1}/${groups.length}`);
}

// Japanese sealed (category 85, todo L1 option B): SWSH-era-and-newer set groups only;
// promo groups stay singles-only. JP rows join the same pokemon feed the D1 live walk
// serves, so the bundled fallback and history targets stay in step with the database.
const japaneseGroups = (await client.groups(85)).filter(group => !/promo/i.test(group.name) && new Date(group.publishedOn) >= new Date(JAPANESE_SEALED_SINCE));
for (const [index, group] of japaneseGroups.entries()) {
  const [groupProducts, groupPrices] = await Promise.all([client.products(85, group.groupId), client.prices(85, group.groupId)]);
  const pricesByProduct = new Map();
  for (const row of groupPrices) {
    const rows = pricesByProduct.get(Number(row.productId)) ?? [];
    rows.push(row);
    pricesByProduct.set(Number(row.productId), rows);
  }
  for (const product of groupProducts) {
    const normalized = normalizeJapaneseSealedProduct(product, group, preferredSealedPrice(pricesByProduct.get(Number(product.productId))));
    if (!normalized) { reject("not-japanese-sealed"); continue; }
    const productId = Number(product.productId), exactKey = sealedIdentity(product, group);
    if (seenIds.has(productId)) { reject("duplicate-product-id"); duplicateDecisions.push({ key: `pokemon:${productId}`, rule: "first-product-id" }); continue; }
    if (seenExact.has(exactKey)) { reject("duplicate-normalized-product"); duplicateDecisions.push({ key: exactKey, rule: "first-normalized-product" }); continue; }
    seenIds.add(productId); seenExact.add(exactKey); products.push(normalized);
  }
  if ((index + 1) % 20 === 0) console.error(`pokemon-japan: ${index + 1}/${japaneseGroups.length}`);
}

products.sort((a, b) => (b.marketPrice ?? -1) - (a.marketPrice ?? -1) || a.name.localeCompare(b.name));
const counts = validateCatalogSnapshot({ sealed: products, minimumRecords: 100 });
const generatedAt = new Date().toISOString();
const manifest = ingestionManifest({ source: "TCGCSV / TCGplayer (EN + JP ≥2020) + published MSRP", sourceUpdatedAt: generatedAt, generatedAt, counts, rejected, duplicateDecisions });
await publishCatalogSnapshot({ sealed: products }, {
  "public/data/sealed-pokemon.json": products,
  "public/data/sealed-pokemon-manifest.json": manifest,
}, { validation: { minimumRecords: 100 } });
console.log({ pokemon: products.length, withMarket: products.filter(item => item.marketPrice != null).length, withMsrp: products.filter(item => item.msrp != null).length, rejected, duplicateDecisions: duplicateDecisions.length });
