import type { Card, RowMetrics, CatalogDetailEnrichment, DetailMetadataField, DetailPriceVariant, MarketSignal, PullRateConfig, SealedProduct } from "../core/domain/types.ts";
import { createMemoryCatalogRepository, type CatalogRepository } from "../core/catalog-repository.ts";
import { canonicalSealedType, sealedProductTypes, type CatalogDerived, type CatalogPage, type SealedCatalogQuery, type SinglesCatalogQuery } from "../core/catalog-query.ts";
import { readGradedCard } from "./graded-ingestion.ts";
import { readPeerAnchor } from "./peer-anchors.ts";
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
  regime: string | null;
  updatedAt: string;
  side: "buy" | "sell" | null;
  score: number | null;
  confidence: "high" | "medium" | "low" | null;
  reason: string | null;
  detail: string | null;
  distanceBps: number | null;
  cutoffBps: number | null;
};

type DetailRow={categoryId:number|null;groupId:number|null;setAbbreviation:string|null;publishedOn:string|null;modifiedOn:string|null;imageCount:number|null;isPresale:number|null;presaleNote:string|null;metadataJson:string;priceVariantsJson:string;sourceUpdatedAt:string|null};

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

const productsSqlBase = `select p.product_id as productId,p.kind,p.game,p.section,p.name,p.set_name as setName,
  p.release_year as releaseYear,p.rarity,p.card_number as cardNumber,p.printing,p.product_type as productType,
  p.image_url as imageUrl,p.source_url as sourceUrl,cp.market_cents as marketCents,
  cp.listing_low_cents as listingLowCents,cp.median_cents as medianCents,cp.listing_high_cents as listingHighCents,
  sd.msrp_cents as msrpCents,sd.msrp_source as msrpSource
  from catalog_products p left join current_prices cp on cp.product_id=p.product_id
  left join sealed_details sd on sd.product_id=p.product_id`;
const productsSql = `${productsSqlBase} where p.kind=? and p.game=?`;

async function loadDerived(db: D1DatabaseLike, kind: "single" | "sealed", game: string, options: SinglesCatalogQuery | SealedCatalogQuery) {
  const side = options.signal === "leaderboard" ? "buy" : options.signal;
  const statement = db.prepare(`select mm.product_id as productId,mm.change_7_bps as change7Bps,
    mm.change_30_bps as change30Bps,mm.low_30_cents as low30Cents,mm.high_30_cents as high30Cents,
    mm.regime,mm.updated_at as updatedAt,ms.side,ms.score,ms.confidence,ms.reason,ms.detail,
    ms.distance_bps as distanceBps,ms.cutoff_bps as cutoffBps
    from market_metrics mm join catalog_products p on p.product_id=mm.product_id
    left join market_signals ms on ms.product_id=mm.product_id and ms.side=? and ms.strictness=?
    where p.kind=? and p.game=? order by mm.updated_at desc, mm.variant asc, mm.condition asc`).bind(side, options.strictness, kind, game);
  const rows = (await statement.all<MetricRow>()).results ?? [], derived: Record<number, CatalogDerived> = {};
  for (const row of rows) if (!derived[row.productId]) derived[row.productId] = {
    change7: percent(row.change7Bps),
    change30: percent(row.change30Bps),
    low30: dollars(row.low30Cents),
    high30: dollars(row.high30Cents),
    regime: (row.regime as CatalogDerived["regime"]) ?? null,
    signal: options.signal === "leaderboard" ? null : toSignal(row),
  };
  return derived;
}

// Live feed readers: the leaderboard UI loads /data/<section>.json and /data/sealed-<market>.json
// as plain arrays; these produce the same shapes from current D1 rows (market desc, name asc —
// the sync scripts' ordering) so the Worker can serve fresh data on the bundled feeds' URLs.
// The live feeds carry each row's latest market metrics (review §14 follow-up) so the
// leaderboard renders its 7-/30-day columns, range, and regime chip without a per-row
// history request. One indexed lookup per product; the variant match mirrors loadDerived.
type FeedRow = ProductRow & { change7Bps: number | null; change30Bps: number | null; low30Cents: number | null; high30Cents: number | null; regime: string | null; metricsUpdatedAt: string | null };
const feedSqlBase = `${productsSqlBase}
  left join market_metrics mm on mm.rowid=(select rowid from market_metrics where product_id=p.product_id and (variant=p.printing or p.kind='sealed') order by updated_at desc limit 1)`;
