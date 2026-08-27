import type {Metadata} from "next";
import {notFound} from "next/navigation";
import ProductDetailPage from "../../ProductDetailPage";
import {detailServerTiming} from "../../data/load-detail";
import {detailMetadata,detailRecord} from "../../detail-route";

type Props={params:Promise<{productId:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{return detailMetadata(await detailRecord("single",(await params).productId))}
export default async function CardDetailRoute({params}:Props){const detail=await detailRecord("single",(await params).productId);if(!detail||detail.kind!=="single")notFound();return <ProductDetailPage detail={detail} serverTiming={detailServerTiming(detail)}/>}

