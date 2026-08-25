import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {mergeHistoryBuckets} from "../../history-utils";
import {deriveHistoryMetrics} from "../../domain/history-metrics";
import { persistDerivedHistory } from "../../../db/daily-ingestion.ts";
import { upsertHistory, type D1DatabaseLike } from "../../../db/repository.ts";

type Bucket = { marketPrice: string; bucketStartDate: string };
type Series = { variant: string; language: string; condition: string; buckets: Bucket[] };
const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" };
const cache=new Map<string,{expires:number;request:Promise<Series[]>}>();
type StoredRow={variant:string;condition:string;observedDate:string;marketCents:number};

async function storedHistory(db:D1DatabaseLike,productId:string,printing:string,sealed:boolean){
 const rows=(await db.prepare(`select variant,condition,observed_date as observedDate,market_cents as marketCents
   from price_observations where product_id=? and source='tcgplayer' order by observed_date`).bind(Number(productId)).all<StoredRow>()).results??[];
 const grouped=new Map<string,{variant:string;condition:string;points:{date:string;price:number}[]}>();
 for(const row of rows){const key=`${row.variant}\u0000${row.condition}`,entry=grouped.get(key)??{variant:row.variant,condition:row.condition,points:[]};entry.points.push({date:row.observedDate,price:row.marketCents/100});grouped.set(key,entry)}
 const candidates=[...grouped.values()].filter(row=>sealed||row.condition==="Near Mint");
 const selected=candidates.find(row=>row.variant.toLowerCase()===printing.toLowerCase())??(sealed?candidates.find(row=>/sealed|unopened/i.test(row.condition)):undefined)??candidates[0];
 return selected?{...selected,coverage:selected.variant.toLowerCase()===printing.toLowerCase()?"exact" as const:"fallback" as const}:null;
}
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
  const db=env.DB as unknown as D1DatabaseLike|undefined;
  if(db)try{const stored=await storedHistory(db,productId,printing,sealed);if(stored)return NextResponse.json({...stored,...deriveHistoryMetrics(stored.points)},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"}})}catch{/* D1 can be awaiting migration or backfill; retain the upstream fallback. */}
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
  if(db&&points.length)try{
    const fetchedAt=new Date().toISOString();
    await upsertHistory(db,Number(productId),selected.variant,selected.condition,points,fetchedAt);
    const price=await db.prepare("select market_cents as marketCents from current_prices where product_id=?").bind(Number(productId)).first<{marketCents:number|null}>();
    const currentPrice=price?.marketCents==null?points.at(-1)!.price:price.marketCents/100;
    await persistDerivedHistory(db,Number(productId),selected.variant,selected.condition,currentPrice,points,exact?"exact":"fallback",fetchedAt);
  }catch{/* History remains available to the caller even if cache persistence fails. */}
  return NextResponse.json({ points, variant: selected.variant, condition: selected.condition, coverage: exact ? "exact" : "fallback",...deriveHistoryMetrics(points) }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
