import DeferredImage from '../DeferredImage';
export default function PokemonGameArtwork(){
 return <div className="game-tile-art game-pokemon-art" aria-hidden="true">{[497606,610516,523880].map(id=><DeferredImage key={id} className="game-pokemon-card" src={`https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`} alt=""/>)}</div>;
}
