import { marketPriceWarning } from "../core/domain/market-price-context";
import { formatUsd } from "../core/domain/formatters";

export default function MarketMedianContext({
  item,
}: {
  item: { marketPrice: number | null; midPrice: number | null };
}) {
  const warning = marketPriceWarning(item);
  if (!warning) return null;
  const direction = warning.marketDifferencePct < 0 ? "below" : "above";
  return (
    <span className="market-median-context" role="note">
      <b>Price context:</b> Market {formatUsd(warning.marketPrice)} is {Math.abs(warning.marketDifferencePct).toFixed(0)}% {direction} Listed Median {formatUsd(warning.medianPrice)}. Thin or fast-moving activity can make either reference less representative; Listed Median reflects current asking prices. Trends use Market.
    </span>
  );
}
