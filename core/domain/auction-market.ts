import type {Card} from "./types.ts";
import {feeFor,holdingKey,sampleIndices,type AuctionCard,type Holding} from "./auction-types.ts";

export function auctionCatalog(cards:Card[]):AuctionCard[]{
 return [...new Map(cards.filter(card=>card.game==="riftbound"&&card.marketPrice!=null&&Number.isFinite(card.marketPrice)&&card.marketPrice>0)
  .map(card=>[holdingKey(card),{productId:card.productId,printing:card.printing,name:card.name,image:card.image,set:card.set,rarity:card.rarity,section:card.section,cents:Math.round(card.marketPrice!*100)}])).values()].filter(card=>card.cents>0&&Number.isSafeInteger(card.cents));
}
// One reproducible small-binder fixture for the prototype, not the procedural-lot phase.
export function prototypeLot(catalog:AuctionCard[]):AuctionCard[]{
 const ordered=catalog.filter(card=>card.image.trim()).sort((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
 const affordable=ordered.filter(card=>card.cents<=10000),pool=affordable.length>=12?affordable:ordered;
 if(pool.length<6)return [];
 const indices=sampleIndices(pool.length,24,7321);
 return indices.flatMap(index=>[{...pool[index]},{...pool[index]}]);
}
export function inventoryQuote(inventory:Holding[],catalog:AuctionCard[],feeBps:number){
 const prices=new Map(catalog.map(card=>[holdingKey(card),card]));
 const rows=inventory.map(holding=>{const card=prices.get(holdingKey(holding))??null,gross=card?card.cents*holding.quantity:null;return {holding,card,gross,net:gross==null?null:gross-feeFor(gross,feeBps)}});
 return {rows,unpriced:rows.filter(row=>row.net==null).reduce((sum,row)=>sum+row.holding.quantity,0),net:rows.reduce((sum,row)=>sum+(row.net??0),0)};
}
export function addInventory(inventory:Holding[],lot:AuctionCard[]):Holding[]{
 const merged=new Map(inventory.map(row=>[holdingKey(row),{...row}]));
 for(const card of lot){const key=holdingKey(card),existing=merged.get(key);merged.set(key,{productId:card.productId,printing:card.printing,quantity:(existing?.quantity??0)+1})}
 return [...merged.values()];
}
