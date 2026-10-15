/* eslint-disable @next/next/no-img-element -- preoptimized 192px local WebP portraits */
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
const portraits:Record<string,string>=Object.fromEntries([['You','player'],...AUCTION_NPCS.map(npc=>[npc.name,npc.portrait])]);
export default function AuctionBidder({name,detail}:{name:string;detail?:string}){
 return <b className="auction-bidder" data-bidder={name} title={detail??AUCTION_NPCS.find(npc=>npc.name===name)?.description}><img src={`/images/games/auction-${portraits[name]??'player'}.webp`} alt="" width="32" height="32"/>{name}</b>;
}
