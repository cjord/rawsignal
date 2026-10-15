import {sampleIndices,type Auction,type AuctionCard,type Clue,type Investigation} from "./auction-types.ts";
import {RARITY_INVESTIGATIONS,rarityInvestigationSlots} from './auction-rarity-investigations.ts';
import {PARTIAL_INVESTIGATIONS,partialInvestigationSlots,investigatePartial} from './auction-partial-investigations.ts';
import {balancedClue} from './auction-balanced-clues.ts';

// Retain old definitions for active saves and historic NPC clues, never new offers.
export const RETIRED_INVESTIGATION_IDS=['count','rarity-peek3','rare-mark2','epic-mark2','alt-mark1','rare-identity2','epic-identity2','common3','uncommon3','rare2','epic2','alt1','highest','appraisal','value-band'];

export const INVESTIGATIONS:Investigation[]=[
 ...PARTIAL_INVESTIGATIONS,
 ...RARITY_INVESTIGATIONS,
 {id:"count",label:"Exact card count",cost:500,tier:"basic"},
 {id:"sets",label:"Set Census",description:"Count copies from each expansion.",cost:200,tier:"basic"},
 {id:"rarities",label:"Rarity Census",description:"Count copies in each rarity.",cost:1200,tier:"basic"},
 {id:"duplicates",label:"Duplicate Check",description:"Count repeated copies, not unique cards.",cost:300,tier:"basic"},
 {id:"over5",label:"$5 Price Check",description:"Count copies with market value above $5.",cost:1500,tier:"basic"},
 {id:'common-count',label:'Common Count',description:'Count every common copy in the lot. No identities or prices.',cost:200,tier:'basic'},
 {id:'uncommon-count',label:'Uncommon Count',description:'Count every uncommon copy in the lot. No identities or prices.',cost:300,tier:'basic'},
 {id:'highest-rarity',label:'Top Card Rarity',description:'Mark the most valuable card’s location and rarity. No name, artwork or price.',cost:800,tier:'targeted'},
 {id:'value-band',label:'Collection Value Band',description:'Show a broad fixed bracket for total market value, before fees. Available in rounds 3–4.',cost:3000,tier:'premium'},
 {id:'value-band4',label:'Collection Value Band',description:'Show a wide fixed bracket for total market value, before fees. Available only in round 4.',cost:3000,tier:'premium'},
 {id:"reveal3",label:"Random Price Scan",description:"Reveal up to 3 unpriced copies and their prices.",cost:1200,tier:"targeted"},
 {id:"identity3",label:"Identity Peek",description:"Reveal up to 3 names and artworks, without prices.",cost:600,tier:"targeted"},
 {id:"bulk",label:"Bulk Valuation",description:"Exact combined market value of common and uncommon copies.",cost:1500,tier:"targeted"},
 {id:"over20",label:"$20 Price Check",description:"Count copies with market value above $20.",cost:2500,tier:"targeted"},
 {id:"highest",label:"Top Card Peek",description:"Reveal the most valuable card identity, without its price.",cost:1200,tier:"strong"},
 {id:"rares",label:"Rare Valuation",description:"Exact combined market value of Rare-rarity copies.",cost:1500,tier:"strong"},
 {id:"share",label:"Top-Three Share",description:"Show the percentage of total value in the three highest-value copies.",cost:1800,tier:"strong"},
 {id:"top5",label:"Top-Five Valuation",description:"Exact combined market value of the five highest-value copies.",cost:3500,tier:"premium"},
 {id:"identity10",label:"Binder Preview",description:"Reveal up to 10 names and artworks, without prices.",cost:1600,tier:"premium"},
 {id:"appraisal",label:"Collection Appraisal",description:"Show an approximate 80–120% market-value range.",cost:6000,tier:"premium"},
];
// Active version-1 saves retain their already-offered prices; new rounds use current prices.
export const PREVIOUS_INVESTIGATION_COSTS:Record<string,number>={count:500,sets:300,rarities:800,duplicates:500,over5:1200,reveal3:2500,identity3:1000,bulk:2500,over20:2000,highest:1500,rares:3500,share:3000,top5:5000,identity10:2500,appraisal:10000};
export const PRE_BALANCE_INVESTIGATION_COSTS:Record<string,number>={rarities:400,over5:600,over20:1000,rares:2000};
export const LEGACY_INVESTIGATION_COSTS:Record<string,number>={count:500,sets:500,rarities:1000,duplicates:1000,over5:1500,reveal3:2000,identity3:2000,bulk:1500,over20:2500,highest:4000,rares:4000,share:3000,top5:6000,identity10:4500,appraisal:7500};
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
export function informationUseful(auction:Auction,id:string){
 if(RETIRED_INVESTIGATION_IDS.includes(id))return false;
 if(id==='value-band4')return auction.round===4;
 if(['common-count','uncommon-count'].includes(id))return !auction.clues.some(clue=>clue.id==='rarities');
 const partialSlots=partialInvestigationSlots(auction,id);if(partialSlots!==null)return partialSlots.length>0;
 const raritySlots=rarityInvestigationSlots(auction,id);if(raritySlots!==null)return raritySlots.length>0;
 if(id==='reveal3')return auction.priced.length<auction.lot.length;
 if(id.startsWith('identity'))return auction.known.length<auction.lot.length;
 return true;
}
function breakdown(cards:AuctionCard[],key:'set'|'rarity'){
 const groups=new Map<string,number>();for(const card of cards)groups.set(card[key],(groups.get(card[key])??0)+1);
 return [...groups.entries()].map(([name,count])=>`${name}: ${count}`).join(' · ');
}
export function investigate(auction:Auction,option:Investigation):{known:number[];priced:number[];rarityKnown?:number[];topCardSlot?:number;clue:Clue}{
 const partial=investigatePartial(auction,option);if(partial)return partial;
 const balanced=balancedClue(auction,option);if(balanced)return balanced;
 const {lot}=auction,known=new Set(auction.known),priced=new Set(auction.priced);let text='';
 const candidates=rarityInvestigationSlots(auction,option.id);
 if(candidates!==null){
  const count=Number(/\d+$/.exec(option.id)?.[0]??1);
  const indices=sampleIndices(candidates.length,count,auction.seed+auction.round*47).map(index=>candidates[index]);
  for(const index of indices){known.add(index);priced.add(index)}
  text=`${indices.length} copies revealed with prices.`;
 }
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
