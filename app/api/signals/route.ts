import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readySignalHistory } from "../../../db/readiness.ts";
import type { D1DatabaseLike } from "../../../db/repository.ts";
import { CACHE_TIERS } from "../cache.ts";

type SignalRow={productId:number;change7Bps:number|null;change30Bps:number|null;low30Cents:number|null;high30Cents:number|null;side:"buy"|"sell";score:number;confidence:"high"|"medium"|"low";reason:string;detail:string;distanceBps:number;cutoffBps:number;asOfDate:string;observationDate:string;coverage:"exact"|"fallback"|"none"};

export async function GET(request:Request){
 const url=new URL(request.url),kind=url.searchParams.get("kind")==="sealed"?"sealed":"single",market=url.searchParams.get("market")??"pokemon";
 const side=url.searchParams.get("side"),strictness=url.searchParams.get("strictness");
 if(!["pokemon","riftbound","onepiece"].includes(market)||(kind==="single"&&market==="onepiece")||!["buy","sell"].includes(side??"")||!["conservative","balanced","aggressive"].includes(strictness??""))return NextResponse.json({error:"Invalid signal query"},{status:400});
 const db=env.DB as unknown as D1DatabaseLike|undefined;if(!db)return NextResponse.json({ready:false,records:[]});
 try{
  const readiness=await readySignalHistory(db);
  if(!readiness)return NextResponse.json({ready:false,records:[]},{headers:{"Cache-Control":CACHE_TIERS.transient}});
  const {catalog,history}=readiness;
  // One latest-metrics lookup per signal row instead of four correlated subqueries (review
  // §14 F6): same "latest by updated_at" row, golden-diffed across all 30 boards.
  const rows=(await db.prepare(`select ms.product_id as productId,ms.side,ms.score,ms.confidence,ms.reason,ms.detail,
    ms.distance_bps as distanceBps,ms.cutoff_bps as cutoffBps,ms.as_of_date as asOfDate,
    ms.observation_date as observationDate,ms.coverage,
    mm.change_7_bps as change7Bps,mm.change_30_bps as change30Bps,mm.low_30_cents as low30Cents,mm.high_30_cents as high30Cents
    from market_signals ms join catalog_products p on p.product_id=ms.product_id
    left join market_metrics mm on mm.rowid=(select rowid from market_metrics where product_id=ms.product_id order by updated_at desc limit 1)
    where p.kind=? and p.game=? and p.ingestion_run_id=? and ms.side=? and ms.strictness=?`).bind(kind,market,catalog.runId,side,strictness).all<SignalRow>()).results??[];
  return NextResponse.json({ready:true,asOfDate:history.lastSuccessAt,records:rows},{headers:{"Cache-Control":CACHE_TIERS.long}});
 // A real D1 failure is a 503, distinguishable from "no data yet" (decision D6); the
 // client already treats any non-OK response as not-ready and keeps its fallback.
 }catch{return NextResponse.json({error:"Signals unavailable"},{status:503})}
}

