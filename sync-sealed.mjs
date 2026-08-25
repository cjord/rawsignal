import fs from "node:fs/promises";
import {isPokemonSealedProduct, normalizeProductType, normalizedProductKey} from "./sealed-product-utils.mjs";

const BASE = "https://tcgcsv.com/tcgplayer";
const headers = {"User-Agent": "RawSignal/6.0 (+pokemon sealed market tracker)"};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {headers});
    if (response.ok) {
      const body = await response.json();
      await wait(75);
      return body.results ?? body;
    }
    await wait(500 * (attempt + 1));
  }
  throw new Error(`Failed ${url}`);
}

const positive = value => Number(value) > 0 ? Number(value) : null;
function preferredPrice(rows = []) {
  const priced = rows.filter(row => positive(row.marketPrice) != null || positive(row.midPrice) != null);
  return priced.find(row => /normal|unopened|sealed/i.test(row.subTypeName ?? "")) ?? priced[0] ?? null;
}

function outputProduct(product, group, price, msrpRecord) {
  const msrp = positive(msrpRecord?.msrp);
  const marketPrice = positive(price?.marketPrice);
  const midPrice = positive(price?.midPrice);
  const profit = msrp != null && marketPrice != null ? Number((marketPrice - msrp).toFixed(2)) : null;
  return {
    game: "pokemon",
    productId: Number(product.productId),
    name: product.name,
    set: group.name,
    category: normalizeProductType(product.name),
    image: product.imageUrl?.replace("_200w", "_in_1000x1000") ?? null,
    url: product.url ?? "",
    msrp,
    marketPrice,
    midPrice,
    profit,
    profitPct: profit != null && msrp ? Number((profit / msrp * 100).toFixed(1)) : null,
    msrpSource: msrp == null ? null : "Published product MSRP",
  };
}

const tracker = await fetch("https://tcg-price-tracker.shizukaziye.workers.dev/data/data.json", {headers}).then(response => response.json());
const msrpById = new Map((tracker.items ?? []).filter(item => item.matched && positive(item.msrp) != null).map(item => [Number(item.productId ?? item.id), item]));
const groups = await json(`${BASE}/3/groups`);
const products = [];
const seenIds = new Set();
const seenExact = new Set();

for (const [index, group] of groups.entries()) {
  const [groupProducts, groupPrices] = await Promise.all([
    json(`${BASE}/3/${group.groupId}/products`),
    json(`${BASE}/3/${group.groupId}/prices`),
  ]);
  const pricesByProduct = new Map();
  for (const row of groupPrices) {
    const rows = pricesByProduct.get(Number(row.productId)) ?? [];
    rows.push(row);
    pricesByProduct.set(Number(row.productId), rows);
  }
  for (const product of groupProducts) {
    if (!isPokemonSealedProduct(product, group) || seenIds.has(Number(product.productId))) continue;
    const exactKey = normalizedProductKey(product, group.name);
    if (seenExact.has(exactKey)) continue;
    seenIds.add(Number(product.productId));
    seenExact.add(exactKey);
    products.push(outputProduct(product, group, preferredPrice(pricesByProduct.get(Number(product.productId))), msrpById.get(Number(product.productId))));
  }
  if (index % 20 === 0) console.error(`pokemon: ${index + 1}/${groups.length}`);
}

products.sort((a, b) => (b.marketPrice ?? -1) - (a.marketPrice ?? -1) || a.name.localeCompare(b.name));
await fs.mkdir("public/data", {recursive: true});
await fs.writeFile("public/data/sealed-pokemon.json", JSON.stringify(products));
console.log({pokemon: products.length, withMarket: products.filter(item => item.marketPrice != null).length, withMsrp: products.filter(item => item.msrp != null).length});
