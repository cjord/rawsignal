"use client";
import { useCallback, useEffect, useRef } from "react";

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

export function useMetricsScopeUrl(onRestore: (scope: { mode: MetricsMode; requestedMarket: string | null }) => void) {
  const restoreRef = useRef(onRestore);
  useEffect(() => { restoreRef.current = onRestore; }, [onRestore]);
  useEffect(() => {
    const restore = () => restoreRef.current(parseMetricsScope(location.search));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  return useCallback((mode: MetricsMode, market: MetricsMarket, { push = true } = {}) => {
    const url = `/metrics?${serializeMetricsScope(mode, market)}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
}
