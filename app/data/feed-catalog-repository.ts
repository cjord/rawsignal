import { parseCards, parseCatalogDetailEnrichments, parseSealedProducts } from "../domain/contracts.ts";
import type { Card, CatalogDetailEnrichment, SealedProduct } from "../domain/types.ts";
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

async function loadValue(url:URL,fetcher:FetchLike){const response=await fetcher(new Request(url,{headers:{Accept:"application/json"}}));if(!response.ok)throw new Error(`Catalog source unavailable: ${response.status}`);return response.json()}

export async function createFeedCatalogRepository(origin: string, fetcher: FetchLike = fetch): Promise<CatalogRepository> {
  const base = new URL(origin), cardSections = [...allowedRarities.pokemon, ...allowedRarities.riftbound];
  const [cardGroups, sealedGroups] = await Promise.all([
    Promise.all([...new Set(cardSections)].map(section => loadJson(new URL(`/data/${section}.json`, base), parseCards, fetcher))),
    Promise.all(["pokemon", "riftbound", "onepiece"].map(market => loadJson(new URL(`/data/sealed-${market}.json`, base), parseSealedProducts, fetcher))),
  ]);
  const cards=cardGroups.flat() as Card[],sealed=sealedGroups.flat() as SealedProduct[],baseRepository=createMemoryCatalogRepository(cards,sealed),chunkCache=new Map<string,Promise<CatalogDetailEnrichment[]>>();
  let manifestPromise:Promise<Record<string,string>>|null=null;
  return {...baseRepository,async getDetail(kind,productId,market){
    try{
      manifestPromise??=loadValue(new URL("/data/detail-manifest.json",base),fetcher).then(value=>value as Record<string,string>);
      const path=(await manifestPromise)[`${kind}:${productId}`];
      if(path){let request=chunkCache.get(path);if(!request){request=loadJson(new URL(path,base),parseCatalogDetailEnrichments,fetcher);chunkCache.set(path,request)}const enriched=createMemoryCatalogRepository(cards,sealed,await request);return enriched.getDetail(kind,productId,market)}
    }catch{/* A detail snapshot may lag the compact catalog; retain the summary fallback. */}
    return baseRepository.getDetail(kind,productId,market);
  }};
}
