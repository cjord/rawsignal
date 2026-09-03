import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { deriveHistoryMetrics } from "../../../../core/domain/history-metrics.ts";
import { historyBatchKey, parseHistoryTargets } from "../../../../core/history-batch.ts";
import { readStoredHistories } from "../../../../db/history-read.ts";
import type { D1DatabaseLike } from "../../../../db/repository.ts";
import { CACHE_TIERS } from "../../cache.ts";

// A page of rows' histories in one request (review §14 follow-up: the leaderboard issued
// one `/api/history` call per visible row on every sort, page, or market change). Stored
// observations only — a product with no stored series comes back `null` and the client
// falls back to the single-product route, which owns the upstream fetch and its cache
// warm. Read-only: this route never writes.
export async function GET(request: Request) {
  const targets = parseHistoryTargets(new URL(request.url).searchParams.get("t"));
  if (!targets) return NextResponse.json({ error: "Invalid history batch" }, { status: 400 });
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return NextResponse.json({ histories: Object.fromEntries(targets.map(target => [historyBatchKey(target), null])) }, { headers: { "Cache-Control": CACHE_TIERS.transient } });
  try {
    const stored = await readStoredHistories(db, targets);
    const histories: Record<string, unknown> = {};
    for (const [key, series] of stored) histories[key] = series ? { ...series, ...deriveHistoryMetrics(series.points) } : null;
    return NextResponse.json({ histories }, { headers: { "Cache-Control": CACHE_TIERS.hour } });
  } catch {
    // An unmigrated database (fresh sandbox) reads as "nothing stored": the client's
    // per-product fallback still works, and nothing is cached for long.
    return NextResponse.json({ histories: Object.fromEntries(targets.map(target => [historyBatchKey(target), null])) }, { headers: { "Cache-Control": CACHE_TIERS.transient } });
  }
}
