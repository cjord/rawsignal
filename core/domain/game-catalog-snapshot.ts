import type {Card} from './types.ts';
import {catalogDigest} from './catalog-digest.ts';
import {parseGameScope,selectGameScope,gameScopeKey,type GameScope} from './game-scope.ts';
import {parseGameMarket,type GameMarket} from './game-profile.ts';

export const GAME_CATALOG_LIMIT=50_000;
export const GAME_CATALOG_BYTES=16_000_000;
export type GameCatalogRow=[number,string,string,string,string,string,string,number,number,string];
export type GameCatalogManifest={schema:2;market:GameMarket;scope:GameScope;version:string;source:'database'|'feed';asOf:string|null;publishedAt:string|null;count:number};
export type GameCatalogSnapshot=GameCatalogManifest&{rows:GameCatalogRow[]};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const date=(value:unknown)=>value===null||typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
export function parseGameCatalogManifest(value:unknown):GameCatalogManifest{
 if(!object(value)||value.schema!==2||typeof value.version!=='string'||! /^[a-f0-9]{64}$/.test(value.version)||!['database','feed'].includes(String(value.source))||!date(value.asOf)||!date(value.publishedAt)||!Number.isSafeInteger(value.count)||Number(value.count)<0||Number(value.count)>GAME_CATALOG_LIMIT)throw new Error('Invalid game catalog manifest.');
 const market=parseGameMarket(value.market),scope=parseGameScope(value.scope);
 if(scope.market!==market)throw new Error('Game catalog market mismatch.');
 return {schema:2,market,scope,version:value.version,source:value.source as 'database'|'feed',asOf:value.asOf as string|null,publishedAt:value.publishedAt as string|null,count:Number(value.count)};
}
function validRow(row:unknown):row is GameCatalogRow{
 return Array.isArray(row)&&row.length===10&&Number.isSafeInteger(row[0])&&row[0]>0&&text(row[1],80)&&!!row[1]&&text(row[2],300)&&!!row[2]&&text(row[3],300)&&text(row[4],300)&&text(row[5],100)&&text(row[6],2000)&&/^https:\/\//.test(row[6])&&Number.isSafeInteger(row[7])&&row[7]>0&&Number.isInteger(row[8])&&row[8]>=0&&row[8]<=2100&&text(row[9],100);
}
export function parseGameCatalogSnapshot(value:unknown):GameCatalogSnapshot{
 const manifest=parseGameCatalogManifest(value),rows=(value as Record<string,unknown>).rows;
 if(!Array.isArray(rows)||rows.length!==manifest.count||!rows.every(validRow)||new Set(rows.map(r=>`${r[0]}:${r[1]}`)).size!==rows.length||new TextEncoder().encode(JSON.stringify(rows)).byteLength>GAME_CATALOG_BYTES)throw new Error('Invalid or oversized game catalog.');
 return {...manifest,rows:rows.map(row=>[...row])};
}
const content=(snapshot:Omit<GameCatalogSnapshot,'version'>)=>({schema:snapshot.schema,market:snapshot.market,scope:parseGameScope(snapshot.scope),source:snapshot.source,asOf:snapshot.asOf,publishedAt:snapshot.publishedAt,count:snapshot.count,rows:snapshot.rows});
export async function createGameCatalogSnapshot(cards:Card[],scope:GameScope,source:GameCatalogManifest['source'],asOf:string|null,publishedAt:string|null):Promise<GameCatalogSnapshot>{
 const selected=selectGameScope(cards,scope);
 if(selected.missingSets.length||selected.incompatibleSets.length)throw new RangeError('Some selected sets are unavailable or outside the selected eras.');
 if(selected.cards.length>GAME_CATALOG_LIMIT)throw new RangeError('This pool is too large. Select fewer eras or sets.');
 const rows:GameCatalogRow[]=selected.cards.sort((a,b)=>a.productId-b.productId||a.printing.localeCompare(b.printing)).map(card=>[card.productId,card.printing,card.name,card.set,card.rarity,card.section,card.image,Math.round(card.marketPrice!*100),card.year??0,card.number]);
 const payload=content({schema:2,market:selected.scope.market,scope:selected.scope,source,asOf,publishedAt,count:rows.length,rows});
 const validated=parseGameCatalogSnapshot({...payload,version:'0'.repeat(64)});
 return {...validated,version:await catalogDigest(content(validated))};
}
export function unpackGameCatalog(snapshot:GameCatalogSnapshot):Card[]{
 return snapshot.rows.map(([productId,printing,name,set,rarity,section,image,cents,year,number])=>({game:snapshot.market,productId,printing,name,set,rarity,section,image,year,number,url:'',marketPrice:cents/100,lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
}
export async function verifyGameCatalogSnapshot(value:unknown,expected:GameScope){
 const snapshot=parseGameCatalogSnapshot(value),{version,...payload}=snapshot;
 if(gameScopeKey(snapshot.scope)!==gameScopeKey(expected)||await catalogDigest(content(payload))!==version)throw new Error('Game catalog identity mismatch.');
 const selected=selectGameScope(unpackGameCatalog(snapshot),snapshot.scope);
 if(selected.cards.length!==snapshot.count)throw new Error('Game catalog contains out-of-scope cards.');
 return snapshot;
}
