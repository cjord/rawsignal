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
};

export type SetsDirectoryPayload = { generatedAt: string; sets: SetDirectoryRow[] };

import type { Card, PricePoint, SealedProduct } from "./types.ts";

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
  // Raw daily set values (sum of observed members, coverage-floored); the view rebases.
  singlesIndex: PricePoint[];
  sealedIndex: PricePoint[];
  cards: Card[];
  sealed: SealedProduct[];
};
