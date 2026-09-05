import tcgdexSets from "./tcgdex-sets.json";
import {cardImageFallbackFor,type TcgdexIndex} from "../../core/domain/card-images";

// The bundled TCGdex set index bound to the pure resolver (core/domain/card-images.ts):
// a Pokémon card's fallback scan for when its TCGplayer CDN image fails to load.
const index=tcgdexSets as unknown as TcgdexIndex;

export const cardImageFallback=(card:{game:string;set:string;number?:string|null}):string|null=>cardImageFallbackFor(index,card);
