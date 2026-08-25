import { isPokemonSealedProduct, normalizeProductType, normalizedProductKey } from "../../sealed-product-utils.mjs";

const positive = value => Number(value) > 0 ? Number(value) : null;

export function preferredSealedPrice(rows = []) {
  const priced = rows.filter(row => positive(row.marketPrice) != null || positive(row.midPrice) != null);
  return priced.find(row => /normal|unopened|sealed/i.test(row.subTypeName ?? "")) ?? priced[0] ?? null;
}

export function normalizePokemonSealedProduct(product, group, price, msrpRecord) {
  if (!isPokemonSealedProduct(product, group)) return null;
  const msrp = positive(msrpRecord?.msrp), marketPrice = positive(price?.marketPrice), midPrice = positive(price?.midPrice);
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

export function sealedIdentity(product, group) {
  return normalizedProductKey(product, group.name);
}

