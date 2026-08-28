import { fuzzyTextMatch } from "../market-utils.ts";
import type { Card, MarketSignal, PriceHistory, SealedMarket, SealedProduct, SignalSide, SignalStrictness, SinglesMarket } from "../domain/types.ts";
import type { Direction, SealedSort, SinglesSort } from "../state/market-query.ts";

export type CatalogDerived = Pick<PriceHistory, "change7" | "change30" | "low30" | "high30"> & {
  signal: MarketSignal | null;
};

export type CatalogPage<T> = {
  items: T[];
  allItems: T[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
  facets: {
    sets: string[];
    sections: string[];
    productTypes: string[];
  };
};

export type SinglesCatalogQuery = {
  market: SinglesMarket;
  sections: string[];
  query: string;
  sets: string[];
  minPrice: string;
  maxPrice: string;
  up7: boolean;
  down7: boolean;
  up30: boolean;
  down30: boolean;
  signal: SignalSide;
  strictness: SignalStrictness;
  sort: SinglesSort;
  direction: Direction;
  page: number;
  perPage: number;
};

export type SinglesCandidateQuery = Pick<SinglesCatalogQuery, "market" | "sections" | "query" | "sets" | "minPrice" | "maxPrice">;

export type SealedScenario = {
  basis: "market" | "median";
  keepPct: number;
  taxOn: boolean;
  taxRate: number;
  shipping: number;
};

export type SealedCalculation = {
  value: number | null;
  cost: number | null;
  proceeds: number | null;
  profit: number | null;
  profitPct: number | null;
};

export type SealedCatalogQuery = SealedScenario & {
  market: SealedMarket;
  productTypes: string[];
  query: string;
  sets: string[];
  marketMin: string;
  marketMax: string;
  msrpMin: string;
  msrpMax: string;
  profitMin: string;
  profitMax: string;
  profitPctMin: string;
  profitPctMax: string;
  profitableOnly: boolean;
  signal: SignalSide;
  strictness: SignalStrictness;
  sort: SealedSort;
  direction: Direction;
  page: number;
  perPage: number;
};

export const sealedProductTypes = [
  "Booster Packs",
  "Booster Boxes",
  "Booster Bundles",
  "Starter / Theme Decks",
  "Elite Trainer Boxes",
  "Troves",
  "Build & Battle",
  "Collections",
  "Tins",
  "Blisters",
  "Trainer Kits / Toolkits",
  "Cases",
  "Boxes / Bundles",
  "Other",
] as const;

// Riftbound's feed taxonomy maps onto the shared type buckets (visual pass 2026-08-28):
// without the aliases every riftbound product normalized to "Other" and the type filter
// offered nothing for that market.
const categoryAliases: Record<string, (typeof sealedProductTypes)[number]> = {
  "Boosters": "Booster Packs",
  "Booster boxes": "Booster Boxes",
  "Decks": "Starter / Theme Decks",
  "Gift boxes": "Boxes / Bundles",
  "Collector bundles": "Collections",
};

// One resolver for anything holding a raw category string (facets, filters, and the
// metrics category deep links): alias first, then case-insensitive canonical match.
export function canonicalSealedType(category: string) {
  const aliased = categoryAliases[category] ?? category;
  return (sealedProductTypes as readonly string[]).find(type => type.toLowerCase() === aliased.toLowerCase()) ?? "Other";
}

export function sealedProductType(product: SealedProduct) {
  return canonicalSealedType(product.category);
}

export function calculateSealedScenario(product: SealedProduct, scenario: SealedScenario): SealedCalculation {
  const value = scenario.basis === "median" ? product.midPrice ?? product.marketPrice : product.marketPrice;
  const cost = product.msrp == null ? null : product.msrp * (scenario.taxOn ? 1 + scenario.taxRate / 100 : 1) + scenario.shipping;
  const proceeds = value == null ? null : value * scenario.keepPct / 100;
  if (value == null || cost == null) return { value, cost, proceeds, profit: null, profitPct: null };
  const profit = proceeds! - cost;
  return { value, cost, proceeds, profit, profitPct: cost ? profit / cost * 100 : 0 };
}

function finiteFilter(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableCompare(a: number | null | undefined, b: number | null | undefined, direction: Direction) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function textCompare(a: string, b: string, direction: Direction) {
  const result = a.localeCompare(b);
  return direction === "asc" ? result : -result;
}

function movementMatches(value: number | null | undefined, up: boolean, down: boolean) {
  return !up && !down || value != null && (up && value > 0 || down && value < 0);
}

function paginate<T>(items: T[], requestedPage: number, perPage: number, facets: CatalogPage<T>["facets"]): CatalogPage<T> {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(1, requestedPage), pages);
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    allItems: items,
    total: items.length,
    page,
    pages,
    perPage,
    facets,
  };
}

