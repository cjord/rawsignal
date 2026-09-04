import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {deriveHistoryMetrics} from "../../../core/domain/history-metrics.ts";
import { fetchTcgplayerHistory } from "../../../core/clients/tcgplayer-history.ts";
import { persistDerivedHistory } from "../../../db/daily-ingestion.ts";
import { readStoredHistory } from "../../../db/history-read.ts";
import { upsertHistory, type D1DatabaseLike } from "../../../db/repository.ts";
import { CACHE_TIERS } from "../cache.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const printing = url.searchParams.get("printing") ?? "";
  const sealed = url.searchParams.get("sealed") === "1";
  if (!/^\d{1,9}$/.test(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  const db=env.DB as unknown as D1DatabaseLike|undefined;
  if(db)try{const stored=await readStoredHistory(db,Number(productId),printing,sealed);if(stored)return NextResponse.json({...stored,...deriveHistoryMetrics(stored.points)},{headers:{"Cache-Control":CACHE_TIERS.hour}})}catch{/* D1 can be awaiting migration or backfill; retain the upstream fallback. */}
  let result;
  try { result = await fetchTcgplayerHistory(Number(productId), printing, sealed); }
  catch { return NextResponse.json({ error: "History unavailable" }, { status: 502 }); }
  if(db&&result.points.length)try{
    const fetchedAt=new Date().toISOString();
    // Sealed series are stored under the one canonical key (todo R3), whatever the fetch reported.
    const variant=sealed?"Sealed":result.variant!,condition=sealed?"Unopened":result.condition!;
    await upsertHistory(db,Number(productId),variant,condition,result.points,fetchedAt);
    const price=await db.prepare("select market_cents as marketCents from current_prices where product_id=?").bind(Number(productId)).first<{marketCents:number|null}>();
    const currentPrice=price?.marketCents==null?result.points.at(-1)!.price:price.marketCents/100;
    await persistDerivedHistory(db,Number(productId),variant,condition,currentPrice,result.points,result.coverage,fetchedAt);
  }catch{/* History remains available to the caller even if cache persistence fails. */}
  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_TIERS.hour },
  });
}
