import {sampleIndices,holdingKey,type Auction,type AuctionCard,type Investigation} from './auction-types.ts';
import {auctionRarityBand} from './auction-copy-policy.ts';
import {auctionDrawBand} from './auction-composition.ts';

export const RETIRED_V2_INVESTIGATIONS=['rare-mark12','epic-mark8','alt-mark5','rare-identity8','epic-identity5','lot-audit','rarities-v2','bulk-v2','rares-v2'];
export const CENSUS_SPECIAL_BANDS=['over','signature','other'];
export function investigationCensusBand(card:AuctionCard){
 const band=auctionRarityBand(card);
 if(['metal','ultra-promo'].includes(auctionDrawBand(card)))return 'other';
 return !['alt','over','signature'].includes(band)&&/promo|showcase/i.test(`${card.section} ${card.rarity}`)?'other':band;
}
export const coreInvestigationCard=(card:AuctionCard)=>['common','uncommon','rare','epic'].includes(investigationCensusBand(card));
export const combinedMarkerCard=(card:AuctionCard)=>['rare','epic','alt'].includes(investigationCensusBand(card));
export const combinedIdentityCard=(card:AuctionCard)=>['rare','epic'].includes(auctionRarityBand(card))&&coreInvestigationCard(card);
export const REVISED_INVESTIGATIONS:Investigation[]=[
 {id:'core-mark10',label:'Rarity Markers',cost:500,tier:'basic',description:'Mark up to 10 RARE, EPIC or ALT-ART copies. Rarity and location only; no names, artwork or prices. Excludes Overnumbered, Signature, Metal and ultra-rare promos.'},
 {id:'core-identity10',label:'Rare & Epic Identity Peek',cost:600,tier:'targeted',description:'Reveal up to 10 RARE or EPIC copies: names and artwork, without prices. Excludes Alt Art, Overnumbered, Signature, Metal and ultra-rare promos.'},
 {id:'rarities-v3',label:'Rarity Census',cost:1200,tier:'basic',description:'Count Commons, Uncommons, Rares, Epics and Alt Arts. Overnumbered, Signature and all Other/Promo/Showcase cards share one Chase / Special count. No identities, locations or prices.'},
 {id:'bulk-core-v3',label:'Bulk Valuation',cost:800,tier:'targeted',description:'Exact combined market value of ALL ordinary COMMON, UNCOMMON, RARE and EPIC copies. Excludes Alt Art, chase treatments, Metal and ultra-rare promos. No identities or locations.'},
 {id:'alt-value-v3',label:'Alt-Art Valuation',cost:1000,tier:'strong',description:'Exact combined market value of ALL ALT-ART copies. No identities or locations; excludes Overnumbered, Signature and special-promo pools.'},
 {id:'lot-audit-v3',label:'Lot Audit',cost:400,tier:'basic',description:'Count sets, Commons, Uncommons, unique printings and duplicates. Reveal names, artwork and copy counts of the 3 most repeated ordinary printings, plus 3 random hidden rarity markers. No prices; repeated-printing peeks exclude Alt Art and special/chase cards.'},
];
export function revisedCategoryMatches(id:string,card:AuctionCard){
 return id==='bulk-core-v3'?coreInvestigationCard(card):id==='alt-value-v3'?auctionDrawBand(card)==='alt':false;
}
function hiddenSlots(auction:Auction,identity:boolean){
 return auction.lot.flatMap((card,slot)=>!(auction.known.includes(slot)||!identity&&auction.rarityKnown?.includes(slot))&&(identity?combinedIdentityCard(card):combinedMarkerCard(card))?[slot]:[]);
}
export function revisedUseful(auction:Auction,id:string):boolean|null{
 if(!REVISED_INVESTIGATIONS.some(option=>option.id===id))return null;
 if(auction.clues.some(clue=>clue.id===id))return false;
 if(id==='core-mark10'||id==='core-identity10')return hiddenSlots(auction,id==='core-identity10').length>0;
 if(id==='bulk-core-v3'||id==='alt-value-v3')return auction.lot.some((card,slot)=>revisedCategoryMatches(id,card)&&!auction.priced.includes(slot));
 return true;
}
function lotAudit(auction:Auction,known:Set<number>,rarityKnown:Set<number>){
 const sets=new Map<string,number>(),printings=new Map<string,number[]>();
 auction.lot.forEach((card,slot)=>{sets.set(card.set,(sets.get(card.set)??0)+1);const key=holdingKey(card);printings.set(key,[...(printings.get(key)??[]),slot]);});
 const repeated=[...printings.values()].filter(slots=>slots.length>1&&coreInvestigationCard(auction.lot[slots[0]])).sort((a,b)=>b.length-a.length||a[0]-b[0]).slice(0,3);
 // One representative identifies the printing, not the locations of every copy.
 repeated.forEach(slots=>known.add(slots[0]));
 const hidden=auction.lot.map((_,slot)=>slot).filter(slot=>!known.has(slot)&&!rarityKnown.has(slot));
 sampleIndices(hidden.length,3,auction.seed+auction.round*97).forEach(index=>rarityKnown.add(hidden[index]));
 const repeats=repeated.map(slots=>`${auction.lot[slots[0]].name} (${auction.lot[slots[0]].printing}): ${slots.length} copies`).join(' · ')||'No repeated ordinary printings.';
 return `Common copies: ${auction.lot.filter(card=>auctionRarityBand(card)==='common').length}\nUncommon copies: ${auction.lot.filter(card=>auctionRarityBand(card)==='uncommon').length}\nUnique printings: ${printings.size}\nDuplicate copies: ${auction.lot.length-printings.size}\nSets: ${[...sets].map(([set,count])=>`${set}: ${count}`).join(' · ')}\nMost repeated ordinary printings: ${repeats}\nUp to 3 hidden rarity markers added.`;
}
function groupedCensus(auction:Auction){
 const groups=[['Common','common'],['Uncommon','uncommon'],['Rare','rare'],['Epic','epic'],['Alt Art','alt'],['Chase / Special','special']];
 return groups.map(([label,band])=>`${label}: ${auction.lot.filter(card=>band==='special'?CENSUS_SPECIAL_BANDS.includes(investigationCensusBand(card)):investigationCensusBand(card)===band).length}`).join(' · ');
}
export function revisedResult(auction:Auction,option:Investigation){
 if(!REVISED_INVESTIGATIONS.some(row=>row.id===option.id))return null;
 const known=new Set(auction.known),priced=[...auction.priced],rarityKnown=new Set(auction.rarityKnown??[]);let text='';
 if(option.id==='core-mark10'||option.id==='core-identity10'){
  const identity=option.id==='core-identity10',candidates=hiddenSlots(auction,identity),slots=sampleIndices(candidates.length,10,auction.seed+auction.round*97).map(index=>candidates[index]);
  slots.forEach(slot=>identity?known.add(slot):rarityKnown.add(slot));
  text=identity?`${slots.length} Rare / Epic identities revealed without prices.`:`${slots.length} Rare / Epic / Alt-Art rarity markers added. Identities and prices remain hidden.`;
 }else if(option.id==='rarities-v3')text=groupedCensus(auction);
 else if(option.id==='lot-audit-v3')text=lotAudit(auction,known,rarityKnown);
 else text=`$${(auction.lot.filter(card=>revisedCategoryMatches(option.id,card)).reduce((sum,card)=>sum+card.cents,0)/100).toFixed(2)}`;
 return {known:[...known],priced,rarityKnown:[...rarityKnown],clue:{id:option.id,label:option.label,text}};
}
