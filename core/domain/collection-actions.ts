import {collectionHoldings,productKey,recordReview,validCents,validProductRef,type OwnedCollections,type CollectionProduct,type ProductRef} from './owned-collections.ts';
type AddItem=ProductRef&{quantity:number;costCents?:number|null;stickerCents?:number|null};
type Action={type:string;collectionId?:string;name?:string;cardShow?:boolean;items?:AddItem[];skipExisting?:boolean;source?:'manual'|'collectr';lotId?:string;quantity?:number;costCents?:number|null;stickerCents?:number|null;key?:string;netCents?:number};
const quantity=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=1000;
const optionalMoney=(value:unknown)=>value===undefined||value===null||validCents(value);
function collectionExists(state:OwnedCollections,id:unknown){if(!state.collections.some(row=>row.id===id))throw new Error('Choose an existing collection')}
function addLots(state:OwnedCollections,action:Action,market:CollectionProduct[],now:string,newId:()=>string){
 collectionExists(state,action.collectionId);
 if(!Array.isArray(action.items)||!action.items.length||action.items.length>1000)throw new Error('Choose 1–1,000 supported items');
 const indexed=new Map(market.map(row=>[productKey(row),row])),existing=new Set(state.lots.filter(row=>row.collectionId===action.collectionId&&row.quantity>0).map(row=>productKey(row.product))),lots=[...state.lots];
 for(const item of action.items){
  if(!validProductRef(item)||!quantity(item.quantity)||!optionalMoney(item.costCents)||!optionalMoney(item.stickerCents))throw new Error('Invalid quantity or price');
  const product=indexed.get(productKey(item));if(!product)throw new Error('A selected printing is unavailable. Review the import before retrying.');
  if(action.skipExisting&&existing.has(productKey(item)))continue;
  lots.push({id:newId(),collectionId:action.collectionId!,product,quantity:item.quantity,addedAt:now,costCents:item.costCents??null,stickerCents:item.stickerCents??null,source:action.source==='collectr'?'collectr':'manual'});existing.add(productKey(item));
 }
 if(lots.length>1000)throw new Error('This first release supports 1,000 dated lots per account. Nothing was partially imported.');
 return {...state,lots};
}
function sell(state:OwnedCollections,action:Action,market:CollectionProduct[],now:string,newId:()=>string){
 if(!quantity(action.quantity)||!validCents(action.netCents))throw new Error('Enter a valid quantity and total net proceeds');
 const holding=collectionHoldings(state,market,action.collectionId??'all').find(row=>row.key===action.key);
 if(!holding||holding.quantity<action.quantity!)throw new Error('Not enough owned copies');
 let remaining=action.quantity!,allocated=0;const changes=new Map<string,number>(),sales=[...state.sales];
 for(const lot of holding.lots){
  if(!remaining)break;const count=Math.min(lot.quantity,remaining);remaining-=count;
  const net=remaining===0?action.netCents!-allocated:Math.floor(action.netCents!*count/action.quantity!);allocated+=net;changes.set(lot.id,lot.quantity-count);
  sales.push({id:newId(),collectionId:lot.collectionId,lotId:lot.id,quantity:count,netCents:net,costCents:lot.costCents===null?null:lot.costCents*count,date:now,name:lot.product.name});
 }
 if(sales.length>1000)throw new Error('Sales history limit reached; export your records before continuing');
 return {...state,sales,lots:state.lots.map(row=>changes.has(row.id)?{...row,quantity:changes.get(row.id)!}:row)};
}
export function applyCollectionAction(state:OwnedCollections,input:unknown,market:CollectionProduct[],now:string,newId:()=>string):OwnedCollections{
 if(!input||typeof input!=='object')throw new Error('Invalid collection action');const action=input as Action;
 if(action.type==='create'){
  if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>80||state.collections.length>=20)throw new Error('Choose a name up to 80 characters; maximum 20 collections');
  return {...state,collections:[...state.collections,{id:newId(),name:action.name.trim(),cardShow:false,createdAt:now}]};
 }
 if(action.type==='add')return addLots(state,action,market,now,newId);
 if(action.type==='sell')return sell(state,action,market,now,newId);
 if(action.type==='review'){if(action.collectionId!=='all')collectionExists(state,action.collectionId);return recordReview(state,market,action.collectionId!,now)}
 if(action.type==='update'){
  collectionExists(state,action.collectionId);if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>80||typeof action.cardShow!=='boolean')throw new Error('Invalid collection settings');
  return {...state,collections:state.collections.map(row=>row.id===action.collectionId?{...row,name:action.name!.trim(),cardShow:action.cardShow!}:row)};
 }
 if(action.type==='lot'){
  const lot=state.lots.find(row=>row.id===action.lotId);if(!lot||!quantity(action.quantity)||!optionalMoney(action.costCents)||!optionalMoney(action.stickerCents))throw new Error('Invalid lot correction');
  return {...state,lots:state.lots.map(row=>row.id===lot.id?{...row,quantity:action.quantity!,costCents:action.costCents??null,stickerCents:action.stickerCents??null}:row)};
 }
 if(action.type==='remove'){
  if(!state.lots.some(row=>row.id===action.lotId))throw new Error('Lot not found');return {...state,lots:state.lots.filter(row=>row.id!==action.lotId)};
 }
 throw new Error('Unsupported collection action');
}
