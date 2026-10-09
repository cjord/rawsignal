import { buildSetHeatmap, type HeatmapGame, type HeatmapMember, type SetHeatmapPayload } from "../core/domain/set-heatmap.ts";
import type { PricePoint } from "../core/domain/types.ts";
import { publishedIngestion, type D1DatabaseLike } from "./repository.ts";

type MemberRow = {
  productId: number; game: HeatmapGame; setName: string; section: string | null;
  latest: string | null; baseline7: string | null; baseline30: string | null; baseline90: string | null;
};

const shifted = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const sourceDate = "coalesce(substr(r.source_updated_at,1,10),case when o.source='tcgcsv-archive' then o.observed_date end)";

// Each scalar read seeks a narrow date band in the product/variant/condition/date PK.
// A daily observation uses the *successful run's source date*; its observed_date is
// the UTC tick date, which may be a day later. Archive rows already carry source dates.
function pointSql(): string {
  return `(select json_array(${sourceDate},o.market_cents) from price_observations o
    left join ingestion_runs r on o.source='tcgcsv-daily' and r.source='tcgcsv-live'
      and r.status='succeeded' and o.fetched_at>=r.started_at and o.fetched_at<=r.completed_at
    where o.product_id=p.product_id and o.variant=coalesce(p.printing,'Normal')
      and o.condition='Near Mint' and o.observed_date between ? and ?
      and (o.source='tcgcsv-archive' or r.id is not null) and ${sourceDate}<=?
    order by ${sourceDate} desc,o.fetched_at desc limit 1)`;
}

function parsePoint(value: string | null): PricePoint | null {
  if (!value) return null;
  try {
    const [date, cents] = JSON.parse(value) as [unknown, unknown];
    return typeof date === "string" && typeof cents === "number" && cents > 0
      ? { date, price: cents / 100 } : null;
  } catch { return null; }
}

export async function loadSetHeatmap(db: D1DatabaseLike | undefined): Promise<SetHeatmapPayload | null> {
  if (!db) return null;
  const published = await publishedIngestion(db).catch(() => null);
  const asOfDate = published?.sourceUpdatedAt?.slice(0, 10);
  if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return null;
  const dates = [asOfDate, shifted(asOfDate, -7), shifted(asOfDate, -30), shifted(asOfDate, -90)];
  const bounds = dates.flatMap((date, index) => [shifted(date, index ? -5 : -4), shifted(date, 2), date]);
  const rows = (await db.prepare(`select p.product_id productId,p.game,p.set_name setName,p.section,
      ${pointSql()} latest,${pointSql()} baseline7,${pointSql()} baseline30,${pointSql()} baseline90
    from catalog_products p where p.kind='single' and p.game in ('pokemon','riftbound')
      order by p.game,p.set_name,p.product_id`)
    .bind(...bounds).all<MemberRow>()).results ?? [];
  const members: HeatmapMember[] = rows.map(row => ({
    productId: row.productId, game: row.game, set: row.setName, section: row.section ?? "",
    latest: parsePoint(row.latest), baseline7: parsePoint(row.baseline7),
    baseline30: parsePoint(row.baseline30), baseline90: parsePoint(row.baseline90),
  }));
  return buildSetHeatmap(members, asOfDate);
}
