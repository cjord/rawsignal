import { parseCards, parseSealedProducts } from "../domain/contracts.ts";
import type { Card, SealedProduct } from "../domain/types.ts";
import { allowedRarities } from "../state/market-query.ts";
import { createMemoryCatalogRepository, type CatalogRepository } from "./catalog-repository.ts";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function loadJson<T>(url: URL, parse: (value: unknown) => T[], fetcher: FetchLike) {
  // Cloudflare's static-assets binding expects a Request. Passing a URL plus a
  // browser-only cache mode works with global fetch but fails on ASSETS.fetch.
  const response = await fetcher(new Request(url, { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Catalog source unavailable: ${response.status}`);
  return parse(await response.json());
}

export async function createFeedCatalogRepository(origin: string, fetcher: FetchLike = fetch): Promise<CatalogRepository> {
  const base = new URL(origin), cardSections = [...allowedRarities.pokemon, ...allowedRarities.riftbound];
  const [cardGroups, sealedGroups] = await Promise.all([
    Promise.all([...new Set(cardSections)].map(section => loadJson(new URL(`/data/${section}.json`, base), parseCards, fetcher))),
    Promise.all(["pokemon", "riftbound", "onepiece"].map(market => loadJson(new URL(`/data/sealed-${market}.json`, base), parseSealedProducts, fetcher))),
  ]);
  return createMemoryCatalogRepository(cardGroups.flat() as Card[], sealedGroups.flat() as SealedProduct[]);
}
