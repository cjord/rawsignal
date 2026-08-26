import { deriveHistoryMetrics } from "../domain/history-metrics.ts";
import type { PriceHistory } from "../domain/types.ts";
import { mergeHistoryBuckets } from "../history-utils.ts";

type Bucket = { marketPrice: string; bucketStartDate: string };
type Series = { variant: string; language: string; condition: string; buckets: Bucket[] };
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" };
const cache = new Map<string, { expires: number; request: Promise<Series[]> }>();

async function history(productId: number, range: "quarter" | "annual", fetcher: FetchLike) {
  const key = `${productId}:${range}`, now = Date.now(), hit = cache.get(key);
  if (fetcher === fetch && hit && hit.expires > now) return hit.request;
  const request = fetcher(`https://infinite-api.tcgplayer.com/price/history/${productId}/detailed?range=${range}`, { headers })
    .then(async response => {
      if (!response.ok) throw new Error(`History ${range} unavailable`);
      return (await response.json() as { result?: Series[] }).result ?? [];
    });
  if (fetcher === fetch) {
    cache.set(key, { expires: now + 15 * 60_000, request });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  try { return await request; }
  catch (error) { if (fetcher === fetch) cache.delete(key); throw error; }
}

export async function fetchTcgplayerHistory(productId: number, printing: string, sealed: boolean, fetcher: FetchLike = fetch): Promise<PriceHistory> {
  const quarterly = await history(productId, "quarter", fetcher);
  const annual = await history(productId, "annual", fetcher).catch(() => [] as Series[]);
  const english = quarterly.filter(row => row.language === "English");
  const candidates = sealed ? english : english.filter(row => row.condition === "Near Mint");
  const exact = candidates.find(row => row.variant.toLowerCase() === printing.toLowerCase());
  const selected = exact ?? (sealed ? candidates.find(row => /sealed|unopened/i.test(row.condition)) : undefined) ?? candidates[0];
  if (!selected) return { points: [], coverage: "none", ...deriveHistoryMetrics([]) };
  const annualMatch = annual.find(row => row.language === "English" && row.variant === selected.variant && row.condition === selected.condition);
  const points = mergeHistoryBuckets(annualMatch?.buckets, selected.buckets);
  return {
    points,
    variant: selected.variant,
    condition: selected.condition,
    coverage: exact ? "exact" : "fallback",
    ...deriveHistoryMetrics(points),
  };
}
