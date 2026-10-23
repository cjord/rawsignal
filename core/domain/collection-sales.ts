import {validCents,validEventDay,type CardShowEvent,type CollectionLot,type CollectionSale,type Holding,type OwnedCollections} from './owned-collections.ts';

export const saleGroupKey=(sale:CollectionSale)=>sale.saleId?`sale:${sale.saleId}`:`legacy:${sale.id}`;
export function saleTotals(sales:CollectionSale[]){
 const known=sales.filter(row=>row.costCents!==null),quantity=sales.reduce((sum,row)=>sum+row.quantity,0),costedQuantity=known.reduce((sum,row)=>sum+row.quantity,0);
 return {quantity,costedQuantity,proceeds:sales.reduce((sum,row)=>sum+row.netCents,0),cost:known.length||!sales.length?known.reduce((sum,row)=>sum+row.costCents!,0):null,profit:known.length||!sales.length?known.reduce((sum,row)=>sum+row.netCents-row.costCents!,0):null};
}
export function collectionPerformance(holdings:Holding[],sales:CollectionSale[],expenses=0){
 const sold=saleTotals(sales);let quantity=0,costedQuantity=0,profit=0;
 for(const holding of holdings)for(const lot of holding.lots){quantity+=lot.quantity;if(lot.costCents!==null&&holding.product.cents!==null){costedQuantity+=lot.quantity;profit+=(holding.product.cents-lot.costCents)*lot.quantity}}
 const unrealized=costedQuantity||!quantity?profit:null;
 const hasKnown=costedQuantity+sold.costedQuantity>0||quantity+sold.quantity===0;
 return {realized:sold.profit,unrealized,combined:hasKnown?(sold.profit??0)+(unrealized??0)-expenses:null,expenses,quantity,costedQuantity,soldQuantity:sold.quantity,costedSoldQuantity:sold.costedQuantity};
}
export function groupedSales(sales:CollectionSale[]){
 const groups=new Map<string,CollectionSale[]>();for(const sale of sales){const key=saleGroupKey(sale),rows=groups.get(key)??[];rows.push(sale);groups.set(key,rows)}
 return [...groups].map(([key,rows])=>({key,rows,first:rows[0],...saleTotals(rows)})).sort((a,b)=>b.first.date.localeCompare(a.first.date)||b.key.localeCompare(a.key));
}
export function stickerSaleSuggestion(lots:CollectionLot[],quantity:number){
 if(!Number.isSafeInteger(quantity)||quantity<1)return null;let remaining=quantity,total=0;
 for(const lot of lots){if(remaining===0)break;const amount=Math.min(remaining,lot.quantity);if(amount&&lot.stickerCents===null)return null;total+=amount*(lot.stickerCents??0);remaining-=amount}
 return remaining?null:total;
}
type EventAction={type:string;eventId?:string|null;name?:string;date?:string;expensesCents?:number;groupKey?:string};
export function applyEventAction(state:OwnedCollections,action:EventAction,now:string,newId:()=>string):OwnedCollections{
 const events=state.events??[];
 if(action.type==='sale-event'){
  if(action.eventId!==null&&!events.some(row=>row.id===action.eventId))throw new Error('Choose an existing card show event');
  if(!state.sales.some(row=>saleGroupKey(row)===action.groupKey))throw new Error('Sale not found');
  return {...state,sales:state.sales.map(row=>saleGroupKey(row)===action.groupKey?{...row,eventId:action.eventId}:row)};
 }
 if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>80||!validEventDay(action.date)||!validCents(action.expensesCents))throw new Error('Enter an event name, valid date and nonnegative paid expenses');
 const previous=events.find(row=>row.id===action.eventId);if(action.eventId&&!previous)throw new Error('Card show event not found');if(!previous&&events.length>=100)throw new Error('This release supports 100 card show events');
 const event:CardShowEvent={id:previous?.id??newId(),name:action.name.trim(),date:action.date,expensesCents:action.expensesCents,createdAt:previous?.createdAt??now};
 return {...state,events:previous?events.map(row=>row.id===event.id?event:row):[...events,event]};
}
