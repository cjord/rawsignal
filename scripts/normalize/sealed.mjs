import { isPokemonSealedProduct, isRiftboundSealedProduct, normalizeProductType, normalizeRiftboundProductType, normalizedProductKey } from "../../sealed-product-utils.mjs";
import { derivedPokemonMsrp } from "../msrp/derived-msrp.mjs";
import verifiedMsrp from "../msrp/verified-msrp.mjs";

const positive = value => Number(value) > 0 ? Number(value) : null;
const groupYear = group => { const year = new Date(group?.publishedOn ?? "").getUTCFullYear(); return Number.isFinite(year) ? year : null; };

export function preferredSealedPrice(rows = []) {
  const priced = rows.filter(row => positive(row.marketPrice) != null || positive(row.midPrice) != null);
  return priced.find(row => /normal|unopened|sealed/i.test(row.subTypeName ?? "")) ?? priced[0] ?? null;
}

export function normalizePokemonSealedProduct(product, group, price, msrpRecord) {
  if (!isPokemonSealedProduct(product, group)) return null;
  // MSRP precedence (audit Phase C, "verified + derived, badged"): the published-MSRP feed,
  // then the hand-curated verified table, then standard pricing derived from product type
  // and era — each with a source string the UI shows, so estimates are never dressed as
  // verified.
  const published = positive(msrpRecord?.msrp);
  const verified = published == null ? verifiedMsrp[`pokemon:${Number(product.productId)}`] : null;
  const derived = published == null && !verified ? derivedPokemonMsrp(product.name, groupYear(group)) : null;
  const msrp = published ?? positive(verified?.msrp) ?? positive(derived?.msrp);
  const msrpSource = published != null ? "Published product MSRP" : verified ? verified.source : derived ? derived.msrpSource : null;
  const marketPrice = positive(price?.marketPrice), midPrice = positive(price?.midPrice);
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
    msrpSource,
  };
}

// Riftbound sealed normalizes from the same category-89 group walk the singles use. MSRP
// comes from the curated bundled feed when the product is known there (Asmodee publishes
// no machine-readable MSRP source); new upstream products carry null MSRP honestly.
export function normalizeRiftboundSealedProduct(product, group, price, curatedRecord) {
  if (!isRiftboundSealedProduct(product)) return null;
  const verified = curatedRecord?.msrp == null ? verifiedMsrp[`riftbound:${Number(product.productId)}`] : null;
  const msrp = positive(curatedRecord?.msrp) ?? positive(verified?.msrp), marketPrice = positive(price?.marketPrice), midPrice = positive(price?.midPrice);
  const profit = msrp != null && marketPrice != null ? Number((marketPrice - msrp).toFixed(2)) : null;
  return {
    game: "riftbound",
    productId: Number(product.productId),
    name: product.name,
    set: group.name,
    category: normalizeRiftboundProductType(product.name),
    image: product.imageUrl?.replace("_200w", "_in_1000x1000") ?? null,
    url: product.url ?? "",
    msrp,
    marketPrice,
    midPrice,
    profit,
    profitPct: profit != null && msrp ? Number((profit / msrp * 100).toFixed(1)) : null,
    msrpSource: msrp == null ? null : (positive(curatedRecord?.msrp) != null ? (curatedRecord?.msrpSource ?? "Asmodee/Riftbound MSRP") : verified?.source ?? null),
  };
}

export function sealedIdentity(product, group) {
  return normalizedProductKey(product, group.name);
}

