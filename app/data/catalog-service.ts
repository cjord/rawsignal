import type { SealedProduct, Card } from "../../core/domain/types.ts";
import { parseMarketQuery } from "../state/market-query.ts";
import type { CatalogRepository } from "../../core/catalog-repository.ts";
import type { CatalogPage, SealedCatalogQuery, SinglesCatalogQuery } from "../../core/catalog-query.ts";

export type CatalogRequest =
  | { kind: "single"; options: SinglesCatalogQuery }
  | { kind: "sealed"; options: SealedCatalogQuery };

export type CatalogApiResponse<T> = Pick<CatalogPage<T>, "items" | "total" | "page" | "pages" | "perPage" | "facets"> & {
  source: "database" | "feed";
};

export function catalogRequestFromUrl(url: URL): CatalogRequest {
  const params = new URLSearchParams(url.searchParams), sealed = params.get("mode") === "sealed";
  if (sealed) params.set("mode", "sealed");
  const state = parseMarketQuery(params);
  if (state.mode === "singles") return { kind: "single", options: {
    market: state.market,
    sections: state.rarities,
    query: state.query,
    sets: state.sets,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    up7: state.up7,
    down7: state.down7,
    up30: state.up30,
    down30: state.down30,
    signal: state.signal,
    strictness: state.strictness,
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    perPage: state.perPage,
  } };
  return { kind: "sealed", options: {
    market: state.market,
    productTypes: state.productTypes,
    query: state.query,
    sets: state.sets,
    marketMin: state.marketMin,
    marketMax: state.marketMax,
    msrpMin: state.msrpMin,
    msrpMax: state.msrpMax,
    profitMin: state.profitMin,
    profitMax: state.profitMax,
    profitPctMin: state.profitPctMin,
    profitPctMax: state.profitPctMax,
    profitableOnly: state.profitableOnly,
    basis: state.basis,
    keepPct: state.keepPct,
    taxOn: state.taxOn,
    taxRate: state.taxRate,
    shipping: state.shipping,
    signal: state.signal,
    strictness: state.strictness,
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    perPage: state.perPage,
  } };
}

function apiPage<T>(result: CatalogPage<T>, source: CatalogApiResponse<T>["source"]): CatalogApiResponse<T> {
  return {
    items: result.items,
    total: result.total,
    page: result.page,
    pages: result.pages,
    perPage: result.perPage,
    facets: result.facets,
    source,
  };
}

export async function executeCatalogRequest(request: CatalogRequest, repository: CatalogRepository, source: "database" | "feed"): Promise<CatalogApiResponse<Card | SealedProduct>> {
  const result = request.kind === "single"
    ? await repository.querySingles(request.options)
    : await repository.querySealed(request.options);
  return apiPage(result, source);
}
