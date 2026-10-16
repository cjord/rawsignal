import type {AuctionCard,Clue} from './auction-types.ts';
import {revisedCategoryMatches} from './auction-investigations-v3.ts';

export function npcCategoryFacts(knowledge:{clues:Clue[];observed:AuctionCard[]}){
 const core=knowledge.clues.some(clue=>clue.id==='bulk-core-v3');
 const categories=knowledge.clues.filter(clue=>['bulk-core-v3','alt-value-v3'].includes(clue.id)||!core&&['bulk','rares'].includes(clue.id));
 const values=categories.map(clue=>{const match=/\$([\d,.]+)/.exec(clue.text);return match?Math.round(Number(match[1].replaceAll(',',''))*100):NaN});
 if(!categories.length||values.some(value=>!Number.isSafeInteger(value)||value<0))return null;
 const includes=(card:AuctionCard)=>categories.some(clue=>clue.id==='bulk'?/^(common|uncommon)$/i.test(card.rarity):clue.id==='rares'?/^rare$/i.test(card.rarity):revisedCategoryMatches(clue.id,card));
 const value=values.reduce((sum,cents)=>sum+cents,0),outside=knowledge.observed.filter(card=>!includes(card)).reduce((sum,card)=>sum+card.cents,0);
 return {includes,value,floor:value+outside};
}
