import type {Card} from './types.ts';

export const AUCTION_CATALOG_SCHEMA=1;
export const AUCTION_CATALOG_LIMIT=6000;
export const auctionCatalogCacheEnabled=(env:{ENVIRONMENT?:string;AUCTION_CATALOG_CACHE_ENABLED?:string})=>env.ENVIRONMENT!=='production'&&env.AUCTION_CATALOG_CACHE_ENABLED==='true';
export type AuctionCatalogRow=[number,string,string,string,string,string,string,number|null];
export type AuctionCatalogManifest={schema:1;version:string;source:'database'|'feed';asOf:string|null;publishedAt:string|null;count:number};
export type AuctionCatalogSnapshot=AuctionCatalogManifest&{rows:AuctionCatalogRow[]};
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const date=(value:unknown):value is string|null=>value===null||typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
export function parseAuctionCatalogManifest(value:unknown):AuctionCatalogManifest{
 if(!record(value)||value.schema!==1||typeof value.version!=='string'||!/^[a-f0-9]{64}$/.test(value.version)||!['database','feed'].includes(String(value.source))||!date(value.asOf)||!date(value.publishedAt)||!Number.isSafeInteger(value.count)||Number(value.count)<1||Number(value.count)>AUCTION_CATALOG_LIMIT)throw new Error('Invalid auction catalog manifest');
 return {schema:1,version:value.version,source:value.source as AuctionCatalogManifest['source'],asOf:value.asOf,publishedAt:value.publishedAt,count:Number(value.count)};
}
function validRow(row:unknown):row is AuctionCatalogRow{
 return Array.isArray(row)&&row.length===8&&Number.isSafeInteger(row[0])&&row[0]>0&&text(row[1],80)&&Boolean(row[1])&&text(row[2],300)&&text(row[3],300)&&text(row[4],300)&&text(row[5],100)&&text(row[6],2000)&&(!row[6]||/^https?:\/\//.test(row[6]))&&(row[7]===null||Number.isSafeInteger(row[7])&&row[7]>=0);
}
export function parseAuctionCatalogSnapshot(value:unknown):AuctionCatalogSnapshot{
 const manifest=parseAuctionCatalogManifest(value),rows=(value as Record<string,unknown>).rows;
 if(!Array.isArray(rows)||rows.length!==manifest.count||!rows.every(validRow)||new Set(rows.map(row=>`${row[0]}:${row[1]}`)).size!==rows.length)throw new Error('Invalid auction catalog rows');
 return {...manifest,rows:rows.map(row=>[...row])};
}
export async function auctionCatalogDigest(value:unknown){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function createAuctionCatalogSnapshot(cards:Card[],source:AuctionCatalogManifest['source'],asOf:string|null,publishedAt:string|null):Promise<AuctionCatalogSnapshot>{
 const ordered=cards.filter(card=>card.game==='riftbound').sort((a,b)=>a.productId-b.productId||a.printing.localeCompare(b.printing));
 const rows:AuctionCatalogRow[]=ordered.map(card=>[card.productId,card.printing,card.name,card.set,card.rarity,card.section,card.image,card.marketPrice===null?null:Math.round(card.marketPrice*100)]);
 const payload={schema:1 as const,source,asOf,publishedAt,count:rows.length,rows};
 return parseAuctionCatalogSnapshot({...payload,version:await auctionCatalogDigest(payload)});
}
export function unpackAuctionCatalog(snapshot:AuctionCatalogSnapshot):Card[]{
 return snapshot.rows.map(([productId,printing,name,set,rarity,section,image,cents])=>({game:'riftbound',productId,printing,name,set,rarity,section,image,marketPrice:cents===null?null:cents/100,year:0,number:'',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
}
export async function verifyAuctionCatalogSnapshot(value:unknown){
 const snapshot=parseAuctionCatalogSnapshot(value),{version,...content}=snapshot;
 // Hash the canonical shape used by the producer, not property order supplied by a caller.
 const canonical={schema:content.schema,source:content.source,asOf:content.asOf,publishedAt:content.publishedAt,count:content.count,rows:content.rows};
 if(await auctionCatalogDigest(canonical)!==version)throw new Error('Auction catalog version mismatch');
 return snapshot;
}
