import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { createFeedCatalogRepository } from "../../data/feed-catalog-repository.ts";
import { catalogRequestFromUrl, executeCatalogRequest } from "../../data/catalog-service.ts";
import { createD1CatalogRepository } from "../../../db/catalog-repository.ts";
import { readyCatalogRun } from "../../../db/readiness.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";
import { CACHE_TIERS } from "../cache.ts";

export async function GET(request: Request) {
  const url = new URL(request.url), catalogRequest = catalogRequestFromUrl(url);
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (db) {
    try {
      const published = await readyCatalogRun(db);
      const signalsReady = catalogRequest.options.signal === "leaderboard" || Boolean(await publishedIngestion(db, "history-signals"));
      if (published && signalsReady) {
        const repository = createD1CatalogRepository(db, published.runId);
        const result = await executeCatalogRequest(catalogRequest, repository, "database");
        return NextResponse.json(result, { headers: { "Cache-Control": CACHE_TIERS.short } });
      }
    } catch {
      // A deployment can precede its catalog backfill. Preserve the last good feed until D1 is ready.
    }
  }
  try {
    const assets = (env as unknown as { ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } }).ASSETS;
    const repository = await createFeedCatalogRepository(url.origin, assets ? assets.fetch.bind(assets) : fetch);
    const result = await executeCatalogRequest(catalogRequest, repository, "feed");
    return NextResponse.json(result, { headers: { "Cache-Control": CACHE_TIERS.short } });
  } catch {
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  }
}
