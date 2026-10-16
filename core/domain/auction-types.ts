export const AUCTION_START_CASH=250000;
export const AUCTION_DEFAULT_FEE=1000; // basis points: virtual selling fee, not real resale guidance
export const AUCTION_PAID_ENTRY=5000;
export type AuctionKind='free'|'paid';
export const AUCTION_ROUNDS=[{seconds:60,threshold:100},{seconds:60,threshold:60},{seconds:60,threshold:30},{seconds:60,threshold:0}] as const;
export type Holding={productId:number;printing:string;quantity:number};
export type AuctionCard={productId:number;printing:string;name:string;image:string;set:string;rarity:string;section:string;cents:number};
export type Wallet={cash:number;feeBps:number;inventory:Holding[]};
export type Npc={name:string;bid:number;lockAt:number;locked:boolean;sample:number[];investigations?:string[];inspected?:number[];identified?:number[];rarityKnown?:number[];findings?:Clue[]};
export type AuctionMarketPrior={mean:number;bands:{band:string;mean:number;share:number;typical?:number}[]};
export type Investigation={id:string;label:string;description?:string;cost:number;tier:"basic"|"targeted"|"strong"|"premium"};
export type ClueReveal={slot:number;visibility:'rarity'|'identity'|'price'};
export type Clue={id:string;label:string;text:string;round?:number;reveals?:ClueReveal[]};
export type RoundBid={name:string;cents:number;notes?:Clue[]};
export type AuctionResult={winner:string|null;bid:number;value:number;fee:number;net:number;playerExpenses:number;buyout:boolean;lossShares?:{name:string;cents:number}[]};
export type Auction={seed:number;pendingFollowUp?:true;statisticsTracked?:boolean;npcInvestigationSchedule?:boolean;marketPrior?:AuctionMarketPrior;lotTheme?:string;publicReveals?:PublicReveal[];rarityKnown?:number[];topCardSlot?:number;stage:"round"|"reveal"|"result";round:number;deadline:number;lot:AuctionCard[];range:[number,number];known:number[];priced:number[];offers:Investigation[];clues:Clue[];bought:boolean;spent:number;selected:number|null;npcs:Npc[];bids:RoundBid[];bidHistory:RoundBid[][];result:AuctionResult|null;feeBps:number;kind?:AuctionKind;entryFee?:number;rivals?:string[]};
export type AuctionStatistics={started:number;settled:number;won:number;abandoned:number;investigations:number;entryFees:number;profit:number;rebates:number;bestProfit:number;buyouts:number};
export type AuctionDraft={seed:number;kind:AuctionKind;lot?:AuctionCard[];pool?:AuctionCard[];marketPrior?:AuctionMarketPrior;rivals?:string[]};
export type DailyAuctionManifest={version:1;date:string;source:string;auctions:(AuctionDraft&{lot:AuctionCard[];marketPrior:AuctionMarketPrior})[]};
export type DailyAuctionReceipt=[winner:number,bid:number,investigations:number,credit:number,round:number,buyout:number];
export type DailyAuctionProgress={date:string;manifest:DailyAuctionManifest;index:number;save:AuctionSave;status:'playing'|'completed'|'failed';reward:number;receipts?:DailyAuctionReceipt[]};
export type AuctionSave={version:1;revision:number;sequence:number;wallet:Wallet;auction:Auction|null;drafts?:Partial<Record<AuctionKind,AuctionDraft>>;statistics?:AuctionStatistics;daily?:DailyAuctionProgress};
export type PublicReveal={round:number;slots:number[]};
export const holdingKey=(card:Pick<Holding,"productId"|"printing">)=>`${card.productId}:${card.printing}`;
export const initialAuctionSave=():AuctionSave=>({version:1,revision:0,sequence:0,wallet:{cash:AUCTION_START_CASH,feeBps:AUCTION_DEFAULT_FEE,inventory:[]},auction:null});
export const feeFor=(cents:number,bps:number)=>Math.round(cents*bps/10000);
export function auctionRandom(seed:number){
 let value=seed>>>0;
 // Avalanche the seed before the LCG so adjacent auction seeds do not correlate.
 value=Math.imul(value^(value>>>16),0x7feb352d);value=Math.imul(value^(value>>>15),0x846ca68b);value^=value>>>16;
 return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296};
}
export function sampleIndices(length:number,count:number,seed:number,exclude:number[]=[]){
 const random=auctionRandom(seed),indices=Array.from({length},(_,index)=>index).filter(index=>!exclude.includes(index));
 for(let index=indices.length-1;index>0;index--){const swap=Math.floor(random()*(index+1));[indices[index],indices[swap]]=[indices[swap],indices[index]]}
 return indices.slice(0,count);
}
