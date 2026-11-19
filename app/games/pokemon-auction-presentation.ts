import type {AuctionKind} from '../../core/domain/auction-types';
// Existing canonical strategy names are saved role identifiers. Localized/display
// names are presentation only and must never choose a strategy or rewrite history.
export const POKEMON_AUCTION_RIVALS:Record<string,{id:string;name:string}>={
 'The Dealer':{id:'dealer',name:'The Card Shop Owner'},
 'The Collector':{id:'collector',name:'The Ace Collector'},
 'The Opportunist':{id:'opportunist',name:'The Route Explorer'},
 'The Analyst':{id:'analyst',name:'The Professor'},
 'The Gambler':{id:'gambler',name:'The Shiny Hunter'},
 'The Bargain Hunter':{id:'bargain-hunter',name:'The Market Scout'},
 'The Follower':{id:'follower',name:'The League Fan'},
 'The Archivist':{id:'archivist',name:'The Pokédex Archivist'},
 'The Playset Builder':{id:'playset-builder',name:'The Deck Specialist'},
 'The Skeptic':{id:'skeptic',name:'The Card Inspector'},
 'The Closer':{id:'closer',name:'The Tournament Veteran'},
 'The Trust Fund Kid':{id:'trust-fund-kid',name:'The Trophy Heir'},
};
export function pokemonAuctionText(text:string){
 return text.replace(/OVERNUMBERED or SIGNATURE|Overnumbered or Signature/gi,'Illustration, Gallery, Shiny, Special Illustration, Alternate Art or Secret')
  .replace(/Overnumbered, Signature and all Other\/Promo\/Showcase cards/gi,'Illustration, Gallery, Shiny, Special Illustration, Alternate Art, Secret and Promo / Other cards')
  .replace(/Metal and ultra-rare promos/gi,'Promo / Other cards')
  .replace(/rare\s*\/\s*epic\s*\/\s*alt[- ]art/gi,'Rare / Holo Rare / Double or Ultra Rare')
  .replace(/Rare & Epic/gi,'Rare & Holo Rare').replace(/Common-through-Epic/gi,'Common-through-Holo Rare')
  .replace(/Alt[- ]Arts?/gi,'Double / Ultra Rare').replace(/Overnumbered/gi,'Illustration / Gallery / Shiny').replace(/Signatures?/gi,'Special Illustration / Alternate Art / Secret')
  .replace(/\bEpics?\b/gi,'Holo Rare').replace(/\bMetal\b/g,'special Promo');
}
export const pokemonHouse=(kind:AuctionKind,category?:string)=>category==='vintage'?'Cinnabar Auction House':kind==='paid'?'Celadon Auction House':'Pewter Auction House';
