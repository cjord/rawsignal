import type {Card} from './types.ts';
import type {PriceRoundRules} from './price-game.ts';

export const POKEMON_BULK_SECTIONS={common:'pokemon-commons',uncommon:'pokemon-uncommons',rare:'pokemon-rares',holo:'pokemon-holo-rares'} as const;
const rarityKey=(value:string)=>value.trim().toLowerCase().replace(/[\s_-]+/g,' ');
export function pokemonBulkSection(rarity:string):[string,string]|null{
 const key=rarityKey(rarity);
 if(key==='common')return [POKEMON_BULK_SECTIONS.common,'Pokémon Commons'];
 if(key==='uncommon')return [POKEMON_BULK_SECTIONS.uncommon,'Pokémon Uncommons'];
 if(key==='rare')return [POKEMON_BULK_SECTIONS.rare,'Pokémon Rares'];
 if(key==='holo rare'||key==='rare holo')return [POKEMON_BULK_SECTIONS.holo,'Pokémon Holo Rares'];
 return null;
}
type PokemonRarityCard=Pick<Card,'rarity'|'section'|'name'|'printing'|'number'>;
export function pokemonGameRarity(card:PokemonRarityCard):string{
 const rarity=rarityKey(card.rarity??'');
 if(card.section==='promos'||rarity==='promo')return 'promo';
 if(/\((?:alternate (?:full )?art|alt[ -]art)\)/i.test(card.name))return 'alternate-art';
 if(/trainer gallery|galarian gallery/.test(rarity)||/^(TG|GG)\d/i.test(card.number))return 'gallery';
 const sections:Record<string,string>={'illustration-rares':'illustration','special-illustration-rares':'special-illustration','double-rares':'double','ultra-rares':'ultra','secret-hyper-rares':'secret','shiny-radiant-rares':'shiny-radiant'};
 if(sections[card.section])return sections[card.section];
 if(rarity==='common'||rarity==='uncommon')return rarity;
 if(rarity==='holo rare'||rarity==='rare holo'||rarity==='rare'&&card.printing==='Holofoil')return 'holo';
 if(rarity==='rare')return 'rare';
 return 'other';
}
// Adjacent comparison cohorts, not a claim that rarity dictates market value.
export const POKEMON_PRICE_ADJACENCY=[['common','uncommon'],['uncommon','rare'],['rare','holo'],['holo','double'],['double','ultra'],['ultra','illustration'],['illustration','special-illustration'],['illustration','gallery'],['special-illustration','alternate-art'],['special-illustration','secret']] as const;
export const pokemonPriceRoundRules:PriceRoundRules={adjacency:POKEMON_PRICE_ADJACENCY,rarity:card=>{const band=pokemonGameRarity({...card,number:card.number??''});return band==='other'?'unclassified':band}};
