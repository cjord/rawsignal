import {validGameDate} from './daily-game.ts';
import {validAuctionReceipts,dailyAuctionResults} from './auction-daily-results.ts';
import type {DailyAuctionManifest,DailyAuctionReceipt} from './auction-types.ts';
import {dailyShowdownHistory,showdownScore} from './showdown-daily.ts';
import type {PriceGameDifficulty} from './price-game.ts';
import type {MarketDailyManifest} from './showdown-market.ts';

export type GameShare={v:1;g:'auction';d:string;r:DailyAuctionReceipt[]}|{v:2;g:'auction';market:'pokemon';d:string;r:DailyAuctionReceipt[];c:string}|{v:1;g:'showdown';d:string;m:PriceGameDifficulty;p:number[]}|{v:2;g:'showdown';market:'pokemon';d:string;m:PriceGameDifficulty;p:number[];c:string};
export const encodeGameShare=(share:GameShare)=>btoa(JSON.stringify(share)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function decodeGameShare(raw:string):GameShare{
 if(!/^[\w-]{1,3000}$/.test(raw))throw new Error('Invalid results link');
 const share=JSON.parse(atob(raw.replaceAll('-','+').replaceAll('_','/'))) as GameShare;
 if(!share||!validGameDate(share.d)||(share.v!==1&&share.v!==2))throw new Error('Invalid results link');
 if(share.v===2&&(!['showdown','auction'].includes(share.g)||share.market!=='pokemon'||! /^[a-f0-9]{64}$/.test(share.c)))throw new Error('Invalid results link');
 if(share.v===1&&'market' in share)throw new Error('Invalid results market');
 if(share.g==='auction'&&validAuctionReceipts(share.r)&&share.r.length===5)return share;
 if(share.g==='showdown'&&['normal','hard'].includes(share.m)&&Array.isArray(share.p)&&share.p.length===10&&share.p.every(pick=>Number.isInteger(pick)&&pick>=0&&pick<(share.m==='hard'?3:2)))return share;
 throw new Error('Invalid results link');
}
export const gameSharePath=(share:GameShare)=>`/games/results#${encodeGameShare(share)}`;
export function auctionRunShare(manifest:DailyAuctionManifest,receipts:DailyAuctionReceipt[]):Extract<GameShare,{g:'auction'}>{
 if(manifest.version===2&&manifest.market==='pokemon'&&manifest.catalogVersion)return {v:2,g:'auction',market:'pokemon',d:manifest.date,r:receipts,c:manifest.catalogVersion};
 return {v:1,g:'auction',d:manifest.date,r:receipts};
}
const dollars=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function auctionShareText(manifest:DailyAuctionManifest,receipts:DailyAuctionReceipt[],url:string){
 const result=dailyAuctionResults(manifest,receipts);
 return `${manifest.market==='pokemon'?'Pokémon':'Riftbound'} Daily Auction · ${manifest.date}\n${result.rows.map(row=>row.won?'🟩':'⬜').join('')} ${result.won}/5 won\nNet profit: ${dollars(result.profit)} · Bonus: ${dollars(result.reward)}\n${url}`;
}
export function showdownShareText(manifest:MarketDailyManifest,mode:PriceGameDifficulty,picks:number[],url:string){
 const history=dailyShowdownHistory(manifest,mode,picks),score=showdownScore(history),emoji=history.map(row=>row.correct?'🟩':'🟥');
 return `${manifest.version===2?'Pokémon':'Riftbound'} Daily Showdown · ${manifest.date}\n${mode==='hard'?'Hard':'Normal'} · ${score.correct}/10 · Best streak ${score.best}\n${emoji.slice(0,5).join('')}\n${emoji.slice(5).join('')}\n${url}`;
}
