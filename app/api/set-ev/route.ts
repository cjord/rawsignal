import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { loadPullRateConfig } from "../../data/load-detail.ts";
import { loadSetEvRows } from "../../../db/metrics-service.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";

// Per-set chase EV (audit Phase C): a small feed the sealed view reads once to annotate
// hover cards. Database-backed deployments only — no estimates without live singles data.
export async function GET() {
  try {
    const db = env.DB as unknown as D1DatabaseLike | undefined;
    if (!db || !(await publishedIngestion(db))) return NextResponse.json({ error: "Set EV requires the database-backed deployment" }, { status: 503 });
    const rows = await loadSetEvRows(db, await loadPullRateConfig());
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Set EV unavailable" }, { status: 503 });
  }
}
