import type {AuctionCard,AuctionIdentity,AuctionSave} from './auction-types.ts';
import {parseGameScope,gameScopeIncludes} from './game-scope.ts';
import type {GameMarket} from './game-profile.ts';

export function validAuctionIdentity(identity:AuctionIdentity,market:GameMarket){
 if((identity.market??'riftbound')!==market)return false;
 if(market==='riftbound')return identity.scope===undefined&&identity.catalogVersion===undefined&&identity.rulesVersion===undefined;
 if(identity.rulesVersion!==1)return false;
 if(identity.scope===undefined)return identity.catalogVersion===undefined;
 try{return parseGameScope(identity.scope).market===market&&typeof identity.catalogVersion==='string'&&/^[a-f0-9]{64}$/.test(identity.catalogVersion)}catch{return false}
}
export function auctionCardsInScope(cards:AuctionCard[],identity:AuctionIdentity,market:GameMarket){
 return cards.every(card=>(card.market??'riftbound')===market&&(market==='riftbound'||Number.isInteger(card.year)&&!!identity.scope&&gameScopeIncludes({game:'pokemon',set:card.set,year:card.year??0},identity.scope!)));
}
export function validateAuctionMarket(save:AuctionSave,market:GameMarket){
 if(!validAuctionIdentity(save,market))throw new Error('Saved game belongs to another auction market or rules version.');
 const entries=[...(save.auction?[save.auction]:[]),...Object.values(save.drafts??{})];
 if(entries.some(entry=>!validAuctionIdentity(entry!,market)||market==='pokemon'&&!entry!.scope||!auctionCardsInScope(entry!.lot??[],entry!,market)||'pool' in entry!&&!auctionCardsInScope(entry!.pool??[],entry!,market)))throw new Error('Saved auction pool does not match its market or selection.');
}
