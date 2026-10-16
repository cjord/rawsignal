import {holdingKey,type AuctionSave,type Holding} from './auction-types.ts';

export const SHOWCASE_LIMIT=20;
export function validShowcase(value:unknown):value is Holding[]{
 return Array.isArray(value)&&value.length<=SHOWCASE_LIMIT&&new Set(value.map(row=>row&&holdingKey(row))).size===value.length&&value.every(row=>row&&Number.isSafeInteger(row.productId)&&row.productId>0&&typeof row.printing==='string'&&row.printing.length<=80&&row.quantity===1);
}
function addHolding(rows:Holding[],card:Holding){const existing=rows.find(row=>holdingKey(row)===holdingKey(card));return existing?rows.map(row=>row===existing?{...row,quantity:row.quantity+1}:row):[...rows,{...card,quantity:1}];}
export function moveShowcaseCard(save:AuctionSave,key:string,destination:'showcase'|'inventory'):AuctionSave{
 if(save.auction)return save;
 const showcase=save.showcase??[],from=destination==='showcase'?save.wallet.inventory:showcase,card=from.find(row=>holdingKey(row)===key);
 if(!card)return save;
 if(destination==='showcase'&&(showcase.length>=SHOWCASE_LIMIT||showcase.some(row=>holdingKey(row)===key)))return save;
 const remaining=from.flatMap(row=>row!==card?[row]:row.quantity>1?[{...row,quantity:row.quantity-1}]:[]);
 return destination==='showcase'?{...save,showcase:addHolding(showcase,card),wallet:{...save.wallet,inventory:remaining}}:{...save,showcase:remaining,wallet:{...save.wallet,inventory:addHolding(save.wallet.inventory,card)}};
}
export function reorderShowcase(save:AuctionSave,key:string,beforeKey:string):AuctionSave{
 const rows=save.showcase??[],from=rows.findIndex(row=>holdingKey(row)===key),to=rows.findIndex(row=>holdingKey(row)===beforeKey);
 if(save.auction||from<0||to<0||from===to)return save;
 const next=rows.filter((_,index)=>index!==from);next.splice(to,0,rows[from]);return {...save,showcase:next};
}
export function ownedAuctionCards(save:AuctionSave){
 const rows=new Map<string,Holding>();for(const card of [...save.wallet.inventory,...save.showcase??[]]){const key=holdingKey(card),current=rows.get(key);rows.set(key,{...card,quantity:(current?.quantity??0)+card.quantity})}return [...rows.values()];
}
