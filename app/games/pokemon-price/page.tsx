import type {Metadata} from 'next';
import PokemonPriceGame from '../PokemonPriceGame';
export const metadata:Metadata={title:'Pokémon Price Showdown | Raw Signal',description:'Choose Pokémon eras and sets, then pick the card with the highest market price.'};
export default function PokemonPricePage(){return <PokemonPriceGame/>}
