// Calculations require a real market price; catalogs retain unpriced records.
export function hasMarketPrice<T extends { marketPrice: number | null }>(item: T): item is T & { marketPrice: number } {
  return item.marketPrice != null && Number.isFinite(item.marketPrice) && item.marketPrice > 0;
}
