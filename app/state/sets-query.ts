"use client";
import { useCallback, useEffect, useRef } from "react";

// The sets page's URL scope (market only) through the same push/popstate discipline as
// the metrics codec (decision D14): scope changes create history entries.
export type SetsMarket = "all" | "pokemon" | "riftbound" | "onepiece";
export const SETS_MARKETS: SetsMarket[] = ["all", "pokemon", "riftbound", "onepiece"];

export function parseSetsScope(search: string) {
  return { requestedMarket: new URLSearchParams(search).get("market") };
}

export function serializeSetsScope(market: SetsMarket) {
  const params = new URLSearchParams();
  params.set("market", market);
  return params.toString();
}

export function useSetsScopeUrl(onRestore: (scope: { requestedMarket: string | null }) => void) {
  const restoreRef = useRef(onRestore);
  useEffect(() => { restoreRef.current = onRestore; }, [onRestore]);
  useEffect(() => {
    const restore = () => restoreRef.current(parseSetsScope(location.search));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  return useCallback((market: SetsMarket, { push = true } = {}) => {
    const url = `/sets?${serializeSetsScope(market)}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
}
