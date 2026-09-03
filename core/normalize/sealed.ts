import { isJapaneseSealedProduct, isOnePieceSealedProduct, isPokemonSealedProduct, isRiftboundSealedProduct, normalizeJapaneseProductType, normalizeOnePieceProductType, normalizeProductType, normalizeRiftboundProductType, normalizedProductKey, type SealedSourceGroup, type SealedSourceProduct } from "../sealed-product-utils.ts";
import { derivedPokemonMsrp } from "../msrp/derived-msrp.ts";
import verifiedMsrp from "../msrp/verified-msrp.ts";
import type { SealedProduct } from "../domain/types.ts";

// Pure sealed normalization from the TCGCSV group walks (converted from
// scripts/normalize/sealed.mjs — decision D2; the sync scripts and the Worker share it).
export type SealedPriceRow = { marketPrice?: unknown; midPrice?: unknown; subTypeName?: string };
export type MsrpRecord = { msrp?: unknown };
export type CuratedSealedRecord = { msrp?: number | null; msrpSource?: string | null };

type SourceProduct = SealedSourceProduct & { name: string };
type SourceGroup = SealedSourceGroup & { name: string };

const positive = (value: unknown) => Number(value) > 0 ? Number(value) : null;
const groupYear = (group: SealedSourceGroup | undefined) => { const year = new Date(group?.publishedOn ?? "").getUTCFullYear(); return Number.isFinite(year) ? year : null; };

export function preferredSealedPrice(rows: SealedPriceRow[] = []) {
  const priced = rows.filter(row => positive(row.marketPrice) != null || positive(row.midPrice) != null);
  return priced.find(row => /normal|unopened|sealed/i.test(row.subTypeName ?? "")) ?? priced[0] ?? null;
}

// The product shape every game emits; each normalizer owns only its MSRP precedence and
// category vocabulary. Profit math and image/url handling stay identical across games.
function sealedRecord(game: SealedProduct["game"], product: SourceProduct, group: SourceGroup, price: SealedPriceRow | null | undefined, category: string, msrp: number | null, msrpSource: string | null): SealedProduct {
  const marketPrice = positive(price?.marketPrice), midPrice = positive(price?.midPrice);
  const profit = msrp != null && marketPrice != null ? Number((marketPrice - msrp).toFixed(2)) : null;
  return {
    game,
    productId: Number(product.productId),
    name: product.name,
    set: group.name,
    category,
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

export function normalizePokemonSealedProduct(product: SourceProduct, group: SourceGroup, price: SealedPriceRow | null | undefined, msrpRecord?: MsrpRecord | null): SealedProduct | null {
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
  return sealedRecord("pokemon", product, group, price, normalizeProductType(product.name), msrp, msrpSource);
}

// Riftbound sealed normalizes from the same category-89 group walk the singles use. MSRP
// comes from the curated bundled feed when the product is known there (Asmodee publishes
// no machine-readable MSRP source); new upstream products carry null MSRP honestly.
export function normalizeRiftboundSealedProduct(product: SourceProduct, group: SourceGroup, price: SealedPriceRow | null | undefined, curatedRecord?: CuratedSealedRecord | null): SealedProduct | null {
  if (!isRiftboundSealedProduct(product)) return null;
  const verified = curatedRecord?.msrp == null ? verifiedMsrp[`riftbound:${Number(product.productId)}`] : null;
  const msrp = positive(curatedRecord?.msrp) ?? positive(verified?.msrp);
  const msrpSource = msrp == null ? null : (positive(curatedRecord?.msrp) != null ? (curatedRecord?.msrpSource ?? "Asmodee/Riftbound MSRP") : verified?.source ?? null);
  return sealedRecord("riftbound", product, group, price, normalizeRiftboundProductType(product.name), msrp, msrpSource);
}

// Japanese Pokémon sealed (category 85, todo L1 option B) joins the English Pokémon
// sealed catalog under game "pokemon". Bandai Japan MSRPs are yen-denominated and have
// no published USD feed, and the English derived-pricing table does not apply — MSRP is
// null unless a hand-verified "pokemon:<id>" entry exists, so estimates are never
// dressed as verified.
export function normalizeJapaneseSealedProduct(product: SourceProduct, group: SourceGroup, price: SealedPriceRow | null | undefined): SealedProduct | null {
  if (!isJapaneseSealedProduct(product)) return null;
  const verified = verifiedMsrp[`pokemon:${Number(product.productId)}`];
  const msrp = positive(verified?.msrp);
  return sealedRecord("pokemon", product, group, price, normalizeJapaneseProductType(product.name), msrp, msrp != null ? verified?.source ?? null : null);
}

// One Piece sealed normalizes from the category-68 group walk (sealed-only — todo L2).
// Bandai publishes per-product MSRPs but no machine-readable feed; the ones we hold
// verified live in the curated table keyed "onepiece:<id>" (seeded 2026-08-31 from the
// retired hand-curated feed). New upstream products carry null MSRP honestly.
export function normalizeOnePieceSealedProduct(product: SourceProduct, group: SourceGroup, price: SealedPriceRow | null | undefined): SealedProduct | null {
  if (!isOnePieceSealedProduct(product)) return null;
  const verified = verifiedMsrp[`onepiece:${Number(product.productId)}`];
  const msrp = positive(verified?.msrp);
  return sealedRecord("onepiece", product, group, price, normalizeOnePieceProductType(product.name), msrp, msrp != null ? verified?.source ?? null : null);
}

export function sealedIdentity(product: SealedSourceProduct, group: { name: string }) {
  return normalizedProductKey(product, group.name);
}
