import {auctionRandom,type AuctionCard} from '../core/domain/auction-types.ts';
import {createDailyAuctionManifest} from '../core/domain/auction-daily.ts';
import {generateAuctionLot,AUCTION_LOT_SIZES} from '../core/domain/auction-lots.ts';
import {auctionMarketPrior} from '../core/domain/auction-market-prior.ts';
import {createDailyShowdownManifest,dailyShowdownPool} from '../core/domain/showdown-daily.ts';
import {dailyGameSeed} from '../core/domain/daily-game.ts';
import {drawPriceRound} from '../core/domain/price-game.ts';
import {failedGameArtwork,type GameArtworkCheck} from './game-artwork.ts';

export async function verifiedDailyShowdown(catalog:AuctionCard[],date:string,source:string,check:GameArtworkCheck){
 const manifest=createDailyShowdownManifest(catalog,date,source),failed=new Set<string>();
 const checked=new Map<string,Promise<boolean>>(),verify=(url:string)=>{if(!checked.has(url))checked.set(url,check(url));return checked.get(url)!};
 for(const mode of ['normal','hard'] as const){
  for(let index=0;index<10;index++){
   for(let attempt=0;attempt<50;attempt++){
    const bad=await failedGameArtwork(manifest[mode][index],verify);for(const url of bad)failed.add(url);
    if(!bad.size)break;
    const pool=dailyShowdownPool(catalog.filter(card=>!failed.has(card.image)));
    const used=manifest[mode].filter((_,other)=>other!==index).flat().map(card=>card.productId);
    const random=auctionRandom(dailyGameSeed(`showdown-art-v1-${mode}-${index}-${attempt}`,date));
    const round=drawPriceRound(pool.filter(card=>!used.includes(card.productId)),mode,[],random);
    manifest[mode][index]=round.length?round:drawPriceRound(pool,mode,used,random);
    if(manifest[mode][index].length!==(mode==='hard'?3:2)||attempt===49)throw new Error('Not enough verified daily artwork');
   }
  }
 }
 return manifest;
}
export async function verifiedDailyAuction(catalog:AuctionCard[],date:string,source:string,check:GameArtworkCheck){
 const manifest=createDailyAuctionManifest(catalog,date,source);let pool=catalog;
 const checked=new Map<string,Promise<boolean>>(),verify=(url:string)=>{if(!checked.has(url))checked.set(url,check(url));return checked.get(url)!};
 for(const draft of manifest.auctions){
  for(let attempt=0;attempt<50;attempt++){
   const bad=await failedGameArtwork(draft.lot,verify);if(!bad.size)break;
   pool=pool.filter(card=>!bad.has(card.image));draft.lot=generateAuctionLot(pool,draft.seed,draft.kind);
   if(draft.lot.length<AUCTION_LOT_SIZES[draft.kind].min||attempt===49)throw new Error('Not enough verified daily artwork');
  }
 }
 for(const draft of manifest.auctions)draft.marketPrior=auctionMarketPrior(pool,draft.seed,draft.kind);
 return manifest;
}
