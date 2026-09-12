export type MarketPriceWarning = {
  medianPrice: number;
  marketPrice: number;
  marketDifferencePct: number;
};

const positive = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0;

/**
 * Flag a material gap between Market and Listed Median for Singles or Sealed.
 * The percentage is measured against Median so the comparison stays conservative.
 * Listing low is deliberately excluded, and Market remains the trend basis.
 */
export function marketPriceWarning(
  item: { marketPrice: number | null; midPrice: number | null },
  threshold = 0.15,
): MarketPriceWarning | null {
  if (!positive(item.marketPrice) || !positive(item.midPrice)) return null;
  const marketDifference = item.marketPrice / item.midPrice - 1;
  if (Math.abs(marketDifference) + 1e-12 < threshold) return null;
  const marketDifferencePct = Number((marketDifference * 100).toFixed(8));
  return {
    medianPrice: item.midPrice,
    marketPrice: item.marketPrice,
    marketDifferencePct,
  };
}
