import {parseAuctionSave} from './auction-save.ts';
import {parseDailyShowdown} from './showdown-daily.ts';

// Explicit user-owned domains only. Never synchronize navigation URLs, credentials,
// cached market feeds, or developer flags. Real collections stay separate from game money.
export const ACCOUNT_KEYS=[
 'raw-signal-auction-house-v1','raw-signal-showdown-daily-v1','raw-signal-showdown-practice-v1',
 'raw-signal-favorites','raw-signal-buylist','raw-signal-set-favorites','raw-signal-collectr-import',
 'raw-signal-theme','raw-signal-font-size','raw-signal-scalper-mode','raw-signal-hover-previews',
 'raw-signal-strictness','raw-signal-auction-sound','raw-signal-auction-auto-advance','raw-signal-buylist-size',
 'raw-signal-showdown-difficulty','raw-signal-showdown-auto-advance','raw-signal-notification-duration',
] as const;
export type AccountKey=typeof ACCOUNT_KEYS[number];
export type AccountDocument={key:AccountKey;value:string;revision:number;updatedAt:string};
export const isAccountKey=(key:string):key is AccountKey=>(ACCOUNT_KEYS as readonly string[]).includes(key);
export const documentLimit=(key:AccountKey)=>key==='raw-signal-collectr-import'?1500000:1000000;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const list=(value:unknown)=>Array.isArray(value)&&value.length<=10000;
const choices:Record<string,readonly string[]>={
 'raw-signal-theme':['dark','light'],'raw-signal-font-size':['default','large'],
 'raw-signal-scalper-mode':['regular','scalper'],'raw-signal-hover-previews':['on','off'],
 'raw-signal-strictness':['conservative','balanced','aggressive'],
 'raw-signal-auction-sound':['on','muted'],'raw-signal-auction-auto-advance':['on','off'],
 'raw-signal-buylist-size':['small','large'],
 'raw-signal-showdown-difficulty':['normal','hard'],'raw-signal-showdown-auto-advance':['on','off'],
 'raw-signal-notification-duration':['4','8','15','0'],
};
export function validAccountValue(key:AccountKey,value:unknown):value is string{
 if(typeof value!=='string'||new TextEncoder().encode(value).length>documentLimit(key))return false;
 if(choices[key])return choices[key].includes(value);
 try{
  if(key==='raw-signal-auction-house-v1'){parseAuctionSave(value);return true}
  if(key==='raw-signal-showdown-daily-v1'){parseDailyShowdown(value);return true}
  const parsed:unknown=JSON.parse(value);
  if(key==='raw-signal-set-favorites')return list(parsed)&&(parsed as unknown[]).every(item=>typeof item==='string'&&item.length<=300);
  if(key==='raw-signal-favorites')return list(parsed)&&(parsed as unknown[]).every(item=>object(item)&&Number.isSafeInteger(item.productId)&&typeof item.key==='string'&&['single','sealed'].includes(String(item.kind)));
  if(key==='raw-signal-buylist')return object(parsed)&&Object.keys(parsed).length<=10000&&Object.values(parsed).every(row=>object(row)&&typeof row.acquired==='boolean'&&(row.paid===null||typeof row.paid==='number'&&Number.isFinite(row.paid)));
  if(key==='raw-signal-collectr-import')return object(parsed)&&parsed.version===1&&object(parsed.payload)&&object(parsed.payload.profile)&&list(parsed.payload.cards);
  return validPracticeSave(parsed);
 }catch{return false}
}
function validPracticeSave(value:unknown){
 if(!object(value)||value.v!==1||!['normal','hard'].includes(String(value.difficulty))||!object(value.state))return false;
 const state=value.state;
 if(!['roundNumber','correct','streak','attempts'].every(key=>Number.isSafeInteger(state[key])&&Number(state[key])>=0))return false;
 if(!validPracticeRound(state.round,value.difficulty==='hard'?3:2)||!list(state.history))return false;
 return (state.selected===null||state.round.some((card:Record<string,unknown>)=>card.productId===state.selected))&&Number(state.correct)<=Number(state.attempts)&&Number(state.streak)<=Number(state.correct)&&(state.history as unknown[]).every(validPracticeHistory);
}
function validPracticeCard(card:unknown):card is Record<string,unknown>{return object(card)&&Number.isSafeInteger(card.productId)&&Number(card.productId)>0&&['name','image','printing','section'].every(key=>typeof card[key]==='string')&&typeof card.marketPrice==='number'&&Number.isFinite(card.marketPrice)&&card.marketPrice>0}
function validPracticeRound(cards:unknown,count:number):cards is Record<string,unknown>[] {return Array.isArray(cards)&&(cards.length===0||cards.length===count)&&cards.every(validPracticeCard)}
function validPracticeHistory(entry:unknown){return object(entry)&&Number.isSafeInteger(entry.roundNumber)&&typeof entry.correct==='boolean'&&Array.isArray(entry.cards)&&[2,3].includes(entry.cards.length)&&entry.cards.every(validPracticeCard)&&entry.cards.some(card=>card.productId===entry.selected)&&entry.cards.some(card=>card.productId===entry.winner)}
