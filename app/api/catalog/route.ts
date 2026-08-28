import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { createFeedCatalogRepository } from "../../data/feed-catalog-repository.ts";
import { catalogRequestFromUrl, executeCatalogRequest } from "../../data/catalog-service.ts";
import { createD1CatalogRepository } from "../../../db/catalog-repository.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";

async function readyDatabaseCatalog(db: D1DatabaseLike) {
  const published = await publishedIngestion(db);
  if (!published) return null;
  const row = await db.prepare("select count(*) as count from catalog_products where ingestion_run_id=?").bind(published.runId).first<{ count: number }>();
  // At least, not exactly: a batch that failed mid-write and was retried stamps its records
  // on the first attempt but counts them as duplicates on the retry. The guard's intent is
  // "no partial catalog", which the completed run plus full coverage already proves.
  return (row?.count ?? 0) >= published.recordsWritten && published.recordsWritten > 0 ? published : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url), catalogRequest = catalogRequestFromUrl(url);
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (db) {
    try {
      const published = await readyDatabaseCatalog(db);
      const signalsReady = catalogRequest.options.signal === "leaderboard" || Boolean(await publishedIngestion(db, "history-signals"));
      if (published && signalsReady) {
        const repository = createD1CatalogRepository(db, published.runId);
        const result = await executeCatalogRequest(catalogRequest, repository, "database");
        return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } });
      }
    } catch {
      // A deployment can precede its catalog backfill. Preserve the last good feed until D1 is ready.
    }
  }
  try {
    const assets = (env as unknown as { ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } }).ASSETS;
    const repository = await createFeedCatalogRepository(url.origin, assets ? assets.fetch.bind(assets) : fetch);
    const result = await executeCatalogRequest(catalogRequest, repository, "feed");
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  }
}
