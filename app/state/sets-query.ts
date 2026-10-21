"use client";
/* eslint-disable react-hooks/set-state-in-effect -- URL scope readiness follows the initial browser restore. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeatmapWindow } from "../../core/domain/set-heatmap.ts";

// The sets page's URL scope through the same push/popstate discipline as
// the metrics codec (decision D14): scope changes create history entries.
export type SetsMarket = "all" | "pokemon" | "riftbound" | "onepiece";
export const SETS_MARKETS: SetsMarket[] = ["all", "pokemon", "riftbound", "onepiece"];
export type SetsScope = {
  market: SetsMarket;
  view: "tiles" | "heatmap";
  window: HeatmapWindow;
  query: string;
  group: string;
  favoritesOnly: boolean;
  sort: "newest" | "change";
  grouping: "flat" | "series";
  tier: string;
  selected: string;
};
export const DEFAULT_SETS_SCOPE: SetsScope = {
  market: "all", view: "tiles", window: 7, query: "", group: "", favoritesOnly: false,
  sort: "newest", grouping: "flat", tier: "all", selected: "",
};

export function parseSetsScope(search: string) {
  const params = new URLSearchParams(search);
  const days = Number(params.get("window"));
  return {
    requestedMarket: params.get("market"),
    view: params.get("view") === "heatmap" ? "heatmap" as const : "tiles" as const,
    window: days === 30 || days === 90 ? days : 7 as HeatmapWindow,
    query: params.get("q") ?? "", group: params.get("group") ?? "",
    favoritesOnly: params.has("favorites"),
    sort: params.get("sort") === "change" ? "change" as const : "newest" as const,
    grouping: params.get("grouping") === "series" ? "series" as const : "flat" as const,
    tier: params.get("tier") ?? "all", selected: params.get("selected") ?? "",
  };
}

export function serializeSetsScope(input: SetsMarket | SetsScope) {
  const scope = typeof input === "string" ? { ...DEFAULT_SETS_SCOPE, market: input } : input;
  const params = new URLSearchParams();
  params.set("market", scope.market);
  if (scope.view !== "tiles") params.set("view", scope.view);
  if (scope.window !== 7) params.set("window", String(scope.window));
  if (scope.query) params.set("q", scope.query);
  if (scope.group) params.set("group", scope.group);
  if (scope.favoritesOnly) params.set("favorites", "1");
  if (scope.sort !== "newest") params.set("sort", scope.sort);
  if (scope.grouping !== "flat") params.set("grouping", scope.grouping);
  if (scope.tier !== "all") params.set("tier", scope.tier);
  if (scope.selected) params.set("selected", scope.selected);
  return params.toString();
}

export function useSetsScopeUrl(onRestore: (scope: ReturnType<typeof parseSetsScope>) => void) {
  const restoreRef = useRef(onRestore),[ready,setReady]=useState(false);
  useEffect(() => { restoreRef.current = onRestore; }, [onRestore]);
  useEffect(() => {
    const restore = () => restoreRef.current(parseSetsScope(location.search));
    restore();setReady(true);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const write=useCallback((scope: SetsScope, { push = true } = {}) => {
    const url = `/sets?${serializeSetsScope(scope)}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
  return {ready,write};
}
