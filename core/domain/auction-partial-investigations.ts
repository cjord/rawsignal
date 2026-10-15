import {sampleIndices,type Auction,type Investigation} from './auction-types.ts';
import {auctionRarityBand} from './auction-copy-policy.ts';

const specs=[
 {id:'rarity-peek3',label:'Rarity Peek',description:'Mark the rarity of up to 3 random hidden copies. No names, artwork or prices.',cost:400,tier:'basic',mode:'rarity',band:'any',count:3},
 {id:'rare-mark2',label:'Rare Markers',description:'Locate up to 2 regular rare copies. Cards stay face down; no identities or prices.',cost:600,tier:'basic',mode:'rarity',band:'rare',count:2},
 {id:'epic-mark2',label:'Epic Markers',description:'Locate up to 2 regular epic copies. Cards stay face down; no identities or prices.',cost:1000,tier:'targeted',mode:'rarity',band:'epic',count:2},
 {id:'alt-mark1',label:'Alt-Art Marker',description:'Locate 1 alt-art copy without revealing its identity or price.',cost:1200,tier:'targeted',mode:'rarity',band:'alt',count:1},
 {id:'chase-mark1',label:'Chase Marker',description:'Locate 1 overnumbered or signature copy; reveal only its rarity.',cost:1800,tier:'strong',mode:'rarity',band:'chase',count:1},
 {id:'rare-identity2',label:'Rare Identity Peek',description:'Reveal up to 2 regular rare names and artworks, without prices.',cost:1200,tier:'targeted',mode:'identity',band:'rare',count:2},
 {id:'epic-identity2',label:'Epic Identity Peek',description:'Reveal up to 2 regular epic names and artworks, without prices.',cost:1800,tier:'strong',mode:'identity',band:'epic',count:2},
 {id:'chase-identity1',label:'Chase Identity Peek',description:'Reveal 1 overnumbered or signature name and artwork, without its price.',cost:3500,tier:'premium',mode:'identity',band:'chase',count:1},
] as const;
export const PARTIAL_INVESTIGATIONS:Investigation[]=specs.map(({id,label,description,cost,tier})=>({id,label,description,cost,tier}));
export function partialInvestigationSlots(auction:Auction,id:string){
 const spec=specs.find(option=>option.id===id);if(!spec)return null;
 return auction.lot.flatMap((card,index)=>{
  if(auction.known.includes(index)||spec.mode==='rarity'&&auction.rarityKnown?.includes(index))return [];
  const band=auctionRarityBand(card),matches=spec.band==='any'||spec.band===band||spec.band==='chase'&&(band==='over'||band==='signature');
  return matches?[index]:[];
 });
}
export function investigatePartial(auction:Auction,option:Investigation){
 const spec=specs.find(row=>row.id===option.id);if(!spec)return null;
 const candidates=partialInvestigationSlots(auction,option.id)!;
 const slots=sampleIndices(candidates.length,spec.count,auction.seed+auction.round*97).map(index=>candidates[index]);
 const known=spec.mode==='identity'?[...new Set([...auction.known,...slots])]:[...auction.known];
 const rarityKnown=spec.mode==='rarity'?[...new Set([...(auction.rarityKnown??[]),...slots])]:[...(auction.rarityKnown??[])];
 const text=spec.mode==='rarity'?`${slots.length} rarity markers added. Identities and prices remain hidden.`:`${slots.length} identities revealed without prices.`;
 return {known,priced:[...auction.priced],rarityKnown,clue:{id:option.id,label:option.label,text}};
}
