import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { createFeedCatalogRepository } from "../../data/feed-catalog-repository.ts";
import { catalogRequestFromUrl, executeCatalogRequest } from "../../data/catalog-service.ts";
import { createD1CatalogRepository } from "../../../db/catalog-repository.ts";
import type { D1DatabaseLike } from "../../../db/repository.ts";

async function hasDatabaseCatalog(db: D1DatabaseLike, kind: "single" | "sealed", game: string) {
  const row = await db.prepare("select count(*) as count from catalog_products where kind=? and game=?").bind(kind, game).first<{ count: number }>();
  return (row?.count ?? 0) > 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url), catalogRequest = catalogRequestFromUrl(url), kind = catalogRequest.kind;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (db) {
    try {
      if (await hasDatabaseCatalog(db, kind, catalogRequest.options.market)) {
        const repository = createD1CatalogRepository(db);
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
