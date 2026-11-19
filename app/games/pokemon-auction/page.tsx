import type {Metadata} from 'next';
import PokemonAuctionHouse from '../PokemonAuctionHouse';
export const metadata:Metadata={title:'Pokémon Auction House | Raw Signal',description:'Choose Pokémon eras and sets, investigate mystery collections and bid against rival collectors with virtual cash.'};
export default function PokemonAuctionPage(){return <PokemonAuctionHouse/>}
