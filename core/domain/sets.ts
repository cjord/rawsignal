// Sets-directory shapes shared by the D1 service and the sets view (2026-08-29).
export type SetDirectoryRow = {
  game: string;
  set: string;
  slug: string;
  group: string;
  releaseDate: string | null;
  releaseYear: number | null;
  chase: number;
  sealed: number;
  trackedValue: number;
  change7: number | null;
  change30: number | null;
  buySignals: number;
  sellSignals: number;
  // Cover art for tiles without an official logo (todo I5, 2026-09-04): the set's own
  // highest-market product image — TCGplayer art we already serve, so every set has one.
  cover: string | null;
};

export type SetsDirectoryPayload = { generatedAt: string; sets: SetDirectoryRow[] };

import type { Card, PricePoint, SealedProduct, ValueBreakdown } from "./types.ts";

export type SetDetailPayload = {
  generatedAt: string;
  game: string;
  set: string;
  slug: string;
  group: string;
  releaseDate: string | null;
  releaseYear: number | null;
  chaseCount: number;
  chaseMarket: number;
  sealedCount: number;
  packPrice: number | null;
  packEv: number | null;
  evRatio: number | null;
  singlesChange30: number | null;
  sealedChange30: number | null;
  buySignals: number;
  sellSignals: number;
  cover: string | null;
  // "Where the value sits" (todo J2): per-tier pack value from `set_rarity_stats` and the
  // curated pack odds; null until the live walk has written the set's rows.
  valueBreakdown: ValueBreakdown | null;
  // Raw daily set values (sum of observed members, coverage-floored); the view rebases.
  singlesIndex: PricePoint[];
  sealedIndex: PricePoint[];
  cards: Card[];
  sealed: SealedProduct[];
};
