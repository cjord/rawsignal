import {auctionRandom,holdingKey,type AuctionCard} from './auction-types.ts';
import {dailyGameSeed,utcGameDate,validGameDate} from './daily-game.ts';
import {drawPriceRound,priceGamePool,priceGameWinner,type PriceGameCard,type PriceGameDifficulty,type PriceGameHistory} from './price-game.ts';

export const DAILY_SHOWDOWN_ROUNDS=10;
export type DailyShowdownManifest={version:1;date:string;source:string;normal:PriceGameCard[][];hard:PriceGameCard[][]};
export type DailyShowdownRun={picks:number[];cursor:number};
export type DailyShowdownSave={version:1;revision:number;manifest:DailyShowdownManifest;normal:DailyShowdownRun;hard:DailyShowdownRun};
export const SHOWDOWN_DAILY_KEY='raw-signal-showdown-daily-v1';
export function dailyShowdownPool(catalog:AuctionCard[]):PriceGameCard[]{
 return priceGamePool([...catalog].sort((a,b)=>holdingKey(a).localeCompare(holdingKey(b))).map(card=>({...card,game:'riftbound' as const,year:0,number:'',url:'',marketPrice:card.cents/100,lowPrice:null,midPrice:null,highPrice:null,priceChange:null})),'riftbound');
}
export function createDailyShowdownManifest(catalog:AuctionCard[],date:string,source:string):DailyShowdownManifest{
 const pool=dailyShowdownPool(catalog);
 const rounds=(mode:PriceGameDifficulty)=>{
  const random=auctionRandom(dailyGameSeed(`showdown-v1-${mode}`,date)),used=new Set<number>();
  return Array.from({length:10},()=>{
   const available=pool.filter(card=>!used.has(card.productId));
   const round=drawPriceRound(available,mode,[],random);
   const chosen=round.length?round:drawPriceRound(pool,mode,[...used],random);
   if(chosen.length!==(mode==='hard'?3:2))throw new Error('Not enough distinct priced cards');
   for(const card of chosen)used.add(card.productId);
   return chosen.map(({productId,name,image,printing,section,rarity,marketPrice})=>({productId,name,image,printing,section,rarity,marketPrice}));
  });
 };
 return {version:1,date,source,normal:rounds('normal'),hard:rounds('hard')};
}
function validRound(round:unknown,count:number):round is PriceGameCard[]{
 if(!Array.isArray(round)||round.length!==count)return false;
 return round.every(card=>card&&Number.isSafeInteger(card.productId)&&card.productId>0&&['name','printing','section','rarity','image'].every(key=>typeof card[key]==='string'&&card[key].length<=2000)&&/^https?:\/\//.test(card.image)&&Number.isFinite(card.marketPrice)&&card.marketPrice>0&&Number.isSafeInteger(Math.round(card.marketPrice*100)))&&new Set(round.map(card=>card.productId)).size===count&&new Set(round.map(card=>Math.round(card.marketPrice*100))).size===count;
}
export function validDailyShowdownManifest(value:unknown):value is DailyShowdownManifest{
 const row=value as DailyShowdownManifest;
 return !!row&&row.version===1&&validGameDate(row.date)&&typeof row.source==='string'&&row.source.length<=300&&(['normal','hard'] as const).every(mode=>Array.isArray(row[mode])&&row[mode].length===10&&row[mode].every(round=>validRound(round,mode==='hard'?3:2)));
}
const emptyRun=():DailyShowdownRun=>({picks:[],cursor:0});
export const initialDailyShowdown=(manifest:DailyShowdownManifest):DailyShowdownSave=>({version:1,revision:0,manifest,normal:emptyRun(),hard:emptyRun()});
function validRun(run:DailyShowdownRun,mode:PriceGameDifficulty){return !!run&&Array.isArray(run.picks)&&run.picks.length<=10&&run.picks.every(pick=>Number.isInteger(pick)&&pick>=0&&pick<(mode==='hard'?3:2))&&Number.isInteger(run.cursor)&&run.cursor>=0&&run.cursor<=9&&(run.picks.length===run.cursor||run.picks.length===run.cursor+1)}
export function parseDailyShowdown(raw:string):DailyShowdownSave{
 if(raw.length>100000)throw new Error('Saved challenge too large');
 const save=JSON.parse(raw) as DailyShowdownSave;
 if(save?.version!==1||!Number.isSafeInteger(save.revision)||save.revision<0||!validDailyShowdownManifest(save.manifest)||!validRun(save.normal,'normal')||!validRun(save.hard,'hard'))throw new Error('Invalid saved challenge');
 return save;
}
export function answerDailyShowdown(save:DailyShowdownSave,mode:PriceGameDifficulty,pick:number,now:number):DailyShowdownSave{
 const run=save[mode];if(save.manifest.date!==utcGameDate(now)||run.picks.length!==run.cursor||!Number.isInteger(pick)||pick<0||pick>=(mode==='hard'?3:2))return save;
 return {...save,revision:save.revision+1,[mode]:{...run,picks:[...run.picks,pick]}};
}
export function advanceDailyShowdown(save:DailyShowdownSave,mode:PriceGameDifficulty,now:number):DailyShowdownSave{
 const run=save[mode];if(save.manifest.date!==utcGameDate(now)||run.picks.length!==run.cursor+1||run.cursor>=9)return save;
 return {...save,revision:save.revision+1,[mode]:{...run,cursor:run.cursor+1}};
}
export function dailyShowdownHistory(manifest:DailyShowdownManifest,mode:PriceGameDifficulty,picks:number[]):PriceGameHistory[]{
 return picks.map((pick,index)=>{const cards=manifest[mode][index],winner=priceGameWinner(cards)!.productId,selected=cards[pick].productId;return {roundNumber:index+1,cards,selected,winner,correct:selected===winner}});
}
export function showdownScore(history:PriceGameHistory[]){let streak=0,best=0;for(const row of history){streak=row.correct?streak+1:0;best=Math.max(best,streak)}return {correct:history.filter(row=>row.correct).length,streak,best}}
