import {headers} from "next/headers";
import {cache} from "react";
import type {Metadata} from "next";
import type {CatalogDetail,CatalogKind} from "../core/domain/types";
import {loadCatalogDetail} from "./data/load-detail";

export async function detailOrigin(){const values=await headers(),host=values.get("host")??"localhost:3000",protocol=values.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https");return `${protocol}://${host}`}
// cache() dedupes the generateMetadata and page-component loads within one request.
export const detailRecord=cache(async(kind:CatalogKind,productId:string,market?:string)=>{if(!/^-?\d{1,9}$/.test(productId))return null;return loadCatalogDetail(kind,Number(productId),market,await detailOrigin())});
export function detailMetadata(detail:CatalogDetail|null):Metadata{
 if(!detail)return {title:"Product not found — Raw Signal",description:"This market record is unavailable.",openGraph:{images:[]},twitter:{images:[]}};
 const title=`${detail.name} Price & Market History — Raw Signal`,description=`${detail.name} from ${detail.set}: current market price, 7/30/90-day movement, historic range, product details, and similar items.`,images=detail.image?[{url:detail.image,alt:detail.name}]:[];
 return {title,description,openGraph:{title,description,images},twitter:{card:"summary_large_image",title,description,images:images.map(item=>item.url)}};
}

