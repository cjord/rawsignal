import {holdingKey,type AuctionSave,type AuctionCard,type AuctionStatistics} from './auction-types.ts';
import {emptyAuctionStatistics,validAuctionStatistics} from './auction-statistics.ts';

export type ProfileCard=[number,string,string,string,string,string,number|null];
export type AuctionProfileShare={v:1;at:string;name:string;stats:AuctionStatistics;cards:ProfileCard[]};
const profileStats=(stats:AuctionStatistics)=>Object.fromEntries(Object.keys(emptyAuctionStatistics()).map(key=>[key,stats[key as keyof AuctionStatistics]])) as AuctionStatistics;
export function auctionProfileSnapshot(save:AuctionSave,catalog:AuctionCard[],at=new Date().toISOString()):AuctionProfileShare{
 const cards=new Map(catalog.map(card=>[holdingKey(card),card]));
 return {v:1,at,name:save.profileName??'',stats:profileStats(save.statistics??emptyAuctionStatistics()),cards:(save.showcase??[]).map(holding=>{const card=cards.get(holdingKey(holding));return [holding.productId,holding.printing,card?.name??`Card ${holding.productId}`,card?.set??'',card?.rarity??'Unknown',card?.section??'',card?.cents??null]})};
}
const safeString=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
export function validProfileSnapshot(value:unknown):value is AuctionProfileShare{
 const row=value as AuctionProfileShare;if(!row||row.v!==1||!safeString(row.at,30)||!Number.isFinite(Date.parse(row.at))||!safeString(row.name,40)||!validAuctionStatistics(row.stats)||!Array.isArray(row.cards)||row.cards.length>20)return false;
 return new Set(row.cards.map(card=>Array.isArray(card)?`${card[0]}:${card[1]}`:'')).size===row.cards.length&&row.cards.every(card=>Array.isArray(card)&&card.length===7&&Number.isSafeInteger(card[0])&&card[0]>0&&safeString(card[1],80)&&safeString(card[2],300)&&safeString(card[3],300)&&safeString(card[4],80)&&safeString(card[5],100)&&(card[6]===null||Number.isSafeInteger(card[6])&&card[6]>0));
}
export function encodeProfileSnapshot(snapshot:AuctionProfileShare){
 if(!validProfileSnapshot(snapshot))throw new Error('Invalid showcase snapshot');
 const canonical={v:1,at:snapshot.at,name:snapshot.name,stats:profileStats(snapshot.stats),cards:snapshot.cards.map(card=>[...card])};
 const bytes=new TextEncoder().encode(JSON.stringify(canonical)),raw=Array.from(bytes,byte=>String.fromCharCode(byte)).join('');
 const encoded=btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>24000)throw new Error('Showcase link is too large. Try fewer cards.');return encoded;
}
export function decodeProfileSnapshot(raw:string):AuctionProfileShare{
 if(!/^[\w-]{1,24000}$/.test(raw))throw new Error('Invalid showcase link');
 const bytes=Uint8Array.from(atob(raw.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0)),value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!validProfileSnapshot(value))throw new Error('Invalid showcase link');
 const snapshot=value as AuctionProfileShare;return {v:1,at:snapshot.at,name:snapshot.name,stats:profileStats(snapshot.stats),cards:snapshot.cards.map(card=>[...card] as ProfileCard)};
}
export const auctionProfilePath=(snapshot:AuctionProfileShare)=>`/games/riftbound-auction/showcase#${encodeProfileSnapshot(snapshot)}`;
