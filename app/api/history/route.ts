import { NextResponse } from "next/server";

type Bucket = { marketPrice: string; bucketStartDate: string };
type Series = { variant: string; language: string; condition: string; buckets: Bucket[] };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const printing = url.searchParams.get("printing") ?? "";
  const sealed = url.searchParams.get("sealed") === "1";
  if (!/^\d{1,9}$/.test(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  const upstream = await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}/detailed?range=quarter`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RawSignal/3.0)" },
  });
  if (!upstream.ok) return NextResponse.json({ error: "History unavailable" }, { status: 502 });
  const payload = await upstream.json() as { result?: Series[] };
  const english = (payload.result ?? []).filter(row => row.language === "English");
  const candidates = sealed ? english : english.filter(row => row.condition === "Near Mint");
  const exact = candidates.find(row => row.variant.toLowerCase() === printing.toLowerCase());
  const selected = exact ?? (sealed ? candidates.find(row => /sealed|unopened/i.test(row.condition)) : undefined) ?? candidates[0];
  if (!selected) return NextResponse.json({ points: [], coverage: "none" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  const points = selected.buckets.map(bucket => ({ date: bucket.bucketStartDate, price: Number(bucket.marketPrice) })).filter(point => Number.isFinite(point.price) && point.price > 0).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ points, variant: selected.variant, condition: selected.condition, coverage: exact ? "exact" : "fallback" }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