const feedColumns = ", mm.change_7_bps as change7Bps, mm.change_30_bps as change30Bps, mm.low_30_cents as low30Cents, mm.high_30_cents as high30Cents, mm.regime, mm.updated_at as metricsUpdatedAt";
const withFeedSelect = (sql: string) => sql.replace("sd.msrp_cents as msrpCents,sd.msrp_source as msrpSource", `sd.msrp_cents as msrpCents,sd.msrp_source as msrpSource${feedColumns}`);
function rowMetrics(row: FeedRow): RowMetrics | undefined {
  if (row.metricsUpdatedAt == null) return undefined;
  return { change7: percent(row.change7Bps), change30: percent(row.change30Bps), low30: dollars(row.low30Cents), high30: dollars(row.high30Cents), regime: row.regime ?? null };
}
const withMetrics = <T extends Card | SealedProduct>(row: FeedRow, item: T | null): T | null => {
  if (!item) return null;
  const metrics = rowMetrics(row);
  return metrics ? { ...item, metrics } : item;
};

export async function readSectionFeed(db: D1DatabaseLike, sections: string[]): Promise<Card[]> {
  const rows = (await db.prepare(withFeedSelect(`${feedSqlBase} where p.kind='single' and p.section in (${sections.map(() => "?").join(",")}) and cp.market_cents is not null
    order by cp.market_cents desc, p.name asc`)).bind(...sections).all<FeedRow>()).results ?? [];
  return rows.map(row => withMetrics(row, toCard(row))).filter((card): card is Card => card !== null);
}

export async function readSealedFeed(db: D1DatabaseLike, game: string): Promise<SealedProduct[]> {
  const rows = (await db.prepare(withFeedSelect(`${feedSqlBase} where p.kind='sealed' and p.game=?
    order by (case when cp.market_cents is null then -1 else cp.market_cents end) desc, p.name asc`)).bind(game).all<FeedRow>()).results ?? [];
  return rows.map(row => withMetrics(row, toSealed(row))).filter((product): product is SealedProduct => product !== null);
}

// Decision D5: SQL narrows the candidate set, the shared engine stays authoritative.
// The invariant every pushed predicate MUST satisfy: the SQL rows are a SUPERSET of
// what the engine's own filters would keep — the engine re-runs every exact predicate
// (fuzzy text, precise float bounds, scenario math, movement, signal validity) over
// the narrowed rows, so SQL may only ever widen, never tighten. Price bounds are
// therefore pushed one cent wide of the requested dollars, product-type matching is
// case-insensitive with the canonicalSealedType "Other" backstop reproduced, and the
// signal gate is a bare EXISTS (toSignal's field checks re-run in the engine). Facets
// are computed by dedicated DISTINCT queries because the engine derives them from the
// PRE-filter market slice, which the narrowed candidates no longer represent.
// tests/catalog-parity.test.mjs holds the D1 path equal to the pure engine over a
// fixture database across the full option matrix.
// The one-cent widening is sound for any cents value below 2^53 (float exactness);
// real prices sit ~12 orders of magnitude under that, and the driver rejects larger.
const centsFloor = (value: string) => {
  const parsed = value.trim() === "" ? null : Number(value);
  return parsed == null || !Number.isFinite(parsed) ? null : Math.floor(parsed * 100) - 1;
};
const centsCeil = (value: string) => {
  const parsed = value.trim() === "" ? null : Number(value);
  return parsed == null || !Number.isFinite(parsed) ? null : Math.ceil(parsed * 100) + 1;
};
const placeholders = (values: unknown[]) => values.map(() => "?").join(",");
const canonicalTypesLower = sealedProductTypes.map(type => type.toLowerCase());

