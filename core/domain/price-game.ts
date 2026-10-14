import type {Card, SinglesGame} from "./types.ts";

export type PriceGameCard = Pick<Card,"productId"|"name"|"image"|"printing"> & {marketPrice:number};
export type PriceGameDifficulty = "normal" | "hard";
export const priceInCents = (price:number) => Math.round((price+Number.EPSILON)*100);

// Names and artwork are the only clues: do not quiz indistinguishable printings
// with different prices. Preserve catalog identity; this is not feed deduplication.
export function priceGamePool(cards:Card[], game:SinglesGame):PriceGameCard[]{
 const eligible=cards.filter(card=>card.game===game&&card.image&&card.name&&card.marketPrice!=null&&Number.isFinite(card.marketPrice)&&priceInCents(card.marketPrice)>0);
 const groups=new Map<string,Card[]>();
 for(const card of eligible){
  const key=`${card.name.toLowerCase().trim()}|${card.image.replace(/\?.*$/,"").replace(/_(?:200|400)w/,"")}`;
  groups.set(key,[...(groups.get(key)??[]),card]);
 }
 return [...groups.values()].filter(group=>new Set(group.map(card=>priceInCents(card.marketPrice!))).size===1)
  .map(group=>({...group[0],marketPrice:priceInCents(group[0].marketPrice!)/100}));
}

export function drawPriceRound(pool:PriceGameCard[],difficulty:PriceGameDifficulty,previous:number[]=[],random:()=>number=Math.random):PriceGameCard[]{
 const count=difficulty==="hard"?3:2;
 const shuffled=[...pool];
 for(let index=shuffled.length-1;index>0;index--){
  const swap=Math.floor(random()*(index+1));
  [shuffled[index],shuffled[swap]]=[shuffled[swap],shuffled[index]];
 }
 // Prefer fresh faces, but never stall a small pool. Distinct names and art prevent
 // visually ambiguous comparisons; distinct cents guarantee a single winner.
 const ordered=[...shuffled.filter(card=>!previous.includes(card.productId)),...shuffled.filter(card=>previous.includes(card.productId))];
 const picked:PriceGameCard[]=[];
 for(const card of ordered){
  if(picked.some(other=>other.productId===card.productId||other.name.toLowerCase()===card.name.toLowerCase()||other.image===card.image||priceInCents(other.marketPrice)===priceInCents(card.marketPrice)))continue;
  picked.push(card);
  if(picked.length===count)return picked;
 }
 return [];
}

export type PriceGameState={round:PriceGameCard[];roundNumber:number;selected:number|null;correct:number;streak:number;attempts:number};
export type PriceGameAction={type:"answer";productId:number}|{type:"next";round:PriceGameCard[]};
export const priceGameWinner=(round:PriceGameCard[])=>round.reduce<PriceGameCard|null>((best,card)=>!best||card.marketPrice>best.marketPrice?card:best,null);
export const initialPriceGame=(round:PriceGameCard[]):PriceGameState=>({round,roundNumber:1,selected:null,correct:0,streak:0,attempts:0});
export function priceGameReducer(state:PriceGameState,action:PriceGameAction):PriceGameState{
 if(action.type==="next")return state.selected==null?state:{...state,round:action.round,roundNumber:state.roundNumber+1,selected:null};
 if(state.selected!=null||!state.round.some(card=>card.productId===action.productId))return state;
 const correct=priceGameWinner(state.round)?.productId===action.productId;
 return {...state,selected:action.productId,attempts:state.attempts+1,correct:state.correct+Number(correct),streak:correct?state.streak+1:0};
}
