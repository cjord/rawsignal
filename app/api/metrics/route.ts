import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { loadPullRateConfig } from "../../data/load-detail.ts";
import { loadMetricsPayload } from "../../../db/metrics-service.ts";
import type { D1DatabaseLike } from "../../../db/repository.ts";
import { CACHE_TIERS } from "../cache.ts";

export async function GET() {
  try {
    const payload = await loadMetricsPayload(env.DB as unknown as D1DatabaseLike | undefined, { pullRates: await loadPullRateConfig() });
    if (!payload) return NextResponse.json({ error: "Metrics require the database-backed deployment" }, { status: 503 });
    return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.medium } });
  } catch {
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 503 });
  }
}
