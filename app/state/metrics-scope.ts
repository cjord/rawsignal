
// The metrics page's URL scope (mode + market) through the same push/popstate
// discipline as the leaderboard codec (decision D14): scope changes create history
// entries, so Back walks through scopes instead of leaving the page.
export type MetricsMode = "singles" | "sealed";
export type MetricsMarket = "all" | "pokemon" | "riftbound" | "onepiece";
export const METRICS_MARKETS: Record<MetricsMode, MetricsMarket[]> = {
  singles: ["all", "pokemon", "riftbound"],
  sealed: ["all", "pokemon", "riftbound", "onepiece"],
};

export function parseMetricsScope(search: string) {
  const params = new URLSearchParams(search);
  const mode: MetricsMode = params.get("mode") === "sealed" ? "sealed" : "singles";
  return { mode, requestedMarket: params.get("market") };
}

export function serializeMetricsScope(mode: MetricsMode, market: MetricsMarket) {
  const params = new URLSearchParams();
  if (mode !== "singles") params.set("mode", mode);
  params.set("market", market);
  return params.toString();
}

export type MetricsScope={mode:MetricsMode;market:MetricsMarket};
export function initialMetricsScope(search:string):MetricsScope|null {
 const {mode,requestedMarket}=parseMetricsScope(search);
 return METRICS_MARKETS[mode].includes(requestedMarket as MetricsMarket)?{mode,market:requestedMarket as MetricsMarket}:null;
}
