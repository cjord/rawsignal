import type {Metadata} from "next";
import {notFound} from "next/navigation";
import ProductDetailPage from "../../ProductDetailPage";
import {detailServerTiming} from "../../data/load-detail";
import {detailMetadata,detailRecord} from "../../detail-route";

type Props={params:Promise<{productId:string}>};
// The card detail changes once a day (after the metrics rollup); vinext's ISR serves the
// rendered page from the isolate for this long and regenerates in the background
// (stale-while-revalidate), so repeat views and hover prefetches skip D1 (review §14 F7).
export const revalidate = 600;

export async function generateMetadata({params}:Props):Promise<Metadata>{return detailMetadata(await detailRecord("single",(await params).productId))}
export default async function CardDetailRoute({params}:Props){const detail=await detailRecord("single",(await params).productId);if(!detail||detail.kind!=="single")notFound();return <ProductDetailPage detail={detail} serverTiming={detailServerTiming(detail)}/>}

