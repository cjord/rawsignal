import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";

type SignalRow={productId:number;change7Bps:number|null;change30Bps:number|null;low30Cents:number|null;high30Cents:number|null;side:"buy"|"sell";score:number;confidence:"high"|"medium"|"low";reason:string;detail:string;distanceBps:number;cutoffBps:number;asOfDate:string;observationDate:string;coverage:"exact"|"fallback"|"none"};

export async function GET(request:Request){
 const url=new URL(request.url),kind=url.searchParams.get("kind")==="sealed"?"sealed":"single",market=url.searchParams.get("market")??"pokemon";
 const side=url.searchParams.get("side"),strictness=url.searchParams.get("strictness");
 if(!["pokemon","riftbound","onepiece"].includes(market)||(kind==="single"&&market==="onepiece")||!["buy","sell"].includes(side??"")||!["conservative","balanced","aggressive"].includes(strictness??""))return NextResponse.json({error:"Invalid signal query"},{status:400});
 const db=env.DB as unknown as D1DatabaseLike|undefined;if(!db)return NextResponse.json({ready:false,records:[]});
 try{
  const catalog=await publishedIngestion(db),history=await publishedIngestion(db,"history-signals");
  if(!catalog||!history)return NextResponse.json({ready:false,records:[]},{headers:{"Cache-Control":"public, max-age=60, s-maxage=60"}});
  const rows=(await db.prepare(`select ms.product_id as productId,ms.side,ms.score,ms.confidence,ms.reason,ms.detail,
    ms.distance_bps as distanceBps,ms.cutoff_bps as cutoffBps,ms.as_of_date as asOfDate,
    ms.observation_date as observationDate,ms.coverage,
    (select change_7_bps from market_metrics where product_id=ms.product_id order by updated_at desc limit 1) as change7Bps,
    (select change_30_bps from market_metrics where product_id=ms.product_id order by updated_at desc limit 1) as change30Bps,
    (select low_30_cents from market_metrics where product_id=ms.product_id order by updated_at desc limit 1) as low30Cents,
    (select high_30_cents from market_metrics where product_id=ms.product_id order by updated_at desc limit 1) as high30Cents
    from market_signals ms join catalog_products p on p.product_id=ms.product_id
    where p.kind=? and p.game=? and p.ingestion_run_id=? and ms.side=? and ms.strictness=?`).bind(kind,market,catalog.runId,side,strictness).all<SignalRow>()).results??[];
  return NextResponse.json({ready:true,asOfDate:history.lastSuccessAt,records:rows},{headers:{"Cache-Control":"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"}});
 }catch{return NextResponse.json({ready:false,records:[]},{status:200})}
}

