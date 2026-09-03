import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import SetsView from "../SetsView";
import { loadSetsDirectory } from "../../db/sets-service.ts";
import type { D1DatabaseLike } from "../../db/repository";

// The directory changes once a day (after the metrics rollup); vinext's ISR serves the
// rendered page from the isolate for this long and regenerates in the background
// (stale-while-revalidate), so repeat views and hover prefetches skip D1 (review §14 F7).
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Sets — Raw Signal",
  description: "Every tracked Pokémon, Riftbound, and One Piece set grouped by era, with chase counts, sealed coverage, momentum, and live signal presence.",
};

export default async function SetsRoute() {
  let payload = null;
  try { payload = await loadSetsDirectory(env.DB as unknown as D1DatabaseLike | undefined); }
  catch { /* The view renders its explicit unavailable state. */ }
  return <SetsView payload={payload} />;
}
