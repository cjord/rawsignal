import {holdingKey,type AuctionSave,type Holding} from './auction-types.ts';

export const SHOWCASE_LIMIT=20;
export function validShowcase(value:unknown):value is Holding[]{
 return Array.isArray(value)&&value.length<=SHOWCASE_LIMIT&&value.every(row=>row&&Number.isSafeInteger(row.productId)&&row.productId>0&&typeof row.printing==='string'&&row.printing.length<=80&&row.quantity===1);
}
function addHolding(rows:Holding[],card:Holding){const existing=rows.find(row=>holdingKey(row)===holdingKey(card));return existing?rows.map(row=>row===existing?{...row,quantity:row.quantity+1}:row):[...rows,{...card,quantity:1}];}
export function moveShowcaseCard(save:AuctionSave,key:string|number,destination:'showcase'|'inventory'):AuctionSave{
 if(save.auction)return save;
 const showcase=save.showcase??[],from=destination==='showcase'?save.wallet.inventory:showcase,index=typeof key==='number'?key:from.findIndex(row=>holdingKey(row)===key),card=Number.isSafeInteger(index)?from[index]:undefined;
 if(!card)return save;
 if(destination==='showcase'&&showcase.length>=SHOWCASE_LIMIT)return save;
 const remaining=from.flatMap((row,i)=>i!==index?[row]:row.quantity>1?[{...row,quantity:row.quantity-1}]:[]);
 return destination==='showcase'?{...save,showcase:[...showcase,{...card,quantity:1}],wallet:{...save.wallet,inventory:remaining}}:{...save,showcase:remaining,wallet:{...save.wallet,inventory:addHolding(save.wallet.inventory,card)}};
}
export function reorderShowcase(save:AuctionSave,key:string|number,beforeKey:string|number):AuctionSave{
 const rows=save.showcase??[],from=typeof key==='number'?key:rows.findIndex(row=>holdingKey(row)===key),to=typeof beforeKey==='number'?beforeKey:rows.findIndex(row=>holdingKey(row)===beforeKey);
 if(save.auction||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<0||from>=rows.length||to>=rows.length||from===to)return save;
 const next=rows.filter((_,index)=>index!==from);next.splice(to,0,rows[from]);return {...save,showcase:next};
}
export function showcaseValueTone(cents:number){return cents>=1000000?'gold':cents>=250000?'purple':cents>=50000?'blue':'green';}
export function ownedAuctionCards(save:AuctionSave){
 const rows=new Map<string,Holding>();for(const card of [...save.wallet.inventory,...save.showcase??[]]){const key=holdingKey(card),current=rows.get(key);rows.set(key,{...card,quantity:(current?.quantity??0)+card.quantity})}return [...rows.values()];
}
