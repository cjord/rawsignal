import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import SetsView from "../SetsView";
import { loadSetsDirectory } from "../../db/sets-service.ts";
import type { D1DatabaseLike } from "../../db/repository";

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
