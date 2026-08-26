import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {deriveHistoryMetrics} from "../../domain/history-metrics";
import { fetchTcgplayerHistory } from "../../data/tcgplayer-history-client";
import { persistDerivedHistory } from "../../../db/daily-ingestion.ts";
import { upsertHistory, type D1DatabaseLike } from "../../../db/repository.ts";

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
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const printing = url.searchParams.get("printing") ?? "";
  const sealed = url.searchParams.get("sealed") === "1";
  if (!/^\d{1,9}$/.test(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  const db=env.DB as unknown as D1DatabaseLike|undefined;
  if(db)try{const stored=await storedHistory(db,productId,printing,sealed);if(stored)return NextResponse.json({...stored,...deriveHistoryMetrics(stored.points)},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"}})}catch{/* D1 can be awaiting migration or backfill; retain the upstream fallback. */}
  let result;
  try { result = await fetchTcgplayerHistory(Number(productId), printing, sealed); }
  catch { return NextResponse.json({ error: "History unavailable" }, { status: 502 }); }
  if(db&&result.points.length)try{
    const fetchedAt=new Date().toISOString();
    await upsertHistory(db,Number(productId),result.variant!,result.condition!,result.points,fetchedAt);
    const price=await db.prepare("select market_cents as marketCents from current_prices where product_id=?").bind(Number(productId)).first<{marketCents:number|null}>();
    const currentPrice=price?.marketCents==null?result.points.at(-1)!.price:price.marketCents/100;
    await persistDerivedHistory(db,Number(productId),result.variant!,result.condition!,currentPrice,result.points,result.coverage,fetchedAt);
  }catch{/* History remains available to the caller even if cache persistence fails. */}
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