// Chunked lookups by a list of ids or lower-cased names, staying inside D1's bind limits
// (Collectr import matching sends thousands of values). `column` is an internal SQL
// fragment chosen by the callers below, never caller input.
async function readByValues(db: D1DatabaseLike, kind: "single" | "sealed", column: "p.product_id" | "lower(p.name)", values: Array<number | string>): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (let index = 0; index < values.length; index += 80) {
    const chunk = values.slice(index, index + 80);
    const result = (await db.prepare(`${productsSqlBase} where p.kind=? and ${column} in (${chunk.map(() => "?").join(",")})`)
      .bind(kind, ...chunk).all<ProductRow>()).results ?? [];
    rows.push(...result);
  }
  return rows;
}
const lowerNames = (names: string[]) => [...new Set(names.map(name => name.toLowerCase()).filter(Boolean))];
const cardsFrom = (rows: ProductRow[]) => rows.map(toCard).filter((card): card is Card => card !== null);
const sealedFrom = (rows: ProductRow[]) => rows.map(toSealed).filter((product): product is SealedProduct => product !== null);

// Tracked singles by TCGplayer product id (Collectr import matching).
export async function readCardsByIds(db: D1DatabaseLike, productIds: number[]): Promise<Card[]> {
  return cardsFrom(await readByValues(db, "single", "p.product_id", productIds));
}

// Sealed products by TCGplayer id (Collectr import sealed matching).
export async function readSealedByIds(db: D1DatabaseLike, productIds: number[]): Promise<SealedProduct[]> {
  return sealedFrom(await readByValues(db, "sealed", "p.product_id", productIds));
}

// Case-insensitive name lookup for sealed (CSV imports lacking ids).
export async function readSealedByNames(db: D1DatabaseLike, names: string[]): Promise<SealedProduct[]> {
  return sealedFrom(await readByValues(db, "sealed", "lower(p.name)", lowerNames(names)));
}

// Audit log of Collectr-import fallback matches (name/normalized/fuzzy) for later manual
// review. Upserts, bumping seen_count on repeats. Best-effort — callers wrap in try/catch
// so a missing table or write failure never breaks an import.
export type ImportMatchLogEntry = {
  collectrProductId: number; matchedProductId: number; kind: "single" | "sealed";
  matchTier: "name" | "normalized" | "fuzzy"; score: number | null;
  collectrName: string; collectrSet: string; matchedName: string;
};
export async function logImportMatches(db: D1DatabaseLike, entries: ImportMatchLogEntry[], now: string): Promise<void> {
  if (!entries.length) return;
  const statement = db.prepare(`insert into import_match_log (collectr_product_id,matched_product_id,kind,match_tier,score,collectr_name,collectr_set,matched_name,seen_count,first_seen,last_seen)
    values (?,?,?,?,?,?,?,?,1,?,?)
    on conflict(collectr_product_id,matched_product_id) do update set
      seen_count=seen_count+1, last_seen=excluded.last_seen, match_tier=excluded.match_tier,
      score=excluded.score, collectr_name=excluded.collectr_name, matched_name=excluded.matched_name`);
  await db.batch(entries.map(entry => statement.bind(
    entry.collectrProductId, entry.matchedProductId, entry.kind, entry.matchTier,
    entry.score == null ? null : Math.round(entry.score * 1000), entry.collectrName, entry.collectrSet, entry.matchedName, now, now,
  )));
}

// Candidate pool for the Collectr fuzzy-match tier: products whose name starts with any of
// the given (already-lowercased) prefixes. Bounded — prefixes capped, each query LIMITed —
// so the caller can normalize/fuzzy-compare in JS without scanning the whole catalog.
async function catalogByNamePrefix(db: D1DatabaseLike, kind: "single" | "sealed", prefixes: string[]): Promise<ProductRow[]> {
  const unique = [...new Set(prefixes.map(prefix => prefix.toLowerCase()).filter(prefix => prefix.length >= 3))].slice(0, 60);
  const rows: ProductRow[] = [];
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const clause = chunk.map(() => "lower(p.name) like ?").join(" or ");
    const result = (await db.prepare(`${productsSqlBase} where p.kind=? and (${clause}) limit 400`)
      .bind(kind, ...chunk.map(prefix => `${prefix}%`)).all<ProductRow>()).results ?? [];
    rows.push(...result);
  }
  return rows;
}
export async function readSinglesByNamePrefix(db: D1DatabaseLike, prefixes: string[]): Promise<Card[]> {
  return cardsFrom(await catalogByNamePrefix(db, "single", prefixes));
}
export async function readSealedByNamePrefix(db: D1DatabaseLike, prefixes: string[]): Promise<SealedProduct[]> {
  return sealedFrom(await catalogByNamePrefix(db, "sealed", prefixes));
}

