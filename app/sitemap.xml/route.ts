import { env } from "cloudflare:workers";
import { buildSitemap } from "../../core/sitemap.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../db/repository.ts";
import { readSetIndex } from "../../db/sets-service.ts";

// The crawl map: the core pages plus every set page, dated by the published run. Product pages
// are reachable from the set pages and the boards and are deliberately not listed (review §15).
// One index scan per render; served through the colo cache like every route.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  let sets: { game: string; slug: string }[] = [], lastmod: string | null = null;
  if (db) {
    try {
      const [published, index] = await Promise.all([publishedIngestion(db), readSetIndex(db)]);
      sets = index;
      lastmod = published?.lastSuccessAt?.slice(0, 10) ?? null;
    } catch { /* Without the database the map lists the core pages only. */ }
  }
  return new Response(buildSitemap(origin, sets, lastmod), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
