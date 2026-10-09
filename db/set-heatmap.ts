import { buildSetHeatmap, type HeatmapGame, type HeatmapMember, type SetHeatmapPayload, type SetHeatmapRow } from "../core/domain/set-heatmap.ts";
import type { PricePoint } from "../core/domain/types.ts";
import { publishedIngestion, type D1DatabaseLike } from "./repository.ts";

type MemberRow = {
  productId: number; game: HeatmapGame; setName: string; section: string | null;
  latest: string | null; baseline7: string | null; baseline30: string | null; baseline90: string | null;
};

type SnapshotRow = {
  game: HeatmapGame; sourceRunId: string; sourceDate: string;
  algorithmVersion: number; payloadJson: string;
};

const games: HeatmapGame[] = ["pokemon", "riftbound"];
// A policy change must invalidate saved rows even when the catalog run is unchanged.
export const SET_HEATMAP_ALGORITHM_VERSION = 2;
const maxSnapshotBytes = 1_900_000; // D1's row/string limit is 2 MB.

const missingSnapshotTable = (error: unknown) =>
  error instanceof Error && /no such table: set_heatmap_snapshots/i.test(error.message);

export async function readSetHeatmapSnapshotStatus(db: D1DatabaseLike): Promise<{ available: boolean; sourceRunId: string | null }> {
  let rows: Pick<SnapshotRow, "game" | "sourceRunId">[];
  try {
    rows = (await db.prepare("select game,source_run_id sourceRunId from set_heatmap_snapshots where algorithm_version=?")
      .bind(SET_HEATMAP_ALGORITHM_VERSION).all<Pick<SnapshotRow, "game" | "sourceRunId">>()).results ?? [];
  } catch (error) {
    if (missingSnapshotTable(error)) return { available: false, sourceRunId: null };
    throw error;
  }
  const complete = games.every(game => rows.some(row => row.game === game));
  const sourceRunId = complete && rows.every(row => row.sourceRunId === rows[0].sourceRunId)
    ? rows[0].sourceRunId : null;
  return { available: true, sourceRunId };
}

export async function readSetHeatmapSnapshot(db: D1DatabaseLike | undefined): Promise<SetHeatmapPayload | null> {
  if (!db) return null;
  let rows: SnapshotRow[];
  try {
    rows = (await db.prepare(`select game,source_run_id sourceRunId,source_date sourceDate,
      algorithm_version algorithmVersion,payload_json payloadJson from set_heatmap_snapshots
      where algorithm_version=? order by game`).bind(SET_HEATMAP_ALGORITHM_VERSION).all<SnapshotRow>()).results ?? [];
  } catch (error) {
    if (missingSnapshotTable(error)) return null;
    throw error;
  }
  if (rows.length !== games.length || !games.every(game => rows.some(row => row.game === game))) return null;
  if (rows.some(row => row.sourceRunId !== rows[0].sourceRunId || row.sourceDate !== rows[0].sourceDate)) return null;
  try {
    const parsed = rows.flatMap(row => JSON.parse(row.payloadJson) as SetHeatmapRow[]);
    if (parsed.some(row => !games.includes(row.game))) return null;
    return { asOfDate: rows[0].sourceDate, rows: parsed };
  } catch { return null; }
}

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

export async function calculateSetHeatmap(
  db: D1DatabaseLike | undefined,
  publishedSnapshot?: NonNullable<Awaited<ReturnType<typeof publishedIngestion>>>,
): Promise<SetHeatmapPayload | null> {
  if (!db) return null;
  const published = publishedSnapshot ?? await publishedIngestion(db).catch(() => null);
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

/** Expensive once-per-published-run calculation; never call from a page request. */
export async function writeSetHeatmapSnapshot(db: D1DatabaseLike, computedAt = new Date().toISOString()) {
  const published = await publishedIngestion(db);
  if (!published?.runId || !published.sourceUpdatedAt) throw new Error("No published catalog for heatmap");
  const payload = await calculateSetHeatmap(db, published);
  if (!payload || !games.every(game => payload.rows.some(row => row.game === game))) {
    throw new Error("Heatmap calculation did not include both games");
  }
  const statements = games.map(game => {
    const json = JSON.stringify(payload.rows.filter(row => row.game === game));
    if (new TextEncoder().encode(json).byteLength > maxSnapshotBytes) throw new Error(`${game} heatmap exceeds D1 row limit`);
    return db.prepare(`insert into set_heatmap_snapshots
      (game,source_run_id,source_date,algorithm_version,payload_json,computed_at)
      values (?,?,?,?,?,?) on conflict(game) do update set
      source_run_id=excluded.source_run_id,source_date=excluded.source_date,
      algorithm_version=excluded.algorithm_version,payload_json=excluded.payload_json,
      computed_at=excluded.computed_at`)
      .bind(game, published.runId, payload.asOfDate, SET_HEATMAP_ALGORITHM_VERSION, json, computedAt);
  });
  await db.batch(statements);
  return { sourceRunId: published.runId, sourceDate: payload.asOfDate, sets: payload.rows.length };
}
