"use client";
/* eslint-disable @next/next/no-img-element -- preoptimized 192px local WebP portraits */
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
import {useAuctionGame} from './AuctionGameContext';
import {POKEMON_AUCTION_RIVALS,pokemonAuctionText} from './pokemon-auction-presentation';
const portraits:Record<string,string>=Object.fromEntries([['You','player'],...AUCTION_NPCS.map(npc=>[npc.name,npc.portrait])]);
export default function AuctionBidder({name,detail}:{name:string;detail?:string}){
 const game=useAuctionGame(),rival=game.market==='pokemon'?POKEMON_AUCTION_RIVALS[name]:undefined,description=detail??AUCTION_NPCS.find(npc=>npc.name===name)?.description;
 const portrait=rival?`/images/games/pokemon-rival-${rival.id}-v1.webp`:`/images/games/auction-${portraits[name]??'player'}.webp`;
 return <b className="auction-bidder" data-bidder={name} title={description&&game.market==='pokemon'?pokemonAuctionText(description):description}><img src={portrait} alt="" width="40" height="40"/>{rival?.name??name}</b>;
}