export function querySinglesCatalog(cards: Card[], options: SinglesCatalogQuery, derived: Record<number, CatalogDerived | undefined> = {}): CatalogPage<Card> {
  const marketCards = cards.filter(card => (options.market === "all" || card.game === options.market) && (!options.sections.length || options.sections.includes(card.section)));
  const facets = {
    sets: [...new Set(marketCards.map(card => card.set))].sort(),
    sections: [...new Set(marketCards.map(card => card.section))].sort(),
    productTypes: [],
  };
  const filtered = filterSinglesCandidates(marketCards, options).filter(card => {
    const metrics = derived[card.productId];
    return movementMatches(metrics?.change7, options.up7, options.down7)
      && movementMatches(metrics?.change30, options.up30, options.down30)
      && (options.signal === "leaderboard" || Boolean(metrics?.signal));
  });
  // Hot boards list every qualifying signal (top-N curation removed 2026-08-28): the
  // stabilization and liquidity gates already keep weak entries off, and pagination
  // handles depth. Default score ordering comes from the "signal" sort below.
  filtered.sort((a, b) => {
    const am = derived[a.productId], bm = derived[b.productId];
    if (options.sort === "name") return textCompare(a.name, b.name, options.direction);
    if (options.sort === "set") return textCompare(a.set, b.set, options.direction) || textCompare(a.name, b.name, options.direction);
    if (options.sort === "signal") return nullableCompare(am?.signal?.score, bm?.signal?.score, options.direction);
    if (options.sort === "low") return nullableCompare(am?.low30 ?? a.lowPrice, bm?.low30 ?? b.lowPrice, options.direction);
    if (options.sort === "high") return nullableCompare(am?.high30 ?? a.highPrice, bm?.high30 ?? b.highPrice, options.direction);
    if (options.sort === "change7") return nullableCompare(am?.change7, bm?.change7, options.direction);
    if (options.sort === "change30") return nullableCompare(am?.change30, bm?.change30, options.direction);
    return nullableCompare(a.marketPrice, b.marketPrice, options.direction);
  });
  return paginate(filtered, options.page, options.perPage, facets);
}

export function filterSinglesCandidates(cards: Card[], options: SinglesCandidateQuery) {
  const min = finiteFilter(options.minPrice), max = finiteFilter(options.maxPrice);
  return cards.filter(card => (options.market === "all" || card.game === options.market)
    && (!options.sections.length || options.sections.includes(card.section))
    && fuzzyTextMatch(`${card.name} ${card.set} ${card.number} ${card.rarity} ${card.printing}`, options.query)
    && (!options.sets.length || options.sets.includes(card.set))
    && (min == null || card.marketPrice >= min)
    && (max == null || card.marketPrice <= max));
}

export function querySealedCatalog(products: SealedProduct[], options: SealedCatalogQuery, derived: Record<number, CatalogDerived | undefined> = {}): CatalogPage<SealedProduct> {
  // Scalping's curated allowlist mixes games; the "all" scope keeps every loaded market.
  const marketProducts = options.market === "scalping" || options.market === "all" ? products : products.filter(product => product.game === options.market);
  const facets = {
    sets: [...new Set(marketProducts.map(product => product.set))].sort(),
    sections: [],
    productTypes: [...new Set(marketProducts.map(sealedProductType))].sort((a, b) => {
      const ai = sealedProductTypes.indexOf(a as typeof sealedProductTypes[number]);
      const bi = sealedProductTypes.indexOf(b as typeof sealedProductTypes[number]);
      return ai - bi;
    }),
  };
  const marketMin = finiteFilter(options.marketMin), marketMax = finiteFilter(options.marketMax);
  const msrpMin = finiteFilter(options.msrpMin), msrpMax = finiteFilter(options.msrpMax);
  const profitMin = finiteFilter(options.profitMin), profitMax = finiteFilter(options.profitMax);
  const profitPctMin = finiteFilter(options.profitPctMin), profitPctMax = finiteFilter(options.profitPctMax);
  const filtered = marketProducts.filter(product => {
    const calculation = calculateSealedScenario(product, options), metrics = derived[product.productId];
    return (!options.sets.length || options.sets.includes(product.set))
      && (!options.productTypes.length || options.productTypes.includes(sealedProductType(product)))
      && fuzzyTextMatch(`${product.name} ${product.set} ${product.category} ${sealedProductType(product)}`, options.query)
      && (marketMin == null || calculation.value != null && calculation.value >= marketMin)
      && (marketMax == null || calculation.value != null && calculation.value <= marketMax)
      && (msrpMin == null || product.msrp != null && product.msrp >= msrpMin)
      && (msrpMax == null || product.msrp != null && product.msrp <= msrpMax)
      && (profitMin == null || calculation.profit != null && calculation.profit >= profitMin)
      && (profitMax == null || calculation.profit != null && calculation.profit <= profitMax)
      && (profitPctMin == null || calculation.profitPct != null && calculation.profitPct >= profitPctMin)
      && (profitPctMax == null || calculation.profitPct != null && calculation.profitPct <= profitPctMax)
      && (!options.profitableOnly || (calculation.profit ?? -Infinity) > 0)
      && (options.signal === "leaderboard" || Boolean(metrics?.signal));
  });
  filtered.sort((a, b) => {
    const ac = calculateSealedScenario(a, options), bc = calculateSealedScenario(b, options);
    if (options.sort === "name") return textCompare(a.name, b.name, options.direction);
    if (options.sort === "set") return textCompare(a.set, b.set, options.direction) || textCompare(a.name, b.name, options.direction);
    if (options.sort === "signal") return nullableCompare(derived[a.productId]?.signal?.score, derived[b.productId]?.signal?.score, options.direction);
    if (options.sort === "msrp") return nullableCompare(a.msrp, b.msrp, options.direction);
    if (options.sort === "market") return nullableCompare(ac.value, bc.value, options.direction);
    if (options.sort === "low") return nullableCompare(derived[a.productId]?.low30, derived[b.productId]?.low30, options.direction);
    if (options.sort === "high") return nullableCompare(derived[a.productId]?.high30, derived[b.productId]?.high30, options.direction);
    if (options.sort === "change7") return nullableCompare(derived[a.productId]?.change7, derived[b.productId]?.change7, options.direction);
    if (options.sort === "change30") return nullableCompare(derived[a.productId]?.change30, derived[b.productId]?.change30, options.direction);
    if (options.sort === "profit") return nullableCompare(ac.profit, bc.profit, options.direction);
    return nullableCompare(ac.profitPct, bc.profitPct, options.direction);
  });
  return paginate(filtered, options.page, options.perPage, facets);
}
