import {POKEMON_ERAS,pokemonEra} from './eras.ts';
import {ebayCardLanguage} from './marketplace-links.ts';
import {parseGameMarket,type GameMarket} from './game-profile.ts';
import type {Card} from './types.ts';

export type GameScope={market:GameMarket;eras:string[];sets:string[]};
export const POKEMON_GAME_ERAS=[...POKEMON_ERAS,{key:'cross-era',label:'Promos / Cross-era'},{key:'unknown',label:'Unknown era'}];
const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=300&&![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
function scopeList(value:unknown,limit:number){
 if(!Array.isArray(value)||value.length>limit||!value.every(text))throw new RangeError('Invalid game pool selection.');
 return [...new Set(value.map(v=>v.normalize('NFKC').trim()))].sort();
}
export function parseGameScope(value:unknown):GameScope{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid game pool.');
 const input=value as GameScope;
 if(Object.keys(input).some(key=>!['market','eras','sets'].includes(key)))throw new RangeError('Invalid game pool fields.');
 const market=parseGameMarket(input.market),eras=scopeList(input.eras,12),sets=scopeList(input.sets,40);
 if(eras.some(era=>!POKEMON_GAME_ERAS.some(known=>known.key===era))||market==='riftbound'&&eras.length)throw new RangeError('Invalid era selection.');
 return {market,eras,sets};
}
export const gameScopeKey=(scope:GameScope)=>JSON.stringify(parseGameScope(scope));
export function pokemonGameEra(card:Pick<Card,'set'|'year'>){
 if(/^(?:prize pack|league|mcdonald)|\b(?:promotional cards|pokemon promos|miscellaneous cards)\b/i.test(card.set))return 'cross-era';
 const named=/^(?:ME\b|ME\d|Mega Evolution|SV\b|SV\d|SWSH|SM\b|XY\b|Crown Zenith|Black and White|BW\b|EX |Diamond and Pearl|DP\b|Platinum|HGSS|HS—|HS -)/i.test(card.set);
 if(!named&&(!Number.isInteger(card.year)||card.year<1990||card.year>2100))return 'unknown';
 return pokemonEra(card.set,card.year);
}
export function gameCardEligible(card:Card,market:GameMarket){
 return card.game===market&&ebayCardLanguage({...card,kind:'single'})==='English'&&Number.isSafeInteger(card.productId)&&card.productId>0&&!!card.name.trim()&&!!card.printing.trim()&&/^https:\/\//.test(card.image)&&card.marketPrice!==null&&Number.isFinite(card.marketPrice)&&card.marketPrice>0&&Number.isSafeInteger(Math.round(card.marketPrice*100))&&Math.round(card.marketPrice*100)>0;
}
export function gameScopeIncludes(card:Pick<Card,'game'|'set'|'year'>,scope:GameScope){
 return card.game===scope.market&&(!scope.eras.length||scope.eras.includes(pokemonGameEra(card)))&&(!scope.sets.length||scope.sets.includes(card.set));
}
export function selectGameScope(cards:Card[],input:GameScope){
 const scope=parseGameScope(input),eligible=cards.filter(card=>gameCardEligible(card,scope.market));
 const selected=eligible.filter(card=>gameScopeIncludes(card,scope));
 const missingSets=scope.sets.filter(set=>!eligible.some(card=>card.set===set));
 const incompatibleSets=scope.sets.filter(set=>eligible.some(card=>card.set===set)&&!selected.some(card=>card.set===set));
 return {scope,cards:selected,missingSets,incompatibleSets};
}
