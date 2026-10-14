import type {Card, SinglesGame} from "./types.ts";

export type PriceGameCard = Pick<Card,"productId"|"name"|"image"|"printing"|"section"|"rarity"> & {marketPrice:number};
export type PriceGameDifficulty = "normal" | "hard";
export const priceInCents = (price:number) => Math.round((price+Number.EPSILON)*100);

// Names and artwork are the only clues: do not quiz indistinguishable printings
// with different prices. Preserve catalog identity; this is not feed deduplication.
export function priceGamePool(cards:Card[], game:SinglesGame):PriceGameCard[]{
 const eligible=cards.filter(card=>card.game===game&&card.image.trim()&&card.name&&card.marketPrice!=null&&Number.isFinite(card.marketPrice)&&priceInCents(card.marketPrice)>0);
 const groups=new Map<string,Card[]>();
 for(const card of eligible){
  const key=`${card.name.toLowerCase().trim()}|${card.image.replace(/\?.*$/,"").replace(/_(?:200|400)w/,"")}`;
  groups.set(key,[...(groups.get(key)??[]),card]);
 }
 return [...groups.values()].filter(group=>new Set(group.map(card=>priceInCents(card.marketPrice!))).size===1)
  .map(group=>({...group[0],marketPrice:priceInCents(group[0].marketPrice!)/100}));
}

export const PRICE_ROUND_WEIGHTS={same:.7,similar:.25,random:.05} as const;
export const PRICE_RARITY_ORDER=["common","uncommon","rare","epic","alt-art","showcase","overnumbered","signature"] as const;
export function priceGameRarity(card:PriceGameCard):string{
 const sectionTier:Record<string,string>={signatures:"signature",overnumbered:"overnumbered","alt-arts":"alt-art","riftbound-showcases":"showcase","metal-promos":"metal","riftbound-promos":"promo","riftbound-foreign-promos":"promo"};
 return sectionTier[card.section]??card.rarity?.trim().toLowerCase()??"unclassified";
}
export function priceRoundStyle(roll:number):"same"|"similar"|"random"{
 return roll<PRICE_ROUND_WEIGHTS.same?"same":roll<PRICE_ROUND_WEIGHTS.same+PRICE_ROUND_WEIGHTS.similar?"similar":"random";
}
function shuffled<T>(items:readonly T[],random:()=>number):T[]{
 const shuffled=[...items];
 for(let index=shuffled.length-1;index>0;index--){
  const swap=Math.floor(random()*(index+1));
  [shuffled[index],shuffled[swap]]=[shuffled[swap],shuffled[index]];
 }
 return shuffled;
}
const compatible=(card:PriceGameCard,other:PriceGameCard)=>other.productId!==card.productId&&other.name.toLowerCase()!==card.name.toLowerCase()&&other.image!==card.image&&priceInCents(other.marketPrice)!==priceInCents(card.marketPrice);
function findRound(pool:PriceGameCard[],count:number,previous:number[],random:()=>number,mixed=false):PriceGameCard[]{
 if(new Set(pool.map(card=>priceInCents(card.marketPrice))).size<count)return [];
 const cards=shuffled(pool,random),ordered=[...cards.filter(card=>!previous.includes(card.productId)),...cards.filter(card=>previous.includes(card.productId))];
 function search(picked:PriceGameCard[],start:number):PriceGameCard[]|null{
  if(picked.length===count)return !mixed||new Set(picked.map(priceGameRarity)).size>1?picked:null;
  for(let index=start;index<ordered.length;index++){
   const card=ordered[index];if(!picked.every(other=>compatible(card,other)))continue;
   const result=search([...picked,card],index+1);if(result)return result;
  }
  return null;
 }
 return search([],0)??[];
}
function nearbyRarityPools(groups:Map<string,PriceGameCard[]>):PriceGameCard[][]{
 const pairs:PriceGameCard[][]=[];
 for(let index=0;index<PRICE_RARITY_ORDER.length-1;index++){
  const left=groups.get(PRICE_RARITY_ORDER[index]),right=groups.get(PRICE_RARITY_ORDER[index+1]);
  if(left&&right)pairs.push([...left,...right]);
 }
 return pairs;
}
export function drawPriceRound(pool:PriceGameCard[],difficulty:PriceGameDifficulty,previous:number[]=[],random:()=>number=Math.random):PriceGameCard[]{
 const count=difficulty==="hard"?3:2,style=priceRoundStyle(random());
 const groups=new Map<string,PriceGameCard[]>();
 for(const card of pool){const key=priceGameRarity(card);groups.set(key,[...(groups.get(key)??[]),card])}
 const preferred=style==="same"?[...groups.entries()].filter(([key])=>key!=="unclassified").map(([,cards])=>cards):style==="similar"?nearbyRarityPools(groups):[];
 for(const group of shuffled(preferred,random)){
  const round=findRound(group,count,previous,random,style==="similar");if(round.length)return round;
 }
 return findRound(pool,count,previous,random);
}

export type PriceGameHistory={roundNumber:number;cards:PriceGameCard[];selected:number;winner:number;correct:boolean};
export type PriceGameState={round:PriceGameCard[];roundNumber:number;selected:number|null;correct:number;streak:number;attempts:number;history:PriceGameHistory[]};
export type PriceGameAction={type:"answer";productId:number}|{type:"next";round:PriceGameCard[]}|{type:"replace";round:PriceGameCard[]};
export const priceGameWinner=(round:PriceGameCard[])=>round.reduce<PriceGameCard|null>((best,card)=>!best||card.marketPrice>best.marketPrice?card:best,null);
export const initialPriceGame=(round:PriceGameCard[]):PriceGameState=>({round,roundNumber:1,selected:null,correct:0,streak:0,attempts:0,history:[]});
export function priceGameReducer(state:PriceGameState,action:PriceGameAction):PriceGameState{
 if(action.type==="replace")return state.selected==null?{...state,round:action.round}:state;
 if(action.type==="next")return state.selected==null?state:{...state,round:action.round,roundNumber:state.roundNumber+1,selected:null};
 if(state.selected!=null||!state.round.some(card=>card.productId===action.productId))return state;
 const winner=priceGameWinner(state.round)!.productId,correct=winner===action.productId;
 const entry={roundNumber:state.roundNumber,cards:state.round.map(card=>({...card})),selected:action.productId,winner,correct};
 return {...state,selected:action.productId,attempts:state.attempts+1,correct:state.correct+Number(correct),streak:correct?state.streak+1:0,history:[entry,...state.history]};
}
