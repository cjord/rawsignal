import type {Metadata} from "next";
import {notFound} from "next/navigation";
import ProductDetailPage from "../../ProductDetailPage";
import {detailMetadata,detailRecord} from "../../detail-route";

type Props={params:Promise<{productId:string}>;searchParams:Promise<{market?:string}>};
export async function generateMetadata({params,searchParams}:Props):Promise<Metadata>{const [route,query]=await Promise.all([params,searchParams]);return detailMetadata(await detailRecord("sealed",route.productId,query.market))}
export default async function SealedDetailRoute({params,searchParams}:Props){const [route,query]=await Promise.all([params,searchParams]),detail=await detailRecord("sealed",route.productId,query.market);if(!detail||detail.kind!=="sealed")notFound();return <ProductDetailPage detail={detail} market={query.market}/>}

