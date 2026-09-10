import type {EbayAskHistoryPoint,EbayListingSample} from "./domain/types.ts";

export type EbayAskHistoryMetrics={
 change7:number|null;change30:number|null;supplyChange7:number|null;supplyChange30:number|null;
 newListings:number|null;missingListings:number|null;priceReductions:number|null;
};

const percentChange=(current:number|null,prior:number|null)=>current!=null&&prior!=null&&prior>0?(current-prior)/prior*100:null;
const pointAtOrBefore=(points:EbayAskHistoryPoint[],timestamp:number)=>[...points].reverse().find(point=>Date.parse(point.observedAt)<=timestamp)??null;

export function summarizeEbayAskHistory(points:EbayAskHistoryPoint[],now?:Date):EbayAskHistoryMetrics{
 const ordered=[...points].filter(point=>Number.isFinite(Date.parse(point.observedAt))).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const latest=ordered.at(-1)??null,at=now?.getTime()??(latest?Date.parse(latest.observedAt):Date.now());
 const prior7=pointAtOrBefore(ordered,at-7*86_400_000),prior30=pointAtOrBefore(ordered,at-30*86_400_000);
 return {change7:percentChange(latest?.medianDeliveredAsk??null,prior7?.medianDeliveredAsk??null),change30:percentChange(latest?.medianDeliveredAsk??null,prior30?.medianDeliveredAsk??null),
  supplyChange7:latest&&prior7?latest.acceptedCount-prior7.acceptedCount:null,supplyChange30:latest&&prior30?latest.acceptedCount-prior30.acceptedCount:null,
  newListings:latest?.newListingCount??null,missingListings:latest?.missingListingCount??null,priceReductions:latest?.priceReductionCount??null};
}

export function ebayListingDeltas(previous:EbayListingSample[]|null,current:EbayListingSample[]){
 if(previous==null)return {newListingCount:null,missingListingCount:null,priceReductionCount:null};
 const before=new Map(previous.map(item=>[item.itemId,item.deliveredPrice??item.price])),after=new Map(current.map(item=>[item.itemId,item.deliveredPrice??item.price]));
 return {newListingCount:[...after.keys()].filter(id=>!before.has(id)).length,missingListingCount:[...before.keys()].filter(id=>!after.has(id)).length,
  priceReductionCount:[...after].filter(([id,price])=>before.has(id)&&price<before.get(id)!-.009).length};
}
