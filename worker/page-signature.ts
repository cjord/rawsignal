import type { D1DatabaseLike } from "../db/repository.ts";

// What a public page is built from: the published runs (catalog and prices, product details,
// the metrics rollup, the signal marker, graded prices) and the deployed version. The page
// edge cache folds this signature into its key (review §15, crawler cost), so an entry lives
// until the next publish or deploy instead of a fixed ten minutes — a crawler walking the
// product long tail then costs one render per URL per colo per day. The signature is read once
// a minute per isolate (a few rows), which bounds how long the previous publish keeps serving.
// When D1 cannot answer, the signature falls back to a ten-minute time bucket: the cache then
// behaves exactly as it did before this keying.

export const PUBLISH_KEYS = ["daily-market", "product-details", "metrics-rollup", "history-signals", "graded-rotation"] as const;
export const SIGNATURE_TTL_MS = 60_000;
const FALLBACK_BUCKET_MS = 600_000;

type Memo = { at: number; value: Promise<string> };
const memos = new WeakMap<D1DatabaseLike, Memo>();

export async function readPublishSignature(db: D1DatabaseLike): Promise<string> {
  const rows = (await db.prepare(`select key, ingestion_run_id as runId, last_success_at as at from refresh_state where key in (${PUBLISH_KEYS.map(() => "?").join(",")}) order by key`)
    .bind(...PUBLISH_KEYS).all<{ key: string; runId: string | null; at: string | null }>()).results ?? [];
  return rows.map(row => `${row.key}=${row.runId ?? ""}@${row.at ?? ""}`).join(";");
}

export const fallbackSignature = (version: string, now: number) => `${version}|t${Math.floor(now / FALLBACK_BUCKET_MS)}`;

export function pageCacheSignature(db: D1DatabaseLike | undefined, version: string, now = Date.now()): Promise<string> {
  if (!db) return Promise.resolve(fallbackSignature(version, now));
  const memo = memos.get(db);
  if (memo && now - memo.at < SIGNATURE_TTL_MS) return memo.value;
  const value = readPublishSignature(db)
    .then(runs => `${version}|${runs}`)
    .catch(() => { memos.delete(db); return fallbackSignature(version, now); });
  memos.set(db, { at: now, value });
  return value;
}
