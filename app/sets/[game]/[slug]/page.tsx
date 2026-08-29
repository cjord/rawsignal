import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SetDetailView from "../../../SetDetailView";
import { loadPullRateConfig } from "../../../data/load-detail";
import { loadSetDetail } from "../../../../db/sets-service.ts";
import type { D1DatabaseLike } from "../../../../db/repository";

type Props = { params: Promise<{ game: string; slug: string }> };
const GAMES = new Set(["pokemon", "riftbound", "onepiece"]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
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