// Case-insensitive name lookup (Collectr CSV imports lacking TCGplayer ids); callers
// disambiguate same-name candidates by number/set.
export async function readCardsByNames(db: D1DatabaseLike, names: string[]): Promise<Card[]> {
  return cardsFrom(await readByValues(db, "single", "lower(p.name)", lowerNames(names)));
}

// One set's products of both kinds in domain shapes (sets view detail page).
export async function readGameSetProducts(db: D1DatabaseLike, game: string, setName: string): Promise<{ cards: Card[]; sealed: SealedProduct[] }> {
  const rows = (await db.prepare(`${productsSqlBase} where p.game=? and p.set_name=? order by p.product_id`).bind(game, setName).all<ProductRow>()).results ?? [];
  return {
    cards: rows.map(toCard).filter((card): card is Card => card !== null),
    sealed: rows.map(toSealed).filter((product): product is SealedProduct => product !== null),
  };
}

// Whole-game row loads are the single largest D1 read in production (review §14 F1: ~43k
// rows per call, twice per detail view). The catalog only changes when a run publishes, so
// each isolate keeps the rows per (run, kind, game) for a few minutes; a new published run
// id is a new key, and the TTL bounds staleness if the same run is re-read for long.
const GAME_ROWS_TTL_MS = 10 * 60_000;
const GAME_ROWS_MAX_ENTRIES = 12;
const gameRowsCache = new Map<string, { at: number; rows: Promise<ProductRow[]> }>();
function cachedGameRows(key: string, load: () => Promise<ProductRow[]>): Promise<ProductRow[]> {
  const now = Date.now(), hit = gameRowsCache.get(key);
  if (hit && now - hit.at < GAME_ROWS_TTL_MS) return hit.rows;
  const rows = load().catch(error => { gameRowsCache.delete(key); throw error; });
  gameRowsCache.set(key, { at: now, rows });
  if (gameRowsCache.size > GAME_ROWS_MAX_ENTRIES) gameRowsCache.delete(gameRowsCache.keys().next().value!);
  return rows;
}

