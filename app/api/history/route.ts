import { NextResponse } from "next/server";

type Bucket = { marketPrice: string; bucketStartDate: string };
type Series = { variant: string; language: string; condition: string; buckets: Bucket[] };
const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" };
async function history(productId:string,range:"quarter"|"annual"){
 const response=await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}/detailed?range=${range}`,{headers});
 if(!response.ok)throw new Error(`History ${range} unavailable`);
 return (await response.json() as {result?:Series[]}).result??[];
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
  const merged=new Map<string,number>();
  for(const bucket of [...(annualMatch?.buckets??[]),...selected.buckets]){const price=Number(bucket.marketPrice);if(Number.isFinite(price)&&price>0)merged.set(bucket.bucketStartDate,price)}
  const points=[...merged].map(([date,price])=>({date,price})).sort((a,b)=>a.date.localeCompare(b.date));
  return NextResponse.json({ points, variant: selected.variant, condition: selected.condition, coverage: exact ? "exact" : "fallback" }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
