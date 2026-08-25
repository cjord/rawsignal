import { NextResponse } from "next/server";
import {mergeHistoryBuckets} from "../../history-utils";
import {deriveHistoryMetrics} from "../../domain/history-metrics";

type Bucket = { marketPrice: string; bucketStartDate: string };
type Series = { variant: string; language: string; condition: string; buckets: Bucket[] };
const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" };
const cache=new Map<string,{expires:number;request:Promise<Series[]>}>();
async function history(productId:string,range:"quarter"|"annual"){
 const key=`${productId}:${range}`,now=Date.now(),hit=cache.get(key);if(hit&&hit.expires>now)return hit.request;
 const request=fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}/detailed?range=${range}`,{headers}).then(async response=>{if(!response.ok)throw new Error(`History ${range} unavailable`);return (await response.json() as {result?:Series[]}).result??[]});
 cache.set(key,{expires:now+15*60_000,request});if(cache.size>500)cache.delete(cache.keys().next().value!);try{return await request}catch(error){cache.delete(key);throw error}
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const printing = url.searchParams.get("printing") ?? "";
  const sealed = url.searchParams.get("sealed") === "1";
  if (!/^\d{1,9}$/.test(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  let quarterly:Series[];
  try{quarterly=await history(productId,"quarter")}catch{return NextResponse.json({ error: "History unavailable" }, { status: 502 })}
  const annual=await history(productId,"annual").catch(()=>[] as Series[]);
  const english = quarterly.filter(row => row.language === "English");
  const candidates = sealed ? english : english.filter(row => row.condition === "Near Mint");
  const exact = candidates.find(row => row.variant.toLowerCase() === printing.toLowerCase());
  const selected = exact ?? (sealed ? candidates.find(row => /sealed|unopened/i.test(row.condition)) : undefined) ?? candidates[0];
  if (!selected) return NextResponse.json({ points: [], coverage: "none" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  const annualMatch=annual.find(row=>row.language==="English"&&row.variant===selected.variant&&row.condition===selected.condition);
  const points=mergeHistoryBuckets(annualMatch?.buckets,selected.buckets);
  return NextResponse.json({ points, variant: selected.variant, condition: selected.condition, coverage: exact ? "exact" : "fallback",...deriveHistoryMetrics(points) }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