export function createD1CatalogRepository(db: D1DatabaseLike, ingestionRunId?: string, pullRateConfig?: PullRateConfig): CatalogRepository {
  const runClause = ingestionRunId ? " and p.ingestion_run_id=?" : "";
  const runParams = ingestionRunId ? [ingestionRunId] : [];
  const productRows = (kind: "single" | "sealed", game: string) => cachedGameRows(`${ingestionRunId ?? "unpublished"}|${kind}|${game}`, async () => {
    const sql = ingestionRunId ? `${productsSql} and p.ingestion_run_id=?` : productsSql;
    const statement = db.prepare(sql).bind(...(ingestionRunId ? [kind, game, ingestionRunId] : [kind, game]));
    return (await statement.all<ProductRow>()).results ?? [];
  });
  // Rows for one game+set (index seek): the detail page's set-scoped peers.
  const setRows = async (game: string, setName: string) => {
    const statement = db.prepare(`${productsSqlBase} where p.game=? and p.set_name=?${runClause} order by p.product_id`).bind(game, setName, ...runParams);
    return (await statement.all<ProductRow>()).results ?? [];
  };
  const signalClause = (options: SinglesCatalogQuery | SealedCatalogQuery, params: unknown[]) => {
    if (options.signal === "leaderboard") return "";
    params.push(options.signal, options.strictness);
    return " and exists(select 1 from market_signals ms where ms.product_id=p.product_id and ms.side=? and ms.strictness=?)";
  };
  const singlesFacets = async (options: SinglesCatalogQuery): Promise<CatalogPage<Card>["facets"]> => {
    const params: unknown[] = [options.market, ...runParams];
    let where = `p.kind='single' and p.game=?${runClause} and cp.market_cents is not null`;
    if (options.sections.length) { where += ` and coalesce(p.section,'all') in (${placeholders(options.sections)})`; params.push(...options.sections); }
    const rows = (await db.prepare(`select distinct p.set_name as setName, coalesce(p.section,'all') as section
      from catalog_products p join current_prices cp on cp.product_id=p.product_id where ${where}`).bind(...params).all<{ setName: string; section: string }>()).results ?? [];
    return { sets: [...new Set(rows.map(row => row.setName))].sort(), sections: [...new Set(rows.map(row => row.section))].sort(), productTypes: [] };
  };
  const singlesCandidates = async (options: SinglesCatalogQuery) => {
    const params: unknown[] = [options.market, ...runParams];
    let where = ` and cp.market_cents is not null`;
    if (options.sections.length) { where += ` and coalesce(p.section,'all') in (${placeholders(options.sections)})`; params.push(...options.sections); }
    if (options.sets.length) { where += ` and p.set_name in (${placeholders(options.sets)})`; params.push(...options.sets); }
    const min = centsFloor(options.minPrice), max = centsCeil(options.maxPrice);
    if (min != null) { where += ` and cp.market_cents >= ?`; params.push(min); }
    if (max != null) { where += ` and cp.market_cents <= ?`; params.push(max); }
    where += signalClause(options, params);
    const sql = `${productsSqlBase} where p.kind='single' and p.game=?${runClause}${where} order by p.product_id`;
    return (await db.prepare(sql).bind(...params).all<ProductRow>()).results ?? [];
  };
  const sealedFacets = async (options: SealedCatalogQuery): Promise<CatalogPage<SealedProduct>["facets"]> => {
    const rows = (await db.prepare(`select distinct p.set_name as setName, p.product_type as productType
      from catalog_products p where p.kind='sealed' and p.game=?${runClause}`).bind(options.market, ...runParams).all<{ setName: string; productType: string | null }>()).results ?? [];
    const types = [...new Set(rows.map(row => canonicalSealedType(row.productType ?? "Other")))];
    types.sort((a, b) => (sealedProductTypes as readonly string[]).indexOf(a) - (sealedProductTypes as readonly string[]).indexOf(b));
    return { sets: [...new Set(rows.map(row => row.setName))].sort(), sections: [], productTypes: types };
  };
  const sealedCandidates = async (options: SealedCatalogQuery) => {
    const params: unknown[] = [options.market, ...runParams];
    let where = "";
    if (options.sets.length) { where += ` and p.set_name in (${placeholders(options.sets)})`; params.push(...options.sets); }
    if (options.productTypes.length) {
      // Superset of canonicalSealedType: case-insensitive canonical match, plus every
      // off-vocabulary or null type. The second clause is UNCONDITIONAL because SQLite's
      // NOCASE folds only ASCII — a category whose case variance involves a non-ASCII
      // fold (JS toLowerCase folds U+212A to "k") is off-vocabulary to SQL but canonical
      // to the engine, so it must survive to the engine's re-filter. Pure widening.
      let clause = `coalesce(p.product_type,'Other') collate nocase in (${placeholders(options.productTypes)})`;
      params.push(...options.productTypes);
      clause += ` or lower(coalesce(p.product_type,'Other')) not in (${placeholders(canonicalTypesLower)})`;
      params.push(...canonicalTypesLower);
      where += ` and (${clause})`;
    }
    const valueExpr = options.basis === "median" ? "coalesce(cp.median_cents,cp.market_cents)" : "cp.market_cents";
    const marketMin = centsFloor(options.marketMin), marketMax = centsCeil(options.marketMax);
    if (marketMin != null) { where += ` and ${valueExpr} >= ?`; params.push(marketMin); }
    if (marketMax != null) { where += ` and ${valueExpr} <= ?`; params.push(marketMax); }
    const msrpMin = centsFloor(options.msrpMin), msrpMax = centsCeil(options.msrpMax);
    if (msrpMin != null) { where += ` and sd.msrp_cents >= ?`; params.push(msrpMin); }
    if (msrpMax != null) { where += ` and sd.msrp_cents <= ?`; params.push(msrpMax); }
    // Any profit-shaped filter needs a non-null profit, which needs both MSRP and a value.
    const profitFiltered = options.profitableOnly || [options.profitMin, options.profitMax, options.profitPctMin, options.profitPctMax].some(bound => bound.trim() !== "" && Number.isFinite(Number(bound)));
    if (profitFiltered) where += ` and sd.msrp_cents is not null and ${valueExpr} is not null`;
    where += signalClause(options, params);
    const sql = `${productsSqlBase} where p.kind='sealed' and p.game=?${runClause}${where} order by p.product_id`;
    return (await db.prepare(sql).bind(...params).all<ProductRow>()).results ?? [];
  };
  return {
    async querySingles(options) {
      const [facets, rows] = await Promise.all([singlesFacets(options), singlesCandidates(options)]);
      const cards = rows.map(toCard).filter((card): card is Card => card !== null);
      const derived = await loadDerived(db, "single", options.market, options);
      const page = await createMemoryCatalogRepository(cards, []).querySingles(options, derived);
      return { ...page, facets };
    },
    async querySealed(options) {
      const [facets, rows] = await Promise.all([sealedFacets(options), sealedCandidates(options)]);
      const products = rows.map(toSealed).filter((product): product is SealedProduct => product !== null);
      const derived = await loadDerived(db, "sealed", options.market, options);
      const page = await createMemoryCatalogRepository([], products).querySealed(options, derived);
      return { ...page, facets };
    },
    async getDetail(kind,productId,market){
      const row=await db.prepare(`select p.product_id as productId,p.kind,p.game,p.section,p.name,p.set_name as setName,
        p.release_year as releaseYear,p.rarity,p.card_number as cardNumber,p.printing,p.product_type as productType,
        p.image_url as imageUrl,p.source_url as sourceUrl,cp.market_cents as marketCents,
        cp.listing_low_cents as listingLowCents,cp.median_cents as medianCents,cp.listing_high_cents as listingHighCents,
        sd.msrp_cents as msrpCents,sd.msrp_source as msrpSource from catalog_products p
        left join current_prices cp on cp.product_id=p.product_id left join sealed_details sd on sd.product_id=p.product_id
        where p.kind=? and p.product_id=?`).bind(kind,productId).first<ProductRow>();
      if(!row)return null;
      // Detail pages need peers of BOTH kinds, but only the product's OWN kind needs the whole
      // game (similar items by name, game-wide rarity/category averages); the other kind is
      // only ever read within the product's set (related sealed, chase cards, pack price,
      // unit lookup), so it comes from one index seek (review §14 F1).
      const [ownKindRows,setKindRows]=await Promise.all([productRows(kind,row.game),setRows(row.game,row.setName)]);
      const peerRows=kind==="single"?[...ownKindRows,...setKindRows.filter(item=>item.kind==="sealed")]:[...setKindRows.filter(item=>item.kind==="single"),...ownKindRows];
      const cards=peerRows.map(toCard).filter((item):item is Card=>item!==null),sealed=peerRows.map(toSealed).filter((item):item is SealedProduct=>item!==null),detailRow=await db.prepare(`select category_id as categoryId,group_id as groupId,set_abbreviation as setAbbreviation,published_on as publishedOn,modified_on as modifiedOn,image_count as imageCount,is_presale as isPresale,presale_note as presaleNote,metadata_json as metadataJson,price_variants_json as priceVariantsJson,source_updated_at as sourceUpdatedAt from product_details where product_id=?`).bind(productId).first<DetailRow>();
      let enrichments:CatalogDetailEnrichment[]=[];if(detailRow)try{enrichments=[{kind,productId,metadata:JSON.parse(detailRow.metadataJson) as DetailMetadataField[],priceVariants:JSON.parse(detailRow.priceVariantsJson) as DetailPriceVariant[],source:{categoryId:detailRow.categoryId,groupId:detailRow.groupId,setAbbreviation:detailRow.setAbbreviation,publishedOn:detailRow.publishedOn,modifiedOn:detailRow.modifiedOn,imageCount:detailRow.imageCount,isPresale:detailRow.isPresale==null?null:Boolean(detailRow.isPresale),presaleNote:detailRow.presaleNote,sourceUpdatedAt:detailRow.sourceUpdatedAt}}]}catch{/* Invalid optional detail JSON must not hide the core catalog record. */}
      const graded=kind==="single"?await readGradedCard(db,productId):null;
      const peerAnchor=kind==="single"?await readPeerAnchor(db,row.game,row.setName,row.rarity):null;
      const anchorKey=`${row.game}|${row.setName}|${row.rarity}`;
      return createMemoryCatalogRepository(cards,sealed,enrichments,pullRateConfig,graded?{[String(productId)]:graded}:undefined,peerAnchor?{[anchorKey]:peerAnchor}:undefined).getDetail(kind,productId,market);
    },
  };
}
