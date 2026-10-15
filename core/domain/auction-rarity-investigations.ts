import type {Auction,Investigation} from './auction-types.ts';

export const RARITY_INVESTIGATIONS:Investigation[]=[
 {id:'rare8',label:'Rare Scan',description:'Reveal up to 8 unpriced regular rare copies and their prices.',cost:1500,tier:'targeted'},
 {id:'epic5',label:'Epic Scan',description:'Reveal up to 5 unpriced regular epic copies and their prices.',cost:2000,tier:'strong'},
 {id:'alt3',label:'Alt-Art Scan',description:'Reveal up to 3 unpriced alt-art copies and their prices.',cost:3000,tier:'strong'},
 {id:'common3',label:'Common Scan',description:'Reveal up to 3 unpriced common copies and their prices.',cost:800,tier:'basic'},
 {id:'uncommon3',label:'Uncommon Scan',description:'Reveal up to 3 unpriced uncommon copies and their prices.',cost:1000,tier:'basic'},
 {id:'rare2',label:'Rare Scan',description:'Reveal up to 2 unpriced rare copies and their prices.',cost:2000,tier:'targeted'},
 {id:'epic2',label:'Epic Scan',description:'Reveal up to 2 regular epic copies and their prices.',cost:3000,tier:'strong'},
 {id:'alt1',label:'Alt-Art Scan',description:'Reveal 1 unpriced alt-art copy and its price.',cost:4500,tier:'strong'},
 {id:'chase1',label:'Chase Scan',description:'Reveal 1 unpriced overnumbered or signature copy and its price.',cost:6500,tier:'premium'},
];
export function rarityInvestigationSlots(auction:Auction,id:string){
 if(!RARITY_INVESTIGATIONS.some(option=>option.id===id))return null;
 return auction.lot.flatMap((card,index)=>{
  if(auction.priced.includes(index))return [];
  const chase=/signature|over.?number/i.test(card.section),alt=/alt/i.test(card.section),rarity=card.rarity.toLowerCase();
  const match=id==='chase1'?chase:id.startsWith('alt')?alt:id.startsWith('epic')?rarity==='epic'&&!chase&&!alt:id.startsWith('rare')?rarity==='rare'&&!chase&&!alt:id==='common3'?rarity==='common':rarity==='uncommon';
  return match?[index]:[];
 });
}
