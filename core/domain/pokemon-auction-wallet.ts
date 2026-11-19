import type {AuctionCard,AuctionSave} from './auction-types.ts';
import {auctionWalletSummary} from './auction-wallet.ts';
import {POKEMON_VINTAGE_UNLOCK} from './pokemon-auction-houses.ts';
export function unlockPokemonVintage(save:AuctionSave,catalog:AuctionCard[]):AuctionSave{
 if(save.market!=='pokemon'||save.vintageUnlocked)return save;
 // Known subtotal is a lower bound; missing prices do not reset the milestone.
 return auctionWalletSummary(save,catalog).knownNetWorth>=POKEMON_VINTAGE_UNLOCK?{...save,vintageUnlocked:true}:save;
}
