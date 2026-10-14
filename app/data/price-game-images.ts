import {isTcgplayerPlaceholder} from "../../core/domain/image-availability.ts";
import {drawPriceRound,type PriceGameCard,type PriceGameDifficulty} from "../../core/domain/price-game.ts";

export type PriceGameImageLoader={load:(src:string)=>Promise<boolean>;failed:(src:string)=>boolean;exclude:(src:string)=>void};

// Session-scoped, bounded image checks: only drawn cards, never the whole catalog.
// Reuse browser/CDN caching; no Worker pricing calls or availability writes.
export function createPriceGameImageLoader(createImage:()=>HTMLImageElement=()=>new Image(),timeoutMs=8000):PriceGameImageLoader{
 const cache=new Map<string,Promise<boolean>>(),failed=new Set<string>();
 const exclude=(src:string)=>{failed.add(src)};
 const load=(src:string):Promise<boolean>=>{
  if(!src||failed.has(src))return Promise.resolve(false);
  const existing=cache.get(src);if(existing)return existing;
  const result=new Promise<boolean>(resolve=>{
   const image=createImage();
   const finish=(valid:boolean)=>{clearTimeout(timer);image.onload=null;image.onerror=null;if(!valid)exclude(src);resolve(valid)};
   const timer=setTimeout(()=>finish(false),timeoutMs);
   image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0&&!isTcgplayerPlaceholder(image));
   image.onerror=()=>finish(false);image.src=src;
  });
  cache.set(src,result);return result;
 };
 return {load,failed:src=>failed.has(src),exclude};
}

export async function preparePriceRound(pool:PriceGameCard[],difficulty:PriceGameDifficulty,previous:number[],loader:PriceGameImageLoader,signal?:AbortSignal,random:()=>number=Math.random):Promise<PriceGameCard[]>{
 for(let attempt=0;attempt<8;attempt++){
  if(signal?.aborted)return [];
  const available=pool.filter(card=>!loader.failed(card.image));
  const round=drawPriceRound(available,difficulty,previous,random);
  if(!round.length)return [];
  const valid=await Promise.all(round.map(card=>loader.load(card.image)));
  if(signal?.aborted)return [];
  if(valid.every(Boolean))return round;
 }
 return [];
}
