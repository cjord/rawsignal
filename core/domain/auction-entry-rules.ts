import type {AuctionCard,AuctionKind,AuctionSave} from './auction-types.ts';
import {AUCTION_LOT_SIZES} from './auction-lot-size.ts';
import {pokemonAuctionCategory,pokemonEntryFee,POKEMON_VINTAGE_SIZE} from './pokemon-auction-houses.ts';
import {validAuctionIdentity,auctionCardsInScope} from './auction-market-identity.ts';

export function auctionEntryRules(save:AuctionSave,kind:AuctionKind){
 const draft=save.drafts?.[kind],market=save.market??'riftbound',category=draft?.scope?pokemonAuctionCategory(draft.scope):null;
 const entryFee=market==='pokemon'?pokemonEntryFee(kind,category??undefined):kind==='paid'?5000:0;
 const size=category==='vintage'?POKEMON_VINTAGE_SIZE:AUCTION_LOT_SIZES[kind];
 return {market,category,entryFee,size,draft};
}
export function auctionEntryAllowed(save:AuctionSave,kind:AuctionKind,lot:AuctionCard[],rules:ReturnType<typeof auctionEntryRules>){
 if(save.auction||save.wallet.cash<rules.entryFee||lot.length<rules.size.min||lot.length>rules.size.max)return false;
 if(rules.category==='vintage'&&(!save.vintageUnlocked||kind!=='paid'))return false;
 if(rules.market==='riftbound')return lot.every(card=>card.market!=='pokemon');
 return !!rules.draft&&validAuctionIdentity(rules.draft,'pokemon')&&auctionCardsInScope(lot,rules.draft,'pokemon');
}
