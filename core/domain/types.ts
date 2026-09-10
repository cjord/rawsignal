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

// Per-row market metrics the D1-backed feeds carry (review §14 follow-up): the same
// 7-/30-day changes (percent), 30-day range (dollars), and regime label the leaderboard
// used to derive from a per-row history request. Absent on the bundled fallback feeds.
export type RowMetrics = {
  change7: number | null;
  change30: number | null;
  low30: number | null;
  high30: number | null;
  regime: string | null;
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
  metrics?: RowMetrics;
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
  metrics?: RowMetrics;
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

// Curated pack odds per game with per-set overrides (todo J2): `default`/`sets` carry packs
// per hit for chase tiers; the optional `perPack` tables carry cards per pack for guaranteed
// slots (Riftbound's 7 commons, 3 uncommons, 2 rares). Keys are a rarity string or a section slug.
// Resolution order: the set's own table, then its era's (Pokémon packs changed size and split
// by era — `core/domain/eras.ts` keys), then the game default.
export type PullRateTables = { default: Record<string, number>; sets: Record<string, Record<string, number>>; eras?: Record<string, Record<string, number>> };
export type PullRateConfig = {
  games: Record<string, PullRateTables & { perPack?: PullRateTables }>;
};

// One set × tier aggregate from `set_rarity_stats` (every card in the TCGCSV group, tracked
// or not); `sumMarket` is over priced cards, `cardCount` over all of them.
export type SetRarityStat = {
  tier: string;
  rarity: string;
  section: string | null;
  cardCount: number;
  pricedCount: number;
  sumMarket: number;
  topMarket: number | null;
  topProductId: number | null;
  updatedAt: string;
};

// "Where the value sits": a set's pack value by tier. `slot` tiers are guaranteed cards per
// pack, `chase` tiers hit odds; `unrated` tiers have no curated odds and sit outside the total.
export type ValueBreakdownTier = {
  key: string;
  label: string;
  kind: "slot" | "chase" | "unrated";
  perPack: number | null;
  packsPerHit: number | null;
  cardCount: number;
  pricedCount: number;
  average: number | null;
  topMarket: number | null;
  topProductId: number | null;
  evPerPack: number | null;
  share: number | null;
  chase: boolean;
};

export type ValueBreakdown = {
  tiers: ValueBreakdownTier[];
  totalEv: number;
  chaseEv: number;
  chaseShare: number | null;
  impliedPackSize: number;
  unratedTiers: string[];
  updatedAt: string | null;
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
  // Legacy server-rendered eBay snapshot. New detail pages load this through the dedicated
  // on-demand endpoint so page caching can never hold listing content past its hard TTL.
  ebay?: EbayListingSnapshot | null;
};

// Early Value Estimate (todo P7): a new product's expected settled price — the
// same-rung cohort anchor from mature same-era sibling sets, blended toward the
// product's own decay-curve projection as launch prices are discovered (ownWeight
// 0 = pure cohort anchor, 1 = fully tracking this product's own trading). Serves
// only while the product is young (launch window / presale); validated in
// docs/backtests.md.
export type EarlyValueEstimate = {
  median: number;
  q25: number;
  q75: number;
  members: number;
  sets: number;
  ownWeight: number;
  observedDays: number;
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
  earlyValue?: EarlyValueEstimate | null;
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
  earlyValue?: EarlyValueEstimate | null;
};

export type CatalogDetail = CardDetail | SealedDetail;

export type HistoryMetric = {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
  // A tile that is an outbound link (the marketplace tile, todo O3) renders as an anchor.
  href?: string;
};

// A stored eBay active-listing snapshot for one product (todo O2): asks, never sales. The
// samples are the cheapest listings that survived the price guard, for the detail panel.
export type EbayListingSample = {
  itemId: string;
  title: string;
  price: number;
  shipping: number | null;
  deliveredPrice: number | null;
  condition: string | null;
  imageUrl: string | null;
  url: string;
  buyingOptions: string[];
  sellerFeedbackPercentage: number | null;
  sellerFeedbackScore: number | null;
  topRated: boolean;
  watchCount: number | null;
  listedAt: string | null;
  endsAt: string | null;
  locationCountry: string | null;
  matchConfidence: "high" | "medium";
};

export type EbayListingSnapshot = {
  query: string;
  categoryId: number | null;
  // eBay's total result count precedes the local parser and price guard. acceptedCount is
  // the number of records in the returned search page that survived both.
  listingCount: number;
  reviewedCount: number;
  acceptedCount: number;
  highConfidenceCount: number;
  lowestAsk: number | null;
  medianAsk: number | null;
  lowestDeliveredAsk: number | null;
  medianDeliveredAsk: number | null;
  deliveredQ1: number | null;
  deliveredQ3: number | null;
  belowMarketCount: number;
  nearMarketCount: number;
  freeShippingCount: number;
  bestOfferCount: number;
  samples: EbayListingSample[];
  fetchedAt: string;
  expiresAt: string;
  updatedAt: string;
};

export type EbayAskHistoryPoint = {
  observedDate: string;
  observedAt: string;
  referenceMarketPrice: number | null;
  listingCount: number;
  reviewedCount: number;
  acceptedCount: number;
  lowestAsk: number | null;
  medianAsk: number | null;
  lowestDeliveredAsk: number | null;
  medianDeliveredAsk: number | null;
  deliveredQ1: number | null;
  deliveredQ3: number | null;
  belowMarketCount: number;
  nearMarketCount: number;
  freeShippingCount: number;
  bestOfferCount: number;
  newListingCount: number | null;
  missingListingCount: number | null;
  priceReductionCount: number | null;
};

export type EbayAskHistory = { points: EbayAskHistoryPoint[] };
