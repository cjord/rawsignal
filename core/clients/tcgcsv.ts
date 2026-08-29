import { fetchJson, type FetchJsonOptions } from "./http-json.ts";

const BASE = "https://tcgcsv.com/tcgplayer";
const defaultHeaders = { "User-Agent": "RawSignal/7.0 (+validated daily market ingestion)" };

export type TcgcsvRow = Record<string, unknown>;

export function createTcgcsvClient(options: FetchJsonOptions = {}) {
  const requestOptions = { headers: defaultHeaders, throttleMs: 75, ...options };
  const results = async (url: string): Promise<TcgcsvRow[]> => {
    const value = await fetchJson(url, requestOptions) as { results?: unknown } | unknown[];
    const rows = Array.isArray(value) ? value : value?.results;
    if (!Array.isArray(rows)) throw new TypeError(`Invalid TCGCSV collection from ${url}`);
    return rows as TcgcsvRow[];
  };
  return {
    categories: () => results(`${BASE}/categories`),
    groups: (categoryId: number) => results(`${BASE}/${categoryId}/groups`),
    products: (categoryId: number, groupId: number) => results(`${BASE}/${categoryId}/${groupId}/products`),
    prices: (categoryId: number, groupId: number) => results(`${BASE}/${categoryId}/${groupId}/prices`),
  };
}
