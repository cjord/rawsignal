import {NextResponse} from "next/server";
import type {CatalogKind} from "../../../domain/types.ts";
import {loadCatalogDetail} from "../../../data/load-detail.ts";

export async function GET(request:Request){
 const url=new URL(request.url),kind=url.searchParams.get("kind") as CatalogKind|null,id=url.searchParams.get("productId")??"",market=url.searchParams.get("market")??undefined;
 if((kind!=="single"&&kind!=="sealed")||!/^[-]?\d{1,9}$/.test(id))return NextResponse.json({error:"Invalid detail request"},{status:400});
 try{const detail=await loadCatalogDetail(kind,Number(id),market,url.origin);return detail?NextResponse.json(detail,{headers:{"Cache-Control":"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"}}):NextResponse.json({error:"Product not found"},{status:404})}catch{return NextResponse.json({error:"Product details unavailable"},{status:503})}
}
