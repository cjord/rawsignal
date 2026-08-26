export type SinglesGame = "pokemon" | "riftbound";
export type SealedGame = SinglesGame | "onepiece";
export type SealedProductGame = SealedGame | "yugioh" | "lorcana";
export type SealedMarket = SealedGame | "scalping";
export type CatalogKind = "single" | "sealed";
export type SinglesView = "large" | "medium" | "text" | "full";
export type SealedView = "medium" | "text" | "full";
export type PriceCoverage = "exact" | "fallback" | "none";
export type SignalSide = "leaderboard" | "buy" | "sell";
export type SignalStrictness = "conservative" | "balanced" | "aggressive";
export type SignalConfidence = "high" | "medium" | "low";

export type MarketSignal = {
  side: "buy" | "sell";
  score: number;
  confidence: SignalConfidence;
  reason: string;
  detail: string;
  distance: number;
  cutoff: number;
};

export type PricePoint = {
  date: string;
  price: number;
};

export type PriceHistory = {
  points: PricePoint[];
  variant?: string;
  condition?: string;
  coverage: PriceCoverage;
  change7: number | null;
  change30: number | null;
  change90: number | null;
  low30: number | null;
  high30: number | null;
  historyLow: number | null;
  historyHigh: number | null;
};

export type Card = {
  game: SinglesGame;
  section: string;
  productId: number;
  name: string;
  set: string;
  year: number;
  rarity: string;
  number: string;
  image: string;
  url: string;
  marketPrice: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  printing: string;
  priceChange: number | null;
};

export type SealedProduct = {
  game: SealedProductGame;
  productId: number;
  name: string;
  set: string;
  category: string;
  image: string | null;
  url: string;
  msrp: number | null;
  marketPrice: number | null;
  midPrice: number | null;
  profit: number | null;
  profitPct: number | null;
  msrpSource: string | null;
};

export type HistoryMetric = {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
};
