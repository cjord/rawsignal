import type {Card} from './types.ts';
import {holdingKey} from './auction-types.ts';
export const AUCTION_APPEARANCE_KEY='raw-signal-auction-appearance-v1';
export const AUCTION_BACKDROP_LIMIT=12;
export type AuctionAppearance={version:1;cards:{productId:number;printing:string}[]};
export const defaultAuctionAppearance=():AuctionAppearance=>({version:1,cards:[]});
export function validAuctionAppearance(value:unknown):value is AuctionAppearance{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as AuctionAppearance;
 return Object.keys(row).every(key=>['version','cards'].includes(key))&&row.version===1&&Array.isArray(row.cards)&&row.cards.length<=AUCTION_BACKDROP_LIMIT&&new Set(row.cards.map(card=>card&&holdingKey(card))).size===row.cards.length&&row.cards.every(card=>card&&Object.keys(card).every(key=>['productId','printing'].includes(key))&&Number.isSafeInteger(card.productId)&&card.productId>0&&typeof card.printing==='string'&&card.printing.length>0&&card.printing.length<=80);
}
export function parseAuctionAppearance(raw:string|null):AuctionAppearance{
 if(raw===null)return defaultAuctionAppearance();
 if(raw.length>6000)throw new Error('Saved profile appearance is too large.');
 const value:unknown=JSON.parse(raw);if(!validAuctionAppearance(value))throw new Error('Saved profile appearance is invalid.');return value;
}
export function appearanceArtwork(appearance:AuctionAppearance,catalog:Card[]){
 const metadata=new Map(catalog.filter(card=>card.game==='riftbound').map(card=>[holdingKey(card),card]));
 return appearance.cards.flatMap(holding=>{const card=metadata.get(holdingKey(holding));return card&&/^https?:\/\//.test(card.image)?[{image:card.image,rarity:card.rarity,section:card.section}]:[]});
}
