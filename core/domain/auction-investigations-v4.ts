import {sampleIndices,type Auction,type Investigation} from './auction-types.ts';
import {followUpSlots,rebalancedResult} from './auction-investigations-v2.ts';
import {revisedResult} from './auction-investigations-v3.ts';

export const RETIRED_V3_INVESTIGATIONS=['reveal5','chase-identity-v2','chase-scan-v2','rarities-v3','top2-final','follow-up'];
export const SCAN_INVESTIGATIONS:Investigation[]=[
 {id:'price-small4',label:'Small Price Scan',cost:500,tier:'targeted',description:'Reveal up to 4 random cards: names, artwork and prices.'},
 {id:'price-large7',label:'Large Price Scan',cost:800,tier:'strong',description:'Reveal up to 7 random cards: names, artwork and prices.'},
 {id:'chase-identity-v4',label:'Chase Identity Peek',cost:1500,tier:'premium',description:'Reveal 1 hidden OVERNUMBERED or SIGNATURE card: name and artwork, without price.'},
 {id:'chase-scan-v4',label:'Chase Scan',cost:2000,tier:'premium',description:'Reveal 1 unpriced OVERNUMBERED or SIGNATURE card: name, artwork and price.'},
 {id:'rarities-v4',label:'Rarity Census',cost:1000,tier:'basic',description:'Count Commons, Uncommons, Rares, Epics and Alt Arts. Overnumbered, Signature and all Other/Promo/Showcase cards share one Chase / Special count. No identities, locations or prices.'},
 {id:'top-three-peek',label:'Top-Three Price Peek',cost:4000,tier:'premium',description:'Round 4 only. Reveal 1 randomly selected unpriced card from the 3 most valuable cards: name, artwork and price.'},
 {id:'follow-up-v4',label:'Follow-Up Inspection',cost:500,tier:'targeted',description:'Choose a highlighted card in the collection after purchase. Reveals 1 card marked by an earlier investigation, including its price. An unused inspection picks randomly when time expires or bidding ends.'},
];
export function topThreeSlots(auction:Auction){return auction.lot.map((_,slot)=>slot).sort((a,b)=>auction.lot[b].cents-auction.lot[a].cents||a-b).slice(0,3).filter(slot=>!auction.priced.includes(slot));}
export function scanResult(auction:Auction,option:Investigation,targetSlot?:number){
 if(!SCAN_INVESTIGATIONS.some(row=>row.id===option.id))return null;
 const alias=({'chase-identity-v4':'chase-identity-v2','chase-scan-v4':'chase-scan-v2','rarities-v4':'rarities-v3','follow-up-v4':'follow-up'} as Record<string,string>)[option.id];
 if(alias){
  const result=revisedResult(auction,{...option,id:alias})??rebalancedResult(auction,{...option,id:alias},targetSlot);
  return result?{...result,clue:{...result.clue,id:option.id,label:option.label}}:null;
 }
 const candidates=option.id==='top-three-peek'?topThreeSlots(auction):auction.lot.map((_,slot)=>slot).filter(slot=>!auction.priced.includes(slot));
 const count=option.id==='price-small4'?4:option.id==='price-large7'?7:1;
 const slots=sampleIndices(candidates.length,count,auction.seed+auction.round*97).map(index=>candidates[index]);
 return {known:[...new Set([...auction.known,...slots])],priced:[...new Set([...auction.priced,...slots])],clue:{id:option.id,label:option.label,text:`${slots.length} ${slots.length===1?'card':'cards'} revealed with prices.`}};
}
export function scanUseful(auction:Auction,id:string){
 if(!SCAN_INVESTIGATIONS.some(row=>row.id===id))return null;
 if(id==='top-three-peek')return auction.round===4&&topThreeSlots(auction).length>0;
 if(id==='follow-up-v4')return followUpSlots(auction).length>0;
 return true;
}
export const investigationDescription=(text:string)=>text.replace(/\bcopies\b/gi,'cards').replace(/\bcopy\b/gi,'card').replace(/(\$[\d,]+)\.00\b/g,'$1').replace(/\b(?:COMMONS?|UNCOMMONS?|RARES?|EPICS?|ALT[- ]ARTS?|OVERNUMBERED|SIGNATURES?|PROMOS?|SHOWCASE|METAL)\b/g,rarity=>rarity.toLowerCase().replace(/\b[a-z]/g,letter=>letter.toUpperCase())).replace(/\bALL\b/g,'all');
