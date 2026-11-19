import {GAME_PROFILES,type GameMarket} from '../core/domain/game-profile.ts';
import {AUCTION_APPEARANCE_KEY,POKEMON_AUCTION_APPEARANCE_KEY} from '../core/domain/auction-appearance.ts';
// Identifiers come only from this closed map, never from a request or a cursor.
export function auctionCommunityStore(market:GameMarket='riftbound'){
 if(market!=='riftbound'&&market!=='pokemon')throw new Error('Unsupported auction community');
 return market==='pokemon'?{profiles:'pokemon_auction_public_profiles',moderationTable:'pokemon_auction_profile_moderation',gameKey:GAME_PROFILES.pokemon.keys.auction,appearanceKey:POKEMON_AUCTION_APPEARANCE_KEY}:{profiles:'auction_public_profiles',moderationTable:'auction_profile_moderation',gameKey:GAME_PROFILES.riftbound.keys.auction,appearanceKey:AUCTION_APPEARANCE_KEY};
}
