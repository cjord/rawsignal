import type { Card } from "../domain/types.ts";
import type { SealedSourceGroup } from "../sealed-product-utils.ts";

// Pure normalization of one TCGCSV group walk into typed Card records (converted from
// scripts/normalize/singles.mjs — decision D2; the sync scripts and the Worker share
// this implementation).
export type SinglesSourceProduct = {
  productId?: unknown;
  name: string;
  url?: string;
  imageUrl?: string;
  extendedData?: { name: string; value?: unknown }[];
};
export type SinglesPriceRow = {
  productId?: unknown;
  marketPrice?: unknown;
  lowPrice?: unknown;
  midPrice?: unknown;
  highPrice?: unknown;
  subTypeName?: string;
};

const extended = (product: SinglesSourceProduct, key: string) => String(product.extendedData?.find(item => item.name === key)?.value ?? "");
const positive = (value: unknown) => Number(value) > 0 ? Number(value) : null;

function pokemonSection(rarity: string, year: number): [string, string] | null {
  if (/^Illustration Rare$/i.test(rarity)) return ["illustration-rares", "Illustration Rares"];
  if (/^Special Illustration Rare$/i.test(rarity)) return ["special-illustration-rares", "Special Illustration Rares"];
  if (/^Promo$/i.test(rarity)) return ["promos", "Promos"];
  if (/^Ultra Rare$/i.test(rarity)) return ["ultra-rares", "Ultra Rares"];
  if (/^Double Rare$/i.test(rarity)) return ["double-rares", "Double Rares"];
  if (/^(Secret Rare|Hyper Rare|Rainbow Rare|Mega Hyper Rare|Black White Rare)$/i.test(rarity)) return ["secret-hyper-rares", "Secret & Hyper Rares"];
  if (/^(Shiny Holo Rare|Shiny Rare|Shiny Ultra Rare|Radiant Rare|Amazing Rare|Prism Rare)$/i.test(rarity)) return ["shiny-radiant-rares", "Shiny & Radiant Rares"];
  return year <= 2010 ? ["vintage", "Vintage"] : null;
}

function riftboundSection(productName: string, rarity: string): [string, string] | null {
  if (/\(Signature\)/i.test(productName)) return ["signatures", "Signatures"];
  if (/\(Overnumbered\)/i.test(productName)) return ["overnumbered", "Overnumbered"];
  if (/\(Alternate Art\)/i.test(productName)) return ["alt-arts", "Alt Arts"];
  if (/^Epic$/i.test(rarity)) return ["epics", "Epics"];
  if (/^Rare$/i.test(rarity)) return ["rares", "Rares"];
  return null;
}

function preferredPrices(prices: SinglesPriceRow[]) {
  const byId = new Map<number, SinglesPriceRow>();
  for (const price of prices) {
    if (!(Number(price.marketPrice) > 0)) continue;
    const previous = byId.get(Number(price.productId));
    if (!previous || Number(price.marketPrice) > Number(previous.marketPrice)) byId.set(Number(price.productId), price);
  }
  return byId;
}

export function normalizeSinglesGroup({ game, group, products, prices, previous = new Map(), fixedSection = null }: {
  game: "pokemon" | "riftbound";
  group: SealedSourceGroup & { name: string; publishedOn: string };
  products: SinglesSourceProduct[];
  prices: SinglesPriceRow[];
  previous?: Map<string, number>;
  fixedSection?: [string, string] | null;
}): { cards: Card[]; rejected: Record<string, number>; labels: Map<string, string> } {
  const cards: Card[] = [], rejected: Record<string, number> = {}, labels = new Map<string, string>(), priceById = preferredPrices(prices);
  const reject = (reason: string) => rejected[reason] = (rejected[reason] ?? 0) + 1;
  const year = new Date(group.publishedOn).getFullYear();
  for (const product of products) {
    // Fixed-section groups (Japanese promos, audit Phase E) take every priced card in the
    // group regardless of rarity taxonomy; Japanese listings often omit the Rarity field.
    const price = priceById.get(Number(product.productId)), rarity = extended(product, "Rarity") || (fixedSection ? "Promo" : ""), number = extended(product, "Number");
    if (!price) { reject("missing-market-price"); continue; }
    if (!rarity || !number) { reject("missing-card-metadata"); continue; }
    const selected = fixedSection ?? (game === "pokemon" ? pokemonSection(rarity, year) : riftboundSection(product.name, rarity));
    if (!selected) { reject("unsupported-rarity"); continue; }
    const [section, label] = selected, prior = previous.get(`${game}:${product.productId}`);
    labels.set(section, label);
    cards.push({
      game, section, productId: Number(product.productId), name: product.name, set: group.name, year, rarity, number,
      image: product.imageUrl?.replace("_200w", "_in_1000x1000") ?? "", url: product.url ?? "",
      marketPrice: Number(price.marketPrice), lowPrice: positive(price.lowPrice),
      midPrice: positive(price.midPrice), highPrice: positive(price.highPrice),
      printing: price.subTypeName ?? "Normal",
      priceChange: typeof prior === "number" ? Number((Number(price.marketPrice) - prior).toFixed(2)) : null,
    });
  }
  return { cards, rejected, labels };
}
