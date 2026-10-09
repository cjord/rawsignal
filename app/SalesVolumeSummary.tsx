import type { SalesSummary } from "../core/domain/sales-summary.ts";
import { salesFreshness, salesPeriodChange } from "../core/domain/sales-summary.ts";

export default function SalesVolumeSummary({ summary }: { summary?: SalesSummary }) {
  if (!summary) return <p className="detail-unavailable">TCGplayer sales volume is unavailable for this printing and condition.</p>;
  const freshness = salesFreshness(summary), change = salesPeriodChange(summary);
  const count = (value: number | null) => value == null ? "N/A" : value.toLocaleString();
  return <div aria-label="TCGplayer sales volume">
    <div className="detail-history-grid">
      <div className="detail-metric"><small>Copies sold (7D)</small><b>{count(summary.sales7)}</b></div>
      <div className="detail-metric"><small>Copies sold (30D)</small><b>{count(summary.sales30)}</b></div>
      <div className="detail-metric"><small>Copies sold (prior 30D)</small><b>{count(summary.sales30Prior)}</b></div>
      <div className="detail-metric"><small>30D vs prior 30D</small><b>{change == null ? "N/A" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}</b></div>
    </div>
    <p className="detail-note">
      {freshness === "unknown" ? "Sales freshness unknown — legacy snapshot; these are not verified current totals. " :
        `${freshness === "stale" ? "Stale sales snapshot · " : ""}Latest bucket starts ${summary.throughDate} · fetched ${summary.fetchedAt?.slice(0, 10)}. `}
      TCGplayer completed-sale units for this printing and condition; one sealed product counts as one unit.
      {` Whole ${summary.bucketDays}-day buckets make these approximate window totals, not daily counts. Prior 30D is the non-overlapping period before the recent 30D. `}
      Comparison is unavailable when the prior count is zero or missing. Price updates do not refresh sales counts.
    </p>
  </div>;
}
