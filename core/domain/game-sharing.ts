import {validGameDate} from './daily-game.ts';
import {validAuctionReceipts,dailyAuctionResults} from './auction-daily-results.ts';
import type {DailyAuctionManifest,DailyAuctionReceipt} from './auction-types.ts';
import {dailyShowdownHistory,showdownScore,type DailyShowdownManifest} from './showdown-daily.ts';
import type {PriceGameDifficulty} from './price-game.ts';

export type GameShare={v:1;g:'auction';d:string;r:DailyAuctionReceipt[]}|{v:1;g:'showdown';d:string;m:PriceGameDifficulty;p:number[]};
export const encodeGameShare=(share:GameShare)=>btoa(JSON.stringify(share)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function decodeGameShare(raw:string):GameShare{
 if(!/^[\w-]{1,3000}$/.test(raw))throw new Error('Invalid results link');
 const share=JSON.parse(atob(raw.replaceAll('-','+').replaceAll('_','/'))) as GameShare;
 if(share?.v!==1||!validGameDate(share.d))throw new Error('Invalid results link');
 if(share.g==='auction'&&validAuctionReceipts(share.r)&&share.r.length===5)return share;
 if(share.g==='showdown'&&['normal','hard'].includes(share.m)&&Array.isArray(share.p)&&share.p.length===10&&share.p.every(pick=>Number.isInteger(pick)&&pick>=0&&pick<(share.m==='hard'?3:2)))return share;
 throw new Error('Invalid results link');
}
export const gameSharePath=(share:GameShare)=>`/games/results#${encodeGameShare(share)}`;
const dollars=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function auctionShareText(manifest:DailyAuctionManifest,receipts:DailyAuctionReceipt[],url:string){
 const result=dailyAuctionResults(manifest,receipts);
 return `Riftbound Daily Auction · ${manifest.date}\n${result.rows.map(row=>row.won?'🟩':'⬜').join('')} ${result.won}/5 won\nNet profit: ${dollars(result.profit)} · Bonus: ${dollars(result.reward)}\n${url}`;
}
export function showdownShareText(manifest:DailyShowdownManifest,mode:PriceGameDifficulty,picks:number[],url:string){
 const history=dailyShowdownHistory(manifest,mode,picks),score=showdownScore(history),emoji=history.map(row=>row.correct?'🟩':'🟥');
 return `Riftbound Daily Showdown · ${manifest.date}\n${mode==='hard'?'Hard':'Normal'} · ${score.correct}/10 · Best streak ${score.best}\n${emoji.slice(0,5).join('')}\n${emoji.slice(5).join('')}\n${url}`;
}
