import type { PricePoint } from "./types.ts";

// The /metrics payload shapes (docs/todo.md H3/H4). Everything is null-honest — a market
// without a backing series reports null changes rather than an estimate. Rows carry game
// and kind so the client composes any scope (mode × market) without another request.
export type MetricsOverviewRow = {
  key: string;
  label: string;
  game: string;
  kind: "single" | "sealed";
  trackedValue: number;
  products: number;
  change7: number | null;
  change30: number | null;
  change90: number | null;
};
export type MetricsSetRow = { set: string; game: string; trackedValue: number; medianPrice: number; cards: number; change30: number | null; sealedChange30: number | null; packPrice: number | null; packEv: number | null; evRatio: number | null };
export type MetricsCategoryRow = { category: string; game: string; trackedValue: number; medianPrice: number; products: number; change7: number | null; change30: number | null; change90: number | null };
export type MetricsEraRow = { era: string; trackedValue: number; cards: number; sets: number; change30: number | null };
export type MetricsMomentumRow = { game: string; kind: "single" | "sealed"; tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHistoricHigh: number; atHistoricLow: number };
export type MetricsMover = { productId: number; name: string; set: string; game: string; kind: "single" | "sealed"; printing: string; image: string | null; price: number; mid: number | null; change: number; window: "7d" | "30d" | "90d"; direction: "up" | "down" };
export type MetricsPayload = {
  generatedAt: string;
  rolledUpAt: string;
  series: Record<string, PricePoint[]>;
  overview: MetricsOverviewRow[];
  sets: MetricsSetRow[];
  sealedCategories: MetricsCategoryRow[];
  eras: MetricsEraRow[];
  momentum: MetricsMomentumRow[];
  movers: MetricsMover[];
};
