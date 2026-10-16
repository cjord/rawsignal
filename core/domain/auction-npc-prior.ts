import {auctionRarityBand} from './auction-copy-policy.ts';
import {priorMean} from './auction-market-prior.ts';
import {CENSUS_SPECIAL_BANDS,investigationCensusBand} from './auction-investigations-v3.ts';
import {npcCategoryFacts} from './auction-npc-category-value.ts';
import type {AuctionCard,AuctionMarketPrior,AuctionKind,Clue} from './auction-types.ts';

export type NpcValuationKnowledge={count:number;observed:AuctionCard[];random:AuctionCard[];clues:Clue[];prior?:AuctionMarketPrior;round?:number;kind?:AuctionKind;markedBands?:string[]};
type Knowledge=NpcValuationKnowledge;
// Blend only the uncertain remainder, never discount an actually disclosed price.
// Gameplay calibration, not bid targets/floors: strong evidence can exceed these.
export const NPC_SPECULATION_WEIGHTS={free:[.14,.11,.085,.06],paid:[.20,.18,.15,.12]} as const;
const labels:Record<string,string>={Common:'common',Uncommon:'uncommon',Rare:'rare',Epic:'epic','Alt Art':'alt',Overnumbered:'over',Signature:'signature',Other:'other','Chase / Special':'special'};
const countBands=(band:string)=>band==='special'?CENSUS_SPECIAL_BANDS:[band];
function disclosedCounts(clues:Clue[]){
 // An already purchased legacy full census remains earned information.
 const census=clues.find(clue=>clue.id==='rarities-v2')??clues.find(clue=>clue.id==='rarities-v3'),counts=new Map<string,number>();
 if(census){for(const match of census.text.matchAll(/(?:^| · )([^:]+): (\d+)/g))if(labels[match[1]])counts.set(labels[match[1]],Number(match[2]));const bands=census.id==='rarities-v3'?['common','uncommon','rare','epic','alt','special']:['common','uncommon','rare','epic','alt',...CENSUS_SPECIAL_BANDS];for(const band of bands)if(!counts.has(band))counts.set(band,0);}
 for(const band of ['common','uncommon']){const clue=clues.find(clue=>clue.id===`${band}-count`);if(clue)counts.set(band,parseInt(clue.text,10));}
 return counts;
}
function expectation(knowledge:Knowledge){
 const prior=knowledge.prior!,counts=disclosedCounts(knowledge.clues),known=knowledge.observed,marked=knowledge.markedBands??[];
 const bandOf=!knowledge.clues.some(clue=>clue.id==='rarities-v2')&&knowledge.clues.some(clue=>clue.id==='rarities-v3')?investigationCensusBand:auctionRarityBand;
 let value=known.reduce((sum,card)=>sum+card.cents,0)+marked.reduce((sum,band)=>sum+priorMean(prior,[band],true),0),remaining=knowledge.count-known.length-marked.length;
 for(const [band,count] of counts){const bands=countBands(band),unknown=Math.max(0,count-known.filter(card=>bands.includes(bandOf(card))).length-marked.filter(value=>bands.includes(value)).length);value+=unknown*priorMean(prior,bands,true);remaining-=unknown;}
 const counted=[...counts.keys()].flatMap(countBands),missing=prior.bands.filter(row=>!counted.includes(row.band)).map(row=>row.band);
 value+=Math.max(0,remaining)*priorMean(prior,missing);
 return value;
}
function evidenceFloor(knowledge:Knowledge){
 const observed=knowledge.observed.reduce((sum,card)=>sum+card.cents,0);
 let floor=Math.max(observed,npcCategoryFacts(knowledge)?.floor??0);
 for(const clue of knowledge.clues){
  if(clue.id==='over5-mark'||clue.id==='over20-mark'){
   const threshold=clue.id==='over5-mark'?500:2000,count=parseInt(clue.text,10),known=knowledge.observed.filter(card=>card.cents>threshold).length;
   floor=Math.max(floor,observed+Math.max(0,count-known)*(threshold+1));
  }
  if(clue.id==='concentration'){
   const knownTop=[...knowledge.observed].sort((a,b)=>b.cents-a.cents).slice(0,3).reduce((sum,card)=>sum+card.cents,0);
   if(clue.text.startsWith('Low'))floor=Math.max(floor,Math.floor(knownTop/.3)+1);
   if(clue.text.startsWith('Medium'))floor=Math.max(floor,Math.floor(knownTop/.6)+1);
  }
 }
 return floor;
}
export function applyNpcMarketPrior(knowledge:Knowledge,estimate:number,certainty:number){
 const floor=evidenceFloor(knowledge);estimate=Math.max(floor,estimate);
 if(!knowledge.prior)return {estimate,certainty};
 const exactTop=knowledge.clues.some(clue=>['top2','top5','appraisal','value-band','value-band4'].includes(clue.id));
 if(exactTop)return {estimate,certainty};
 // A small cheap sample does not prove that rare hits are absent. Evidence from
 // category counts progressively replaces this catalog prior; no actual lot total
 // or another bidder's private findings enters this calculation.
 const round=knowledge.round??1,weight=NPC_SPECULATION_WEIGHTS[knowledge.kind??'free'][round-1]*Math.max(0,1-knowledge.observed.length/Math.max(1,knowledge.count));
 const expected=expectation(knowledge),observed=knowledge.observed.reduce((sum,card)=>sum+card.cents,0);
 // Disclosed category counts are evidence, not the blind starting prior. They
 // remain useful in round four, as do individually marked hidden rarities.
 if(knowledge.clues.some(clue=>['rarities-v2','rarities-v3'].includes(clue.id)))return {estimate:Math.round(Math.max(floor,expected)),certainty:Math.max(certainty,.65)};
 const marked=knowledge.markedBands??[],unknown=Math.max(1,knowledge.count-knowledge.observed.length);
 const replacement=marked.reduce((sum,band)=>sum+priorMean(knowledge.prior,[band],true),0)-marked.length*(estimate-observed)/unknown;
 estimate=Math.max(observed,estimate+replacement);
 return {estimate:Math.round(Math.max(floor,estimate*(1-weight)+expected*weight)),certainty};
}
