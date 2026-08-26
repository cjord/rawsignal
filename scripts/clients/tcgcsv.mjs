import { fetchJson } from "./http-json.mjs";

const BASE = "https://tcgcsv.com/tcgplayer";
const defaultHeaders = { "User-Agent": "RawSignal/7.0 (+validated daily market ingestion)" };

export function createTcgcsvClient(options = {}) {
  const requestOptions = { headers: defaultHeaders, throttleMs: 75, ...options };
  const results = async url => {
    const value = await fetchJson(url, requestOptions);
    const rows = value?.results ?? value;
    if (!Array.isArray(rows)) throw new TypeError(`Invalid TCGCSV collection from ${url}`);
    return rows;
  };
  return {
    categories: () => results(`${BASE}/categories`),
    groups: categoryId => results(`${BASE}/${categoryId}/groups`),
    products: (categoryId, groupId) => results(`${BASE}/${categoryId}/${groupId}/products`),
    prices: (categoryId, groupId) => results(`${BASE}/${categoryId}/${groupId}/prices`),
  };
}
