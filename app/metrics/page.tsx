import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import MetricsView from "../MetricsView";
import { loadPullRateConfig } from "../data/load-detail";
import { loadMetricsPayload } from "../data/metrics-service";
import type { D1DatabaseLike } from "../../db/repository";

export const metadata: Metadata = {
  title: "Market Metrics — Raw Signal",
  description: "Tracked market value, equal-weighted card and sealed indexes, Pokémon vs Riftbound trends, set leaderboards, and momentum counts from daily TCGCSV market data.",
};

export default async function MetricsRoute() {
  let payload = null;
  try { payload = await loadMetricsPayload(env.DB as unknown as D1DatabaseLike | undefined, { pullRates: await loadPullRateConfig() }); }
  catch { /* The view renders its explicit unavailable state. */ }
  return <MetricsView payload={payload} />;
}
