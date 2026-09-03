import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SetDetailView from "../../../SetDetailView";
import { loadPullRateConfig } from "../../../data/load-detail";
import { loadSetDetail } from "../../../../db/sets-service.ts";
import type { D1DatabaseLike } from "../../../../db/repository";

type Props = { params: Promise<{ game: string; slug: string }> };
const GAMES = new Set(["pokemon", "riftbound", "onepiece"]);

// The set detail changes once a day (after the metrics rollup); vinext's ISR serves the
// rendered page from the isolate for this long and regenerates in the background
// (stale-while-revalidate), so repeat views and hover prefetches skip D1 (review §14 F7).
export const revalidate = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Set-code tokens read as codes ("SV08"), everything else title-cased.
  const title = slug.split("-").map(word => /^(?:sv|swsh|sm|me|hs|ex|bw|xy|dp|pop)\d*$/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return { title: `${title} Set — Raw Signal` };
}

export default async function SetDetailRoute({ params }: Props) {
  const { game, slug } = await params;
  if (!GAMES.has(game)) notFound();
  let payload = null;
  try { payload = await loadSetDetail(env.DB as unknown as D1DatabaseLike | undefined, game, slug, await loadPullRateConfig()); }
  catch { /* Unresolvable set or feed-only deployment: the 404 below covers both. */ }
  if (!payload) notFound();
  return <SetDetailView payload={payload} />;
}
