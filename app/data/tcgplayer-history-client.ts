import { deriveHistoryMetrics } from "../../core/domain/history-metrics.ts";
import type { PriceHistory } from "../../core/domain/types.ts";
import { mergeHistoryBuckets } from "../history-utils.ts";

type Bucket = { marketPrice: string; bucketStartDate: string; quantitySold?: string; transactionCount?: string; lowSalePrice?: string; highSalePrice?: string; lowSalePriceWithShipping?: string; highSalePriceWithShipping?: string };
type Series = { variant: string; language: string; condition: string; totalQuantitySold?: string; totalTransactionCount?: string; buckets: Bucket[] };
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" };
const cache = new Map<string, { expires: number; request: Promise<Series[]> }>();

async function readSeries(url: string, range: string, fetcher: FetchLike, init: RequestInit) {
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`History ${range} unavailable`);
  return response;
}

async function history(productId: number, range: "quarter" | "annual", fetcher: FetchLike) {
  const key = `${productId}:${range}`, now = Date.now(), hit = cache.get(key);
  if (fetcher === fetch && hit && hit.expires > now) return hit.request;
  const url = `https://infinite-api.tcgplayer.com/price/history/${productId}/detailed?range=${range}`;
  const request = readSeries(url, range, fetcher, { headers })
    .then(async response => (await response.json() as { result?: Series[] }).result ?? [])
    .catch(async () => {
      // Some runtimes (workerd behind the Vite dev proxy) receive an already-decompressed
      // body behind a lingering Content-Encoding header and fail automatic gunzip. Refetch
      // with manual response encoding and decode whichever form the bytes are actually in.
      const retry = await readSeries(url, range, fetcher, { headers, ...({ encodeResponseBody: "manual" } as RequestInit) });
      const raw = new Uint8Array(await retry.arrayBuffer());
      const text = raw[0] === 0x1f && raw[1] === 0x8b
        ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(raw);
      return (JSON.parse(text) as { result?: Series[] }).result ?? [];
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
  const salePrice = (value?: string) => { const price = Number(value); return Number.isFinite(price) && price > 0 ? price : null; };
  const total = (value?: string) => { const count = Number(value); return Number.isFinite(count) ? count : null; };
  const salesBuckets = selected.buckets
    .map(bucket => ({ date: bucket.bucketStartDate, quantity: Math.max(0, Number(bucket.quantitySold) || 0), low: salePrice(bucket.lowSalePrice), high: salePrice(bucket.highSalePrice), lowWithShipping: salePrice(bucket.lowSalePriceWithShipping), highWithShipping: salePrice(bucket.highSalePriceWithShipping) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    points,
    variant: selected.variant,
    condition: selected.condition,
    sales: { windowDays: 90, totalQuantity: total(selected.totalQuantitySold), totalTransactions: total(selected.totalTransactionCount), buckets: salesBuckets },
    coverage: exact ? "exact" : "fallback",
    ...deriveHistoryMetrics(points),
  };
}
