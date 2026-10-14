import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { historyBatchKey, parseHistoryTargets } from "../../../../core/history-batch.ts";
import { readHistorySnapshots } from "../../../../db/history-snapshot.ts";
import type { D1DatabaseLike } from "../../../../db/repository.ts";
import { CACHE_TIERS } from "../../cache.ts";

// A page of exact, versioned snapshots in one indexed query. Missing versions return
// null; the client never fans out to another history source. Visitor reads never write.
export async function GET(request: Request) {
  const targets = parseHistoryTargets(new URL(request.url).searchParams.get("t"));
  if (!targets) return NextResponse.json({ error: "Invalid history batch" }, { status: 400 });
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return NextResponse.json({ histories: Object.fromEntries(targets.map(target => [historyBatchKey(target), null])) }, { headers: { "Cache-Control": CACHE_TIERS.transient } });
  try {
    const stored = await readHistorySnapshots(db, targets);
    const histories: Record<string, unknown> = {};
    for (const [key, series] of stored) histories[key] = series;
    return NextResponse.json({ histories }, { headers: { "Cache-Control": CACHE_TIERS.hour } });
  } catch {
    // An unmigrated database reads as unavailable and is not cached for long.
    return NextResponse.json({ histories: Object.fromEntries(targets.map(target => [historyBatchKey(target), null])) }, { headers: { "Cache-Control": CACHE_TIERS.transient } });
  }
}
