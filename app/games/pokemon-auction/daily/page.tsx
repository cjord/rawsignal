import type {Metadata} from 'next';
import RiftboundAuctionHouse from '../../../RiftboundAuctionHouse';
export const metadata:Metadata={title:'Pokémon Daily Auction Challenge | Raw Signal',description:'Five shared Pokémon auctions, one separate bankroll and an independent daily challenge.'};
export default function PokemonDailyAuctionPage(){return <RiftboundAuctionHouse dailyMode/>}
