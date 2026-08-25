import type { Card, SealedProduct } from "../domain/types.ts";
import { querySealedCatalog, querySinglesCatalog, type CatalogDerived, type CatalogPage, type SealedCatalogQuery, type SinglesCatalogQuery } from "./catalog-query.ts";

export interface CatalogRepository {
  querySingles(options: SinglesCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<Card>>;
  querySealed(options: SealedCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<SealedProduct>>;
}

export function createMemoryCatalogRepository(cards: Card[], sealedProducts: SealedProduct[]): CatalogRepository {
  const uniqueCards = [...new Map(cards.map(card => [card.productId, card])).values()];
  const uniqueSealed = [...new Map(sealedProducts.map(product => [product.productId, product])).values()];
  return {
    async querySingles(options, derived = {}) {
      return querySinglesCatalog(uniqueCards, options, derived);
    },
    async querySealed(options, derived = {}) {
      return querySealedCatalog(uniqueSealed, options, derived);
    },
  };
}
