import type { CollectrImportCard } from "../api/collectr/route";

// The Collectr import page's table model: filtering, sorting, portfolio totals, set
// options, and paging over an imported card list. Pure so it can be tested without the
// page's hooks (signals, price history, favorites), which supply the lookups it needs.

export type ImportLens = "all" | "hold" | "sell";
export type ImportScope = "all" | "singles" | "sealed";
export type ImportMarket = "all" | "pokemon" | "riftbound";
export type ImportSortCol = "qty" | "card" | "signal" | "set" | "collectr" | "market" | "change7" | "change30";
export type SortDir = "asc" | "desc";

export const effectivePrice = (card: CollectrImportCard) => card.matched?.marketPrice ?? card.collectrPrice ?? 0;

// Unmatched One Piece rows keep their "onepiece" game: it never equals a market tab, so they
// surface only under the All scope (user decision 2026-08-31).
export const cardGame = (card: CollectrImportCard): ImportMarket | "onepiece" | null => card.matched ? (card.matched.game as ImportMarket) : card.game;

export const displayName = (card: CollectrImportCard) => card.matched?.name ?? card.name;
export const displaySet = (card: CollectrImportCard) => card.matched?.set ?? card.set;

// Imported cards, most valuable first — the base order every other view derives from.
export function orderByValue(cards: readonly CollectrImportCard[]): CollectrImportCard[] {
  return [...cards].sort((a, b) => effectivePrice(b) - effectivePrice(a));
}

export type ImportFilter = {
  scope: ImportScope;
  market: ImportMarket;
  lens: ImportLens;
  holdIds: ReadonlySet<number>;
  sellIds: ReadonlySet<number>;
  query: string;
  setFilter: readonly string[];
  minPrice: string;
  maxPrice: string;
};

// An empty price box means "no bound"; a non-numeric one is ignored rather than hiding every row.
const priceBound = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

export function filterImportCards(cards: readonly CollectrImportCard[], filter: ImportFilter): CollectrImportCard[] {
  const min = priceBound(filter.minPrice), max = priceBound(filter.maxPrice);
  const needle = filter.query.trim().toLowerCase();
  return cards.filter(card => {
    if (filter.scope === "singles" && card.kind !== "single") return false;
    if (filter.scope === "sealed" && card.kind !== "sealed") return false;
    if (filter.market !== "all" && cardGame(card) !== filter.market) return false;
    if (filter.lens === "hold" && !filter.holdIds.has(card.productId)) return false;
    if (filter.lens === "sell" && !filter.sellIds.has(card.productId)) return false;
    if (needle && !`${displayName(card)} ${displaySet(card)} ${card.number}`.toLowerCase().includes(needle)) return false;
    if (filter.setFilter.length && !filter.setFilter.includes(displaySet(card))) return false;
    const price = effectivePrice(card);
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;
    return true;
  });
}

export type ImportSortLookups = {
  signalScore: (card: CollectrImportCard) => number | null | undefined;
  history: (card: CollectrImportCard) => { change7?: number | null; change30?: number | null } | undefined;
};

export function sortValueOf(card: CollectrImportCard, col: ImportSortCol, lookups: ImportSortLookups): number | string | null {
  switch (col) {
    case "qty": return card.quantity;
    case "card": return displayName(card).toLowerCase();
    case "set": return displaySet(card).toLowerCase();
    case "collectr": return card.collectrPrice ?? null;
    case "market": return card.matched ? card.matched.marketPrice : null;
    case "signal": return lookups.signalScore(card) ?? null;
    case "change7": return lookups.history(card)?.change7 ?? null;
    case "change30": return lookups.history(card)?.change30 ?? null;
  }
}

// Sort the filtered rows; nulls (unmatched / no data) always sink to the bottom whatever
// the direction. Ties keep their incoming (value-descending) order.
export function sortImportCards(cards: readonly CollectrImportCard[], col: ImportSortCol, dir: SortDir, lookups: ImportSortLookups): CollectrImportCard[] {
  const keyed = cards.map(card => ({ card, value: sortValueOf(card, col, lookups) }));
  keyed.sort((a, b) => {
    if (a.value == null && b.value == null) return 0;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    const order = typeof a.value === "string" ? a.value.localeCompare(String(b.value)) : Number(a.value) - Number(b.value);
    return dir === "asc" ? order : -order;
  });
  return keyed.map(entry => entry.card);
}

export function importSetOptions(cards: readonly CollectrImportCard[], market: ImportMarket): { key: string; label: string }[] {
  const names = new Set<string>();
  for (const card of cards) {
    if (market !== "all" && cardGame(card) !== market) continue;
    names.add(displaySet(card));
  }
  return [...names].sort().map(name => ({ key: name, label: name }));
}

export type PortfolioTotals = {
  matched: CollectrImportCard[];
  unmatched: CollectrImportCard[];
  // Near Mint market × quantity over matched cards only.
  marketTotal: number;
  // Collectr's condition-adjusted value × quantity over every imported card.
  collectrTotal: number;
  // Effective price × quantity over cards the sell board currently flags.
  sellValue: number;
};

export function portfolioTotals(cards: readonly CollectrImportCard[], sellIds: ReadonlySet<number>): PortfolioTotals {
  const matched = cards.filter(card => card.matched);
  return {
    matched,
    unmatched: cards.filter(card => !card.matched),
    marketTotal: matched.reduce((sum, card) => sum + card.matched!.marketPrice * card.quantity, 0),
    collectrTotal: cards.reduce((sum, card) => sum + (card.collectrPrice ?? 0) * card.quantity, 0),
    sellValue: cards.filter(card => sellIds.has(card.productId)).reduce((sum, card) => sum + effectivePrice(card) * card.quantity, 0),
  };
}

// Page arithmetic with the requested page clamped into range (a shrinking filter never
// leaves the table on an empty page).
export function pageWindow<T>(rows: readonly T[], page: number, perPage: number): { pages: number; page: number; rows: T[] } {
  const size = Math.max(1, Math.floor(perPage) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { pages, page: safePage, rows: rows.slice((safePage - 1) * size, safePage * size) };
}
