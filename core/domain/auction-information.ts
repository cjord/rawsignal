import {sampleIndices,type Auction,type AuctionCard,type Clue,type Investigation} from "./auction-types.ts";

export const INVESTIGATIONS:Investigation[]=[
 {id:"count",label:"Exact card count",cost:500,tier:"basic"},
 {id:"sets",label:"Set breakdown",cost:500,tier:"basic"},
 {id:"rarities",label:"Rarity breakdown",cost:1000,tier:"basic"},
 {id:"duplicates",label:"Duplicate count",cost:1000,tier:"basic"},
 {id:"over5",label:"Copies worth over $5",cost:1500,tier:"basic"},
 {id:"reveal3",label:"Reveal 3 cards with prices",cost:2000,tier:"targeted"},
 {id:"identity3",label:"Reveal 3 card identities",cost:2000,tier:"targeted"},
 {id:"bulk",label:"Common/uncommon total value",cost:1500,tier:"targeted"},
 {id:"over20",label:"Copies worth over $20",cost:2500,tier:"targeted"},
 {id:"highest",label:"Highest-value identity (no price)",cost:4000,tier:"strong"},
 {id:"rares",label:"Rare total value",cost:4000,tier:"strong"},
 {id:"share",label:"Top 3 copies' value share",cost:3000,tier:"strong"},
 {id:"top5",label:"Top 5 copies' combined value",cost:6000,tier:"premium"},
 {id:"identity10",label:"Reveal 10 identities",cost:4500,tier:"premium"},
 {id:"appraisal",label:"Approximate market appraisal",cost:7500,tier:"premium"},
];
const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
const sum=(cards:AuctionCard[])=>cards.reduce((value,card)=>value+card.cents,0);
const tiers=[['basic','basic','targeted'],['basic','targeted','strong'],['targeted','strong','premium'],['targeted','strong','premium']];
export function informationOffers(auction:Auction):Investigation[]{
 const eligible=INVESTIGATIONS.filter(option=>!auction.clues.some(clue=>clue.id===option.id)&&informationUseful(auction,option.id));
 const picked:Investigation[]=[];
 for(const [index,tier] of tiers[auction.round-1].entries()){
  const remaining=eligible.filter(option=>!picked.includes(option)),preferred=remaining.filter(option=>option.tier===tier),pool=preferred.length?preferred:remaining;
  if(pool.length)picked.push(pool[sampleIndices(pool.length,1,auction.seed+auction.round*31+index)[0]]);
 }
 return picked;
}
function informationUseful(auction:Auction,id:string){
 if(id==='count')return false; // Every copy now has a visible slot; retain old saved clues.
 if(id==='reveal3')return auction.priced.length<auction.lot.length;
 if(id.startsWith('identity'))return auction.known.length<auction.lot.length;
 if(id==='highest'){const maximum=Math.max(...auction.lot.map(card=>card.cents));return !auction.known.some(index=>auction.lot[index].cents===maximum)}
 return true;
}
function breakdown(cards:AuctionCard[],key:'set'|'rarity'){
 const groups=new Map<string,number>();for(const card of cards)groups.set(card[key],(groups.get(card[key])??0)+1);
 return [...groups.entries()].map(([name,count])=>`${name}: ${count}`).join(' · ');
}
export function investigate(auction:Auction,option:Investigation):{known:number[];priced:number[];clue:Clue}{
 const {lot}=auction,known=new Set(auction.known),priced=new Set(auction.priced);let text='';
 if(option.id==='count')text=`${lot.length} copies.`;
 if(option.id==='sets')text=breakdown(lot,'set');
 if(option.id==='rarities')text=breakdown(lot,'rarity');
 if(option.id==='duplicates')text=`${lot.length-new Set(lot.map(card=>`${card.productId}:${card.printing}`)).size} duplicate copies.`;
 if(option.id==='over5'||option.id==='over20')text=`${lot.filter(card=>card.cents>(option.id==='over5'?500:2000)).length} copies.`;
 if(option.id==='bulk')text=money(sum(lot.filter(card=>['common','uncommon'].includes(card.rarity.toLowerCase()))));
 if(option.id==='rares')text=money(sum(lot.filter(card=>card.rarity.toLowerCase()==='rare')));
 if(option.id==='top5')text=money(sum([...lot].sort((a,b)=>b.cents-a.cents).slice(0,5)));
 if(option.id==='share')text=`${Math.round(sum([...lot].sort((a,b)=>b.cents-a.cents).slice(0,3))/sum(lot)*100)}% of collection value.`;
 if(option.id==='appraisal')text=`${money(Math.floor(sum(lot)*.8/1000)*1000)}–${money(Math.ceil(sum(lot)*1.2/1000)*1000)} (game appraisal estimate).`;
 if(option.id==='highest'){const index=lot.findIndex(card=>card.cents===Math.max(...lot.map(row=>row.cents)));known.add(index);text=lot[index].name}
 if(['reveal3','identity3','identity10'].includes(option.id)){
  const indices=sampleIndices(lot.length,option.id==='identity10'?10:3,auction.seed+auction.round*47,option.id==='reveal3'?auction.priced:auction.known);
  for(const index of indices){known.add(index);if(option.id==='reveal3')priced.add(index)}
  text=`${indices.length} copies revealed${option.id==='reveal3'?' with prices':' without prices'}.`;
 }
 return {known:[...known],priced:[...priced],clue:{id:option.id,label:option.label,text}};
}
export const knownValue=(auction:Auction)=>auction.priced.reduce((sum,index)=>sum+auction.lot[index].cents,0);
