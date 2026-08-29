export type SinglesGame = "pokemon" | "riftbound";
export type SealedGame = SinglesGame | "onepiece";
export type SealedProductGame = SealedGame | "yugioh" | "lorcana" | "football";
export type SealedMarket = SealedGame | "scalping" | "all";
// Market scope for the singles views: a product game or the cross-game "all" scope.
export type SinglesMarket = SinglesGame | "all";
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

export type SalesBucket = {
  date: string;
  quantity: number;
  low: number | null;
  high: number | null;
  lowWithShipping: number | null;
  highWithShipping: number | null;
};

export type SalesActivity = {
  windowDays: number;
  totalQuantity: number | null;
  totalTransactions: number | null;
  buckets: SalesBucket[];
};

export type PriceHistory = {
  points: PricePoint[];
  variant?: string;
  condition?: string;
  sales?: SalesActivity;
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

export type DetailMetadataField = {
  name: string;
  label: string;
  value: string;
};

export type DetailPriceVariant = {
  printing: string;
  marketPrice: number | null;
  lowPrice: number | null;
  directLowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
};

export type SimilarCatalogItem = {
  kind: CatalogKind;
  productId: number;
  name: string;
  set: string;
  image: string | null;
  marketPrice: number | null;
  href: string;
};

export type DetailSource = {
  categoryId: number | null;
  groupId: number | null;
  setAbbreviation: string | null;
  publishedOn: string | null;
  modifiedOn: string | null;
  imageCount: number | null;
  isPresale: boolean | null;
  presaleNote: string | null;
  sourceUpdatedAt: string | null;
};

export type CatalogDetailEnrichment = {
  kind: CatalogKind;
  productId: number;
  metadata: DetailMetadataField[];
  priceVariants: DetailPriceVariant[];
  source: DetailSource;
};

export type DetailPeerQuartiles = { min: number; q1: number; median: number; q3: number; max: number };

export type DetailPeerContext = {
  label: string;
  averagePrice: number | null;
  count: number;
  // 1-based market-price rank of this product within the cohort including itself (H2).
  position: number | null;
  cohortSize: number;
  quartiles: DetailPeerQuartiles | null;
};

export type GradedGradeStat = {
  count: number;
  average: number | null;
  median: number | null;
  smartPrice: number | null;
  confidence: string | null;
  trend: "up" | "down" | null;
  lastSaleDate: string | null;
};

export type GradedCardData = {
  updatedAt: string;
  grades: Record<string, GradedGradeStat>;
};

export type PullRateConfig = {
  games: Record<string, { default: Record<string, number>; sets: Record<string, Record<string, number>> }>;
};

export type CardPullRate = {
  packsPerHit: number;
  packsPerCard: number;
  packPrice: number | null;
  costPerCard: number | null;
};

export type RarityPullRate = {
  rarity: string;
  cardCount: number;
  packsPerHit: number;
  costPerHit: number | null;
  averageMarket: number | null;
};

export type PeerAnchorStats = {
  current: number;
  cardCount: number;
  avg30: number | null;
  avg90: number | null;
  observations: number;
};

export type CatalogDetailBase = {
  kind: CatalogKind;
  productId: number;
  name: string;
  game: SealedProductGame;
  set: string;
  image: string | null;
  url: string;
  exactTcgplayerUrl: boolean;
  metadata: DetailMetadataField[];
  priceVariants: DetailPriceVariant[];
  source: DetailSource;
  similar: SimilarCatalogItem[];
  marketRank: number | null;
  marketRankTotal: number | null;
  peerContext: DetailPeerContext | null;
  graded: GradedCardData | null;
};

export type CardDetail = CatalogDetailBase & {
  kind: "single";
  game: SinglesGame;
  section: string;
  year: number;
  rarity: string;
  number: string;
  printing: string;
  marketPrice: number;
  setPeerContext: DetailPeerContext | null;
  pullRate: CardPullRate | null;
  peerAnchor: PeerAnchorStats | null;
  relatedSealed: SealedProduct[];
};

export type SealedDetail = CatalogDetailBase & {
  kind: "sealed";
  category: string;
  msrp: number | null;
  msrpSource: string | null;
  marketPrice: number | null;
  midPrice: number | null;
  packPrice: number | null;
  chaseCards: Card[];
  relatedSealed: SealedProduct[];
  pullRates: RarityPullRate[];
  caseUnit: { productId: number; name: string; marketPrice: number; multiple: number } | null;
};

export type CatalogDetail = CardDetail | SealedDetail;

export type HistoryMetric = {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
};
