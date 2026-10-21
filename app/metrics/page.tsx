import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import MetricsView from "../MetricsView";
import { loadPullRateConfig } from "../data/load-detail";
import { loadMetricsPayload } from "../../db/metrics-service.ts";
import type { D1DatabaseLike } from "../../db/repository";
import {initialMetricsScope} from '../state/metrics-scope';
import {pageSearch,type PageSearch} from '../state/page-search';
import {payloadServerTiming} from '../../db/public-payload-cache';

export const metadata: Metadata = {
  title: "Market Metrics — Raw Signal",
  description: "Tracked market value, equal-weighted card and sealed indexes, Pokémon vs Riftbound trends, set leaderboards, and momentum counts from daily TCGCSV market data.",
};

export default async function MetricsRoute({searchParams}:{searchParams:Promise<PageSearch>}) {
  const scope=initialMetricsScope(pageSearch(await searchParams));
  let payload = null;const timings={stages:{}};
  try { payload = await loadMetricsPayload(env.DB as unknown as D1DatabaseLike | undefined, { pullRates: await loadPullRateConfig(),timings }); }
  catch { /* The view renders its explicit unavailable state. */ }
  return <MetricsView payload={payload} initialScope={scope} serverTiming={payloadServerTiming(timings)}/>;
}
