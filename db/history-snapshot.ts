import { parsePriceHistory } from "../core/domain/contracts.ts";
import { historyBatchKey, type HistoryBatchTarget } from "../core/history-batch.ts";
import type { PriceHistory } from "../core/domain/types.ts";
import type { D1DatabaseLike } from "./repository.ts";

type SnapshotRow = { productId: number; variant: string; condition: string; currentJson: string | null; previousJson: string | null };

function selectSnapshot(row: SnapshotRow | undefined, version?: string): PriceHistory | null {
  if (!row) return null;
  for (const json of [row.currentJson, ...(version ? [row.previousJson] : [])]) {
    if (!json) continue;
    try {
      const value = JSON.parse(json);
      if (Array.isArray(value.pointRows)) value.points = value.pointRows.map(([date, price]: [string, number]) => ({ date, price }));
      const history = parsePriceHistory(value);
      if (history.snapshotId && (!version || version === history.snapshotId)) return history;
    } catch { /* Never substitute another series or partial data. */ }
  }
  return null;
}

// Indexed metric rows only: no upstream requests, writes, or observation scans.
export async function readHistorySnapshots(db: D1DatabaseLike, targets: readonly HistoryBatchTarget[]): Promise<Map<string, PriceHistory | null>> {
  const ids = [...new Set(targets.map(target => target.productId))];
  if (!ids.length) return new Map();
  const rows = (await db.prepare(`select product_id as productId,variant,condition,
    history_snapshot_json as currentJson,previous_history_snapshot_json as previousJson
    from market_metrics where product_id in (${ids.map(() => "?").join(",")})`).bind(...ids).all<SnapshotRow>()).results ?? [];
  return new Map(targets.map(target => {
    const variant = target.sealed ? "Sealed" : target.printing;
    const condition = target.sealed ? "Unopened" : "Near Mint";
    const row = rows.find(row => row.productId === target.productId && row.variant.toLowerCase() === variant.toLowerCase() && row.condition === condition);
    return [historyBatchKey(target), selectSnapshot(row, target.snapshotId)];
  }));
}
