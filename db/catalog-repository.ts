import type { Card, MarketSignal, SealedProduct } from "../app/domain/types.ts";
import { createMemoryCatalogRepository, type CatalogRepository } from "../app/data/catalog-repository.ts";
import type { CatalogDerived, SealedCatalogQuery, SinglesCatalogQuery } from "../app/data/catalog-query.ts";
import type { D1DatabaseLike } from "./repository.ts";

type ProductRow = {
  productId: number;
  kind: "single" | "sealed";
  game: "pokemon" | "riftbound" | "onepiece";
  section: string | null;
  name: string;
  setName: string;
  releaseYear: number | null;
  rarity: string | null;
  cardNumber: string | null;
  printing: string | null;
  productType: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  marketCents: number | null;
  listingLowCents: number | null;
  medianCents: number | null;
  listingHighCents: number | null;
  msrpCents: number | null;
  msrpSource: string | null;
};

type MetricRow = {
  productId: number;
  change7Bps: number | null;
  change30Bps: number | null;
  low30Cents: number | null;
  high30Cents: number | null;
  updatedAt: string;
  side: "buy" | "sell" | null;
  score: number | null;
  confidence: "high" | "medium" | "low" | null;
  reason: string | null;
  detail: string | null;
  distanceBps: number | null;
  cutoffBps: number | null;
};

const dollars = (value: number | null) => value == null ? null : value / 100;
const percent = (value: number | null) => value == null ? null : value / 100;

function toCard(row: ProductRow): Card | null {
  if (row.kind !== "single" || row.game === "onepiece" || row.marketCents == null) return null;
  return {
    game: row.game,
    section: row.section ?? "all",
    productId: row.productId,
    name: row.name,
    set: row.setName,
    year: row.releaseYear ?? 0,
    rarity: row.rarity ?? "Unknown",
    number: row.cardNumber ?? "",
    image: row.imageUrl ?? "",
    url: row.sourceUrl ?? "",
    marketPrice: row.marketCents / 100,
    lowPrice: dollars(row.listingLowCents),
    midPrice: dollars(row.medianCents),
    highPrice: dollars(row.listingHighCents),
    printing: row.printing ?? "Normal",
    priceChange: null,
  };
}

function toSealed(row: ProductRow): SealedProduct | null {
  if (row.kind !== "sealed") return null;
  const msrp = dollars(row.msrpCents), marketPrice = dollars(row.marketCents);
  const profit = msrp == null || marketPrice == null ? null : marketPrice - msrp;
  return {
    game: row.game,
    productId: row.productId,
    name: row.name,
    set: row.setName,
    category: row.productType ?? "Other",
    image: row.imageUrl,
    url: row.sourceUrl ?? "",
    msrp,
    marketPrice,
    midPrice: dollars(row.medianCents),
    profit,
    profitPct: profit == null || !msrp ? null : profit / msrp * 100,
    msrpSource: row.msrpSource,
  };
}

function toSignal(row: MetricRow): MarketSignal | null {
  if (!row.side || row.score == null || !row.confidence || !row.reason || !row.detail || row.distanceBps == null || row.cutoffBps == null) return null;
  return {
    side: row.side,
    score: row.score,
    confidence: row.confidence,
    reason: row.reason,
    detail: row.detail,
    distance: row.distanceBps / 100,
    cutoff: row.cutoffBps / 100,
  };
}

const productsSql = `select p.product_id as productId,p.kind,p.game,p.section,p.name,p.set_name as setName,
  p.release_year as releaseYear,p.rarity,p.card_number as cardNumber,p.printing,p.product_type as productType,
  p.image_url as imageUrl,p.source_url as sourceUrl,cp.market_cents as marketCents,
  cp.listing_low_cents as listingLowCents,cp.median_cents as medianCents,cp.listing_high_cents as listingHighCents,
  sd.msrp_cents as msrpCents,sd.msrp_source as msrpSource
  from catalog_products p left join current_prices cp on cp.product_id=p.product_id
  left join sealed_details sd on sd.product_id=p.product_id where p.kind=? and p.game=?`;

async function loadDerived(db: D1DatabaseLike, kind: "single" | "sealed", game: string, options: SinglesCatalogQuery | SealedCatalogQuery) {
  const side = options.signal === "leaderboard" ? "buy" : options.signal;
  const statement = db.prepare(`select mm.product_id as productId,mm.change_7_bps as change7Bps,
    mm.change_30_bps as change30Bps,mm.low_30_cents as low30Cents,mm.high_30_cents as high30Cents,
    mm.updated_at as updatedAt,ms.side,ms.score,ms.confidence,ms.reason,ms.detail,
    ms.distance_bps as distanceBps,ms.cutoff_bps as cutoffBps
    from market_metrics mm join catalog_products p on p.product_id=mm.product_id
    left join market_signals ms on ms.product_id=mm.product_id and ms.side=? and ms.strictness=?
    where p.kind=? and p.game=? order by mm.updated_at desc`).bind(side, options.strictness, kind, game);
  const rows = (await statement.all<MetricRow>()).results ?? [], derived: Record<number, CatalogDerived> = {};
  for (const row of rows) if (!derived[row.productId]) derived[row.productId] = {
    change7: percent(row.change7Bps),
    change30: percent(row.change30Bps),
    low30: dollars(row.low30Cents),
    high30: dollars(row.high30Cents),
    signal: options.signal === "leaderboard" ? null : toSignal(row),
  };
  return derived;
}

export function createD1CatalogRepository(db: D1DatabaseLike): CatalogRepository {
  return {
    async querySingles(options) {
      const rows = (await db.prepare(productsSql).bind("single", options.market).all<ProductRow>()).results ?? [];
      const cards = rows.map(toCard).filter((card): card is Card => card !== null);
      const derived = await loadDerived(db, "single", options.market, options);
      return createMemoryCatalogRepository(cards, []).querySingles(options, derived);
    },
    async querySealed(options) {
      const rows = (await db.prepare(productsSql).bind("sealed", options.market).all<ProductRow>()).results ?? [];
      const products = rows.map(toSealed).filter((product): product is SealedProduct => product !== null);
      const derived = await loadDerived(db, "sealed", options.market, options);
      return createMemoryCatalogRepository([], products).querySealed(options, derived);
    },
  };
}
