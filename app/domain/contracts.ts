import type { Card, CatalogDetailEnrichment, DetailMetadataField, DetailPriceVariant, DetailSource, PriceHistory, PricePoint, SealedProduct } from "./types";

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const nullableFinite = (value: unknown): value is number | null =>
  value === null || finite(value);
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || string(value);

export function parsePricePoint(value: unknown): PricePoint {
  if (!record(value) || !string(value.date) || !finite(value.price)) {
    throw new TypeError("Invalid price point");
  }
  return { date: value.date, price: value.price };
}

export function parsePriceHistory(value: unknown): PriceHistory {
  if (!record(value) || !Array.isArray(value.points)) {
    throw new TypeError("Invalid price history");
  }
  const coverage = value.coverage;
  if (coverage !== "exact" && coverage !== "fallback" && coverage !== "none") {
    throw new TypeError("Invalid price-history coverage");
  }
  const metrics = ["change7", "change30", "change90", "low30", "high30", "historyLow", "historyHigh"] as const;
  for (const key of metrics) {
    if (value[key] !== undefined && !nullableFinite(value[key])) {
      throw new TypeError(`Invalid price-history metric: ${key}`);
    }
  }
  if (!optionalString(value.variant) || !optionalString(value.condition)) {
    throw new TypeError("Invalid price-history variant");
  }
  return {
    points: value.points.map(parsePricePoint),
    variant: value.variant,
    condition: value.condition,
    coverage,
    change7: (value.change7 as number | null | undefined) ?? null,
    change30: (value.change30 as number | null | undefined) ?? null,
    change90: (value.change90 as number | null | undefined) ?? null,
    low30: (value.low30 as number | null | undefined) ?? null,
    high30: (value.high30 as number | null | undefined) ?? null,
    historyLow: (value.historyLow as number | null | undefined) ?? null,
    historyHigh: (value.historyHigh as number | null | undefined) ?? null,
  };
}

export function parseCard(value: unknown): Card {
  if (!record(value)) throw new TypeError("Invalid card record");
  const requiredStrings = ["section", "name", "set", "rarity", "number", "image", "url", "printing"] as const;
  if (value.game !== "pokemon" && value.game !== "riftbound") throw new TypeError("Invalid card market");
  if (!Number.isInteger(value.productId) || !finite(value.year) || !finite(value.marketPrice)) throw new TypeError("Invalid card identity or price");
  for (const key of requiredStrings) if (!string(value[key])) throw new TypeError(`Invalid card field: ${key}`);
  for (const key of ["lowPrice", "midPrice", "highPrice", "priceChange"] as const) {
    if (!nullableFinite(value[key])) throw new TypeError(`Invalid card price: ${key}`);
  }
  return value as Card;
}

export function parseCards(value: unknown): Card[] {
  if (!Array.isArray(value)) throw new TypeError("Invalid card collection");
  return value.map(parseCard);
}

export function parseSealedProduct(value: unknown): SealedProduct {
  if (!record(value)) throw new TypeError("Invalid sealed-product record");
  if (value.game !== "pokemon" && value.game !== "riftbound" && value.game !== "onepiece" && value.game !== "yugioh" && value.game !== "lorcana" && value.game !== "football") throw new TypeError("Invalid sealed market");
  if (!Number.isInteger(value.productId)) throw new TypeError("Invalid sealed product ID");
  for (const key of ["name", "set", "category", "url"] as const) if (!string(value[key])) throw new TypeError(`Invalid sealed field: ${key}`);
  if (value.image !== null && !string(value.image)) throw new TypeError("Invalid sealed image");
  if (value.msrpSource !== null && !string(value.msrpSource)) throw new TypeError("Invalid MSRP source");
  for (const key of ["msrp", "marketPrice", "midPrice", "profit", "profitPct"] as const) {
    if (!nullableFinite(value[key])) throw new TypeError(`Invalid sealed price: ${key}`);
  }
  return value as SealedProduct;
}

export function parseSealedProducts(value: unknown): SealedProduct[] {
  if (!Array.isArray(value)) throw new TypeError("Invalid sealed-product collection");
  return value.map(parseSealedProduct);
}

export function parseCatalogDetailEnrichments(value:unknown):CatalogDetailEnrichment[]{
 if(!Array.isArray(value))throw new TypeError("Invalid detail collection");
 return value.map(item=>{
  if(!record(item)||(item.kind!=="single"&&item.kind!=="sealed")||!Number.isInteger(item.productId)||!Array.isArray(item.metadata)||!Array.isArray(item.priceVariants)||!record(item.source))throw new TypeError("Invalid detail record");
  const metadata=item.metadata.map(field=>{if(!record(field)||!string(field.name)||!string(field.label)||!string(field.value))throw new TypeError("Invalid detail metadata");return field as DetailMetadataField});
  const priceVariants=item.priceVariants.map(variant=>{if(!record(variant)||!string(variant.printing))throw new TypeError("Invalid detail price variant");for(const key of ["marketPrice","lowPrice","directLowPrice","midPrice","highPrice"] as const)if(!nullableFinite(variant[key]))throw new TypeError("Invalid detail price");return variant as DetailPriceVariant});
  const source=item.source as Record<string,unknown>;for(const key of ["categoryId","groupId","imageCount"] as const)if(source[key]!==null&&!finite(source[key]))throw new TypeError("Invalid detail source number");for(const key of ["setAbbreviation","publishedOn","modifiedOn","presaleNote","sourceUpdatedAt"] as const)if(source[key]!==null&&!string(source[key]))throw new TypeError("Invalid detail source text");if(source.isPresale!==null&&typeof source.isPresale!=="boolean")throw new TypeError("Invalid presale state");
  return {kind:item.kind,productId:item.productId as number,metadata,priceVariants,source:item.source as DetailSource};
 });
}
