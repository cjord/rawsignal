import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSetHeatmapSnapshot } from "../../../../db/set-heatmap.ts";
import type { D1DatabaseLike } from "../../../../db/repository.ts";
import { CACHE_TIERS } from "../../cache.ts";

export async function GET() {
  try {
    const payload = await readSetHeatmapSnapshot(env.DB as unknown as D1DatabaseLike | undefined);
    if (!payload) return NextResponse.json({ error: "Heatmap snapshot is not ready" }, { status: 503 });
    return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.medium } });
  } catch {
    return NextResponse.json({ error: "Heatmap unavailable" }, { status: 503 });
  }
}
