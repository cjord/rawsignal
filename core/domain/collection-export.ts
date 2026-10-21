import type {CollectionSale,Holding,OwnedCollection,CardShowEvent} from './owned-collections.ts';
type Cell=string|number|null|undefined;
// Quote all cells and neutralize spreadsheet formulas in untrusted text. Numeric
// negative profits remain numbers; unavailable money stays blank, not zero.
const cell=(value:Cell)=>{const raw=value==null?'':String(value),safe=typeof value==='string'&&/^[\s\uFEFF]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"'};
export const collectionCsv=(rows:Cell[][])=>'\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
const dollars=(cents:number|null|undefined)=>cents==null?null:cents/100;
export function holdingCsv(holdings:Holding[],collections:OwnedCollection[]){
 const names=new Map(collections.map(row=>[row.id,row.name]));
 return collectionCsv([['Collection','Product ID','Kind','Game','Name','Set','Printing','Added At UTC','Quantity','Unit Market USD','Starting Unit Market USD','Unit Purchase Cost USD','Unit Sticker USD','Market Source','Market Source Date'],...holdings.flatMap(holding=>holding.lots.map(lot=>[names.get(lot.collectionId),lot.product.productId,lot.product.kind,lot.product.game,lot.product.name,lot.product.set,lot.product.printing,lot.addedAt,lot.quantity,dollars(holding.product.cents),dollars(lot.product.cents),dollars(lot.costCents),dollars(lot.stickerCents),holding.product.source,holding.product.asOf]))]);
}
export function soldCsv(sales:CollectionSale[],collections:OwnedCollection[],events:CardShowEvent[]){
 const names=new Map(collections.map(row=>[row.id,row.name])),shows=new Map(events.map(row=>[row.id,row.name]));
 return collectionCsv([['Sale ID','Allocation ID','Collection','Event','Sold At UTC','Product ID','Kind','Game','Name','Printing','Quantity','Net Proceeds USD','Recorded Cost USD','Card Profit USD'],...sales.map(row=>[row.saleId??null,row.id,names.get(row.collectionId),row.eventId?shows.get(row.eventId):null,row.date,row.product?.productId,row.product?.kind,row.product?.game,row.name,row.product?.printing,row.quantity,dollars(row.netCents),dollars(row.costCents),dollars(row.costCents===null?null:row.netCents-row.costCents)])]);
}
