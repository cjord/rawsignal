import type { Card } from "../domain/types.ts";
import type { SealedSourceGroup } from "../sealed-product-utils.ts";
import { ebayCardLanguage } from "../domain/marketplace-links.ts";

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

export function riftboundSection(productName: string, rarity: string): [string, string] | null {
  if (isRiftboundMetalPromo(productName)) return ["metal-promos", "Metal / Best Of Promos"];
  if (/\(Signature\)/i.test(productName)) return ["signatures", "Signatures"];
  if (/\(Overnumbered\)/i.test(productName)) return ["overnumbered", "Overnumbered"];
  if (/\(Alternate Art\)/i.test(productName)) return ["alt-arts", "Alt Arts"];
  if (/^Epic$/i.test(rarity)) return ["epics", "Epics"];
  if (/^Rare$/i.test(rarity)) return ["rares", "Rares"];
  if (/^Common$/i.test(rarity)) return ["riftbound-commons", "Commons"];
  if (/^Uncommon$/i.test(rarity)) return ["riftbound-uncommons", "Uncommons"];
  if (/^Promo$/i.test(rarity)) return ["riftbound-promos", "Promos"];
  if (/^Showcase$/i.test(rarity)) return ["riftbound-showcases", "Other Showcases"];
  return null;
}

// Explicit inclusion policy: keep collectible treatments, not every promo stamp.
export function riftboundExclusion(product: SinglesSourceProduct, set: string): string | null {
  const number=extended(product,"Number"),type=extended(product,"Card Type"),rarity=extended(product,"Rarity");
  if (/\bToken\b/i.test(type)||/^T\d+(?:\s|$|\/)/i.test(number)||/^(?:Buff|Recruit|Gold|Mech|Sand Soldier)(?:\s*\/\/|$)/i.test(product.name)) return "excluded-token";
  if (ebayCardLanguage({kind:"single",game:"riftbound",name:product.name,set})!=="English") return "excluded-foreign-duplicate";
  const rune=/\bRune\b/i.test(type)||/\bRune(?:\s*\(|$)/i.test(product.name);
  const alternate=/\d[a-z](?:\/|$)/i.test(number)||/\(Alternate Art\)/i.test(product.name);
  if (rune) return alternate ? null : "excluded-basic-rune";
  if (isRiftboundMetalPromo(product.name)||/Judge/i.test(set)||/\((?:Top 8|Champion)\)/i.test(product.name)||set==="Secret Garden") return null;
  if ((/^Promo$/i.test(rarity)||/Organized Play Promotional/i.test(set))&&!alternate) return "excluded-regular-promo";
  return null;
}

export function isRiftboundMetalPromo(name: string): boolean {
  return /\(Metal\)|\(Best Of\)/i.test(name);
}

const singlesExclusion=(game:string,product:SinglesSourceProduct,set:string)=>game==="riftbound"?riftboundExclusion(product,set):null;

export function preferredPrices(prices: SinglesPriceRow[]) {
  const byId = new Map<number, SinglesPriceRow>();
  for (const price of prices) {
    if (!(Number(price.marketPrice) > 0)) continue;
    const previous = byId.get(Number(price.productId));
    if (!previous || Number(price.marketPrice) > Number(previous.marketPrice)) byId.set(Number(price.productId), price);
  }
  return byId;
}

function missingPricePrinting(product: SinglesSourceProduct, prices: SinglesPriceRow[], metal: boolean): string {
  const printing = prices.find(row => Number(row.productId) === Number(product.productId))?.subTypeName;
  if (printing) return printing;
  const description = extended(product, "Description");
  if (/only available as non-foil/i.test(description)) return "Normal";
  if (/only available as foil/i.test(description)) return "Foil";
  return metal ? "Unknown" : "Normal";
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
    const exclusion=singlesExclusion(game,product,group.name);
    if (exclusion) { reject(exclusion); continue; }
    // Fixed-section groups (Japanese promos, audit Phase E) take every priced card in the
    // group regardless of rarity taxonomy; Japanese listings often omit the Rarity field.
    const price = priceById.get(Number(product.productId)), rarity = extended(product, "Rarity") || (fixedSection ? "Promo" : ""), number = extended(product, "Number");
    const keepUnpriced = game === "riftbound";
    if (!price && !keepUnpriced) { reject("missing-market-price"); continue; }
    if (!rarity || !number) { reject("missing-card-metadata"); continue; }
    const selected = fixedSection ?? (game === "pokemon" ? pokemonSection(rarity, year) : riftboundSection(product.name, rarity));
    if (!selected) { reject("unsupported-rarity"); continue; }
    const [section, label] = selected, prior = previous.get(`${game}:${product.productId}`);
    labels.set(section, label);
    cards.push({
      game, section, productId: Number(product.productId), name: product.name, set: group.name, year, rarity, number,
      image: product.imageUrl?.replace("_200w", "_in_1000x1000") ?? "", url: product.url ?? "",
      marketPrice: price ? Number(price.marketPrice) : null, lowPrice: positive(price?.lowPrice),
      midPrice: positive(price?.midPrice), highPrice: positive(price?.highPrice),
      printing: price?.subTypeName ?? missingPricePrinting(product, prices, keepUnpriced),
      priceChange: price && typeof prior === "number" ? Number((Number(price.marketPrice) - prior).toFixed(2)) : null,
    });
  }
  return { cards, rejected, labels };
}
