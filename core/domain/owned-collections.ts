// Real holdings, never game inventory. All money is integer USD cents.
export const COLLECTIONS_KEY='raw-signal-owned-collections-v1';
export type ProductRef={kind:'single'|'sealed';game:'pokemon'|'riftbound'|'onepiece';productId:number;printing:string};
export type CollectionProduct=ProductRef&{name:string;set:string;rarity:string;image:string|null;cents:number|null;source:'database'|'feed';asOf:string|null};
export type OwnedCollection={id:string;name:string;cardShow:boolean;createdAt:string};
export type CollectionLot={id:string;collectionId:string;product:CollectionProduct;quantity:number;addedAt:string;costCents:number|null;stickerCents:number|null;source:'manual'|'collectr'};
export type CollectionSale={id:string;collectionId:string;lotId:string;quantity:number;netCents:number;costCents:number|null;date:string;name:string;saleId?:string;eventId?:string|null;product?:CollectionProduct};
export type CardShowEvent={id:string;name:string;date:string;expensesCents:number;createdAt:string};
export type CollectionReview={date:string;collectionId:string;lots:{id:string;quantity:number;key:string;cents:number|null;source?:'database'|'feed';asOf?:string|null}[]};
export type OwnedCollections={version:1;collections:OwnedCollection[];lots:CollectionLot[];sales:CollectionSale[];reviews:CollectionReview[];events?:CardShowEvent[]};
export const emptyCollections=():OwnedCollections=>({version:1,collections:[],lots:[],sales:[],reviews:[],events:[]});
export const productKey=(product:ProductRef)=>JSON.stringify([product.kind,product.game,product.productId,product.printing]);
export const validCents=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=1_000_000_000;
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const date=(value:unknown):value is string=>typeof value==='string'&&value.length<=30&&Number.isFinite(Date.parse(value));
const optionalCents=(value:unknown)=>value===null||validCents(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function validProductRef(value:unknown):value is ProductRef{return object(value)&&['single','sealed'].includes(String(value.kind))&&['pokemon','riftbound','onepiece'].includes(String(value.game))&&!(value.kind==='single'&&value.game==='onepiece')&&Number.isSafeInteger(value.productId)&&Number(value.productId)>0&&text(value.printing,100)&&value.printing.length>0}
function validProduct(value:unknown):value is CollectionProduct{if(!object(value))return false;const row=value;return text(row.name,250)&&text(row.set,250)&&text(row.rarity,100)&&(row.image===null||text(row.image,600)&&/^https?:\/\//.test(row.image))&&optionalCents(row.cents)&&['database','feed'].includes(String(row.source))&&(row.asOf===null||date(row.asOf))&&validProductRef(row)}
function validLot(value:unknown):value is CollectionLot{return object(value)&&id(value.id)&&id(value.collectionId)&&validProduct(value.product)&&Number.isSafeInteger(value.quantity)&&Number(value.quantity)>=0&&Number(value.quantity)<=1000&&date(value.addedAt)&&optionalCents(value.costCents)&&optionalCents(value.stickerCents)&&['manual','collectr'].includes(String(value.source))}
function validSaleDetails(value:CollectionSale){return (value.saleId===undefined||id(value.saleId))&&(value.eventId===undefined||value.eventId===null||id(value.eventId))&&(value.product===undefined||validProduct(value.product))}
function validSale(value:unknown):value is CollectionSale{return object(value)&&id(value.id)&&id(value.collectionId)&&id(value.lotId)&&Number.isSafeInteger(value.quantity)&&Number(value.quantity)>0&&validCents(value.netCents)&&(value.costCents===null||Number.isSafeInteger(value.costCents)&&Number(value.costCents)>=0&&Number(value.costCents)<=1_000_000_000_000)&&date(value.date)&&text(value.name,250)&&validSaleDetails(value as CollectionSale)}
export function validEventDay(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
function validEvent(value:unknown):value is CardShowEvent{return object(value)&&id(value.id)&&text(value.name,80)&&value.name.trim().length>0&&validEventDay(value.date)&&validCents(value.expensesCents)&&date(value.createdAt)}
function validEvents(value:unknown){return value===undefined||Array.isArray(value)&&value.length<=100&&value.every(validEvent)}
function checkEventReferences(state:OwnedCollections){
 if(!validEvents(state.events))throw new Error('Invalid card show events');
 const eventIds=new Set((state.events??[]).map(row=>row.id));if(eventIds.size!==(state.events??[]).length||state.sales.some(row=>row.eventId&&!eventIds.has(row.eventId)))throw new Error('Invalid sale event references');
}
function validReviewLot(row:unknown){return object(row)&&id(row.id)&&Number.isSafeInteger(row.quantity)&&Number(row.quantity)>0&&text(row.key,220)&&optionalCents(row.cents)&&(row.source===undefined||['database','feed'].includes(String(row.source)))&&(row.asOf===undefined||row.asOf===null||date(row.asOf))}
function validReview(value:unknown):value is CollectionReview{return object(value)&&id(value.collectionId)&&typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)&&date(value.date)&&Array.isArray(value.lots)&&value.lots.length<=1000&&value.lots.every(validReviewLot)}
export function parseCollections(raw:string):OwnedCollections{
 const value:unknown=JSON.parse(raw);
 if(!object(value)||value.version!==1||!Array.isArray(value.collections)||value.collections.length>20||!value.collections.every(row=>object(row)&&id(row.id)&&text(row.name,80)&&row.name.trim().length>0&&typeof row.cardShow==='boolean'&&date(row.createdAt))||!Array.isArray(value.lots)||value.lots.length>1000||!value.lots.every(validLot)||!Array.isArray(value.sales)||value.sales.length>1000||!value.sales.every(validSale)||!Array.isArray(value.reviews)||value.reviews.length>63||!value.reviews.every(validReview))throw new Error('Invalid collection data');
 const state=value as OwnedCollections,ids=new Set(state.collections.map(row=>row.id));
 checkEventReferences(state);
 if(ids.size!==state.collections.length||new Set(state.lots.map(row=>row.id)).size!==state.lots.length||new Set(state.sales.map(row=>row.id)).size!==state.sales.length||[...state.lots,...state.sales].some(row=>!ids.has(row.collectionId))||state.reviews.some(row=>row.collectionId!=='all'&&!ids.has(row.collectionId)))throw new Error('Invalid collection references');
 for(const collectionId of [...ids,'all']){const reviews=state.reviews.filter(row=>row.collectionId===collectionId);if(reviews.length>3||new Set(reviews.map(row=>row.date)).size!==reviews.length)throw new Error('Invalid review history')}
 return state;
}
export type Holding={key:string;product:CollectionProduct;lots:CollectionLot[];quantity:number;value:number|null;baseline:number|null;change:number|null;percent:number|null;cost:number|null;profit:number|null};
const percent=(change:number,base:number)=>base>0?change/base*100:null;
export function collectionHoldings(state:OwnedCollections,prices:CollectionProduct[],collectionId='all'):Holding[]{
 const market=new Map(prices.map(row=>[productKey(row),row])),groups=new Map<string,CollectionLot[]>();
 for(const lot of state.lots){if(lot.quantity<=0||collectionId!=='all'&&lot.collectionId!==collectionId)continue;const key=productKey(lot.product),group=groups.get(key)??[];group.push(lot);groups.set(key,group)}
 return [...groups].map(([key,lots])=>{
  const latest=market.get(key),product=latest??{...lots[0].product,cents:null},quantity=lots.reduce((sum,lot)=>sum+lot.quantity,0),value=product.cents===null?null:product.cents*quantity;
 const baseline=lots.every(lot=>lot.product.cents!==null&&comparableSource(product,lot.product))?lots.reduce((sum,lot)=>sum+lot.product.cents!*lot.quantity,0):null;
  const cost=lots.every(lot=>lot.costCents!==null)?lots.reduce((sum,lot)=>sum+lot.costCents!*lot.quantity,0):null;
  const change=value!==null&&baseline!==null?value-baseline:null;
  return {key,product,lots:lots.sort((a,b)=>a.addedAt.localeCompare(b.addedAt)||a.id.localeCompare(b.id)),quantity,value,baseline,change,percent:change!==null&&baseline!==null?percent(change,baseline):null,cost,profit:value!==null&&cost!==null?value-cost:null};
 });
}
export function collectionTotals(holdings:Holding[]){
 const compared=holdings.filter(row=>row.change!==null),priced=holdings.filter(row=>row.value!==null),costed=holdings.filter(row=>row.profit!==null),baseline=compared.reduce((sum,row)=>sum+row.baseline!,0),change=compared.reduce((sum,row)=>sum+row.change!,0);
 return {quantity:holdings.reduce((sum,row)=>sum+row.quantity,0),value:priced.length||!holdings.length?priced.reduce((sum,row)=>sum+row.value!,0):null,change:compared.length?change:null,percent:compared.length?percent(change,baseline):null,profit:costed.length?costed.reduce((sum,row)=>sum+row.profit!,0):null,priced:priced.length,compared:compared.length,total:holdings.length};
}
export function reviewMovers(holdings:Holding[],review:CollectionReview|null){
 if(!review)return [];
 const saved=new Map(review.lots.map(row=>[row.id,row]));
 return holdings.map(holding=>{
  const lots=holding.lots.filter(lot=>saved.get(lot.id)?.key===holding.key),quantity=lots.reduce((sum,lot)=>sum+Math.min(lot.quantity,saved.get(lot.id)!.quantity),0);
  const baseline=lots.every(lot=>saved.get(lot.id)!.cents!==null)?lots.reduce((sum,lot)=>sum+saved.get(lot.id)!.cents!*Math.min(lot.quantity,saved.get(lot.id)!.quantity),0):null;
  const change=holding.product.cents!==null&&baseline!==null&&quantity>0&&lots.every(lot=>comparableSource(holding.product,saved.get(lot.id)!))?holding.product.cents*quantity-baseline:null;
  return {...holding,comparedQuantity:quantity,addedQuantity:holding.quantity-quantity,change,percent:change!==null&&baseline!==null?percent(change,baseline):null};
 });
}
export function recordReview(state:OwnedCollections,prices:CollectionProduct[],collectionId:string,now:string){
 const holdings=collectionHoldings(state,prices,collectionId),review:CollectionReview={collectionId,date:now.slice(0,10),lots:holdings.flatMap(holding=>holding.lots.map(lot=>({id:lot.id,quantity:lot.quantity,key:holding.key,cents:holding.product.cents,source:holding.product.source,asOf:holding.product.asOf})))};
 const previous=state.reviews.filter(row=>row.collectionId===collectionId&&row.date!==review.date);
 return {...state,reviews:[...state.reviews.filter(row=>row.collectionId!==collectionId),...[review,...previous].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)]};
}
function comparableSource(current:{source?:string;asOf?:string|null},baseline:{source?:string;asOf?:string|null}){
 if(current.source==='feed'&&baseline.source==='database')return false;
 if(current.source!==baseline.source&&(!current.asOf||!baseline.asOf))return false;
 return !current.asOf||!baseline.asOf||current.asOf>=baseline.asOf;
}
