// Wire format for the batched history endpoint (`/api/history/batch?t=…`): a comma list
// of `<productId>:<printing>[:s]` entries, each component URI-encoded so printings with
// spaces or slashes survive. Shared by the client loader and the route so the two cannot
// drift, and small enough that the URL doubles as the cache key at the edge.

export type HistoryBatchTarget = { productId: number; printing: string; sealed?: boolean };

export const HISTORY_BATCH_LIMIT = 40;

export const historyBatchKey = (target: HistoryBatchTarget) => `${target.sealed ? "sealed" : "single"}:${target.productId}:${target.printing.toLowerCase()}`;

export function encodeHistoryTargets(targets: readonly HistoryBatchTarget[]): string {
  return targets.map(target => `${target.productId}:${encodeURIComponent(target.printing)}${target.sealed ? ":s" : ""}`).join(",");
}

// Returns null for anything malformed or over the limit; the route answers 400 rather than
// guessing. Duplicate keys collapse to the first occurrence.
export function parseHistoryTargets(raw: string | null): HistoryBatchTarget[] | null {
  if (!raw) return null;
  const seen = new Map<string, HistoryBatchTarget>();
  for (const part of raw.split(",")) {
    const match = /^(\d{1,9}):([^:]*)(:s)?$/.exec(part);
    if (!match) return null;
    let printing: string;
    try { printing = decodeURIComponent(match[2]); } catch { return null; }
    const target: HistoryBatchTarget = { productId: Number(match[1]), printing, ...(match[3] ? { sealed: true } : {}) };
    const key = historyBatchKey(target);
    if (!seen.has(key)) seen.set(key, target);
    if (seen.size > HISTORY_BATCH_LIMIT) return null;
  }
  return seen.size ? [...seen.values()] : null;
}

// Split a target list into request-sized chunks, preserving order.
export function chunkHistoryTargets<T>(targets: readonly T[], size = HISTORY_BATCH_LIMIT): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < targets.length; index += size) chunks.push(targets.slice(index, index + size));
  return chunks;
}
