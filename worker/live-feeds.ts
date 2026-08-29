import { allowedRarities } from "../core/market-state.ts";
import { readSectionFeed, readSealedFeed } from "../db/catalog-repository.ts";
import { publishedIngestion } from "../db/repository.ts";
import type { StagingJobEnv } from "./staging-jobs.ts";

// The leaderboard UI loads bundled /data/*.json feeds client-side. Once D1 has a completed
// daily run, these exact URLs serve fresh database rows instead — the UI stays untouched and
// static assets remain the fallback (no DB binding, no marker, or any failure → null, which
// falls through to the asset). Server-side ingestion reads assets via the binding directly,
// so the live sync can never consume its own output.
const sealedPattern = /^\/data\/sealed-(pokemon|riftbound|onepiece)\.json$/;
const sectionPattern = /^\/data\/([a-z0-9-]+)\.json$/;
const singleSections = new Set<string>([...allowedRarities.pokemon, ...allowedRarities.riftbound]);

export type LiveFeedTarget = { kind: "sections"; sections: string[] } | { kind: "sealed"; market: string } | { kind: "freshness" };

export function liveFeedTarget(pathname: string): LiveFeedTarget | null {
  // The bundled manifest is baked at build time; a data product must not understate its own
  // freshness, so the Worker answers with the published run's dates instead (audit C1).
  if (pathname === "/data/freshness.json") return { kind: "freshness" };
  const sealed = sealedPattern.exec(pathname);
  if (sealed) return { kind: "sealed", market: sealed[1] };
  const section = sectionPattern.exec(pathname)?.[1];
  if (!section) return null;
  if (section === "illustration-and-special-rares") return { kind: "sections", sections: ["illustration-rares", "special-illustration-rares"] };
  return singleSections.has(section) ? { kind: "sections", sections: [section] } : null;
}

export async function handleLiveFeed(request: Request, env: StagingJobEnv): Promise<Response | null> {
  const target = liveFeedTarget(new URL(request.url).pathname);
  if (!target || !env.DB) return null;
  try {
    const published = await publishedIngestion(env.DB);
    if (!published) return null;
    if (target.kind === "freshness") {
      return new Response(JSON.stringify({ source: "database", sourceUpdatedAt: published.sourceUpdatedAt, publishedAt: published.lastSuccessAt }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300", "X-Raw-Signal-Source": "database" },
      });
    }
    const rows = target.kind === "sealed" ? await readSealedFeed(env.DB, target.market) : await readSectionFeed(env.DB, target.sections);
    if (!rows.length) return null;
    return new Response(JSON.stringify(rows), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        "X-Raw-Signal-Source": "database",
      },
    });
  } catch (error) {
    // An unmigrated local database (dev server, fresh checkout) is expected — stay quiet.
    const message = error instanceof Error ? error.message : "Unknown failure";
    if (!/no such table/.test(message)) console.error(JSON.stringify({ event: "live_feed_failed", path: new URL(request.url).pathname, message }));
    return null;
  }
}
