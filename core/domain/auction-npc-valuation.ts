import type {AuctionCard,Clue} from './auction-types.ts';
import {applyNpcMarketPrior,type NpcValuationKnowledge} from './auction-npc-prior.ts';
import {auctionReferencePrice} from './auction-market-prior.ts';

// Inputs contain only information actually available to this bidder, never the lot.
type Knowledge=NpcValuationKnowledge;
const sum=(cards:AuctionCard[])=>cards.reduce((total,card)=>total+card.cents,0);
const money=(clue:Clue)=>[...clue.text.matchAll(/\$([\d,.]+)/g)].map(match=>Math.round(Number(match[1].replaceAll(',',''))*100));
export const npcConservativeMean=auctionReferencePrice;
function censusEstimate(knowledge:Knowledge,clue:Clue,discount:number){
 const field=clue.id==='sets'?'set':'rarity',groups=[...clue.text.matchAll(/(?:^| · )([^:]+): (\d+)/g)];
 const fallback=npcConservativeMean(knowledge.random.map(card=>card.cents))*.5;
 return groups.reduce((total,match)=>{
  const observed=knowledge.observed.filter(card=>card[field]===match[1]),samples=knowledge.random.filter(card=>card[field]===match[1]);
  const mean=samples.length?npcConservativeMean(samples.map(card=>card.cents)):fallback;
  return total+sum(observed)+Math.max(0,Number(match[2])-observed.length)*mean*discount;
 },0);
}
function categoryEstimate(knowledge:Knowledge,discount:number){
 const categories=knowledge.clues.filter(clue=>['bulk','rares'].includes(clue.id));
 if(!categories.length)return null;
 const includes=(card:AuctionCard)=>categories.some(clue=>clue.id==='bulk'?/^(common|uncommon)$/i.test(card.rarity):/^rare$/i.test(card.rarity));
 const exact=categories.reduce((total,clue)=>total+money(clue)[0],0),outside=knowledge.observed.filter(card=>!includes(card));
 // Zero-valued category samples preserve their observed population share. Their
 // aggregate is already counted; do not price them again as unknown stock.
 const mean=npcConservativeMean(knowledge.random.map(card=>includes(card)?0:card.cents));
 return exact+sum(outside)+mean*Math.max(0,knowledge.count-knowledge.observed.length)*discount;
}
function countEstimate(knowledge:Knowledge,discount:number){
 const counts=knowledge.clues.filter(clue=>['common-count','uncommon-count'].includes(clue.id));
 if(!counts.length)return null;
 const groups=counts.map(clue=>({rarity:clue.id==='common-count'?'common':'uncommon',count:parseInt(clue.text,10)}));
 groups.push({rarity:'other',count:Math.max(0,knowledge.count-groups.reduce((sum,group)=>sum+group.count,0))});
 const fallback=npcConservativeMean(knowledge.random.map(card=>card.cents))*.5;
 return groups.reduce((total,group)=>{
  const matches=(card:AuctionCard)=>group.rarity==='other'?!counts.some(clue=>card.rarity.toLowerCase()===(clue.id==='common-count'?'common':'uncommon')):card.rarity.toLowerCase()===group.rarity;
  const observed=knowledge.observed.filter(matches),samples=knowledge.random.filter(matches);
  const mean=samples.length?npcConservativeMean(samples.map(card=>card.cents)):fallback;
  return total+sum(observed)+Math.max(0,group.count-observed.length)*mean*discount;
 },0);
}
export function npcKnowledgeValue(knowledge:Knowledge){
 const repeats=knowledge.clues.find(clue=>clue.id==='duplicates'),density=repeats?Math.min(1,parseInt(repeats.text,10)/knowledge.count):0;
 // Repeated stock makes a tiny sample less independent, not automatically cheap.
 const observed=sum(knowledge.observed),discount=(.55+.4*Math.min(1,knowledge.random.length/20))*(1-.15*density);
 const mean=npcConservativeMean(knowledge.random.map(card=>card.cents));
 let estimate=observed+mean*Math.max(0,knowledge.count-knowledge.observed.length)*discount;
 let certainty=Math.min(.7,.2+knowledge.observed.length/knowledge.count);
 const census=knowledge.clues.find(clue=>clue.id==='rarities')??knowledge.clues.find(clue=>clue.id==='sets');
 if(census){estimate=censusEstimate(knowledge,census,discount);certainty=Math.max(certainty,.5)}
 const counted=census?null:countEstimate(knowledge,discount);
 if(counted!==null){estimate=counted;certainty=Math.max(certainty,.4)}
 const category=categoryEstimate(knowledge,discount);
 if(category!==null){estimate=category;certainty=Math.max(certainty,.65)}
 const top=knowledge.clues.find(clue=>clue.id==='top5')??knowledge.clues.find(clue=>clue.id==='top2');
 if(top){
  const value=money(top)[0],count=Math.min(top.id==='top2'?2:5,knowledge.count),prices=knowledge.random.map(card=>card.cents).toSorted((a,b)=>a-b);
  // The disclosed top-card subtotal supplies no identities. Use a conservative lower sample,
  // not a sample contaminated by chase hits, to estimate the remaining population.
  const remainder=npcConservativeMean(prices.slice(0,Math.max(1,Math.ceil(prices.length*.6))));
  estimate=value+Math.min(remainder,value/count)*Math.max(0,knowledge.count-count)*discount;certainty=Math.max(certainty,.7);
 }
 const appraisal=knowledge.clues.find(clue=>clue.id==='appraisal');
 if(appraisal){const [low,high]=money(appraisal);estimate=low+(high-low)*.25;certainty=.85}
 const band=knowledge.clues.find(clue=>clue.id==='value-band4')??knowledge.clues.find(clue=>clue.id==='value-band');
 if(band){
  const [low,high]=money(band),upper=high===undefined?Math.max(estimate,low):low+(high-low)*.25;
  estimate=band.id==='value-band4'?Math.max(low,Math.min(estimate,upper)):upper;
  certainty=band.id==='value-band4'?Math.max(certainty,.5):.65;
 }
 return applyNpcMarketPrior(knowledge,Math.max(observed,estimate),certainty);
}
