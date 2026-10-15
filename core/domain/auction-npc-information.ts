import {INVESTIGATIONS,investigate,informationUseful} from './auction-information.ts';
import {auctionRandom,type Auction,type Npc,type Clue,type Investigation} from './auction-types.ts';
import {publicAuctionSlots} from './auction-public.ts';
import {AUCTION_NPCS,auctionNpcRoster} from './auction-npcs.ts';
import {npcKnowledgeValue} from './auction-npc-valuation.ts';

export const NPC_INVESTIGATION_IDS=['reveal3','bulk','rares','top5','appraisal','common3','uncommon3','rare2','epic2','alt1','chase1','sets','rarities','duplicates','identity3','common-count','uncommon-count','rare8','epic5','alt3','value-band','value-band4'];
export function npcInvestigationName(npc:Npc){return INVESTIGATIONS.find(option=>option.id===npc.investigations?.at(-1))?.label??'Card Inspection (Legacy)'}
export function npcInvestigationNotes(npc:Npc):Clue[]{
 const id=npc.investigations?.at(-1);
 return [{id:'public-start',label:'Shared Public Reveals',text:'Used the shared cards and prices revealed to all bidders.'},{id:id??'legacy-inspection',label:npcInvestigationName(npc),text:'Used this investigation to estimate the collection. Card identities, prices and findings remain private.'}];
}
export function chooseNpcInvestigation(choices:Investigation[],name:string,seed:number){
 const profile=AUCTION_NPCS.find(npc=>npc.name===name)??AUCTION_NPCS[0];
 const priorities:readonly string[]=profile.cluePriority;
 const weights=choices.map(option=>{const rank=priorities.indexOf(option.id);return rank<0?.15:[12,7,4,2][rank]});
 let roll=auctionRandom(seed)()*weights.reduce((sum,weight)=>sum+weight,0);
 return choices.find((_,index)=>{roll-=weights[index];return roll<0});
}
export function npcRoundInformation(auction:Auction,index:number,sample:number[],previous?:Npc,name=previous?.name??auctionNpcRoster(auction.seed)[index].name){
 const history=previous?.investigations??[],rank=auction.round===1?'targeted':auction.round===2?'strong':'premium';
 const ranks=['basic','targeted','strong','premium'];
 const priced=[...new Set([...publicAuctionSlots(auction),...sample,...(previous?.inspected??[])])],known=[...new Set([...priced,...(previous?.identified??[])])],personal={...auction,known,priced};
 const personalClues={...personal,clues:history.map(id=>({id,label:id,text:''}))};
 const choices=INVESTIGATIONS.filter(option=>NPC_INVESTIGATION_IDS.includes(option.id)&&!history.includes(option.id)&&ranks.indexOf(option.tier)<=ranks.indexOf(rank)&&informationUseful(personalClues,option.id));
 const chosen=chooseNpcInvestigation(choices,name,auction.seed+index*191+auction.round*43);
 const investigations=chosen?[...history,chosen.id]:history;
 const result=chosen?investigate(personal,chosen):null;
 const inspected=result?.priced??previous?.inspected??[],identified=result?.known??known,slots=[...new Set([...priced,...inspected])];
 const randomSlots=[...new Set([...publicAuctionSlots(auction),...sample])];
 const valuationClues=investigations.filter(id=>['bulk','rares','top5','appraisal','value-band','value-band4','common-count','uncommon-count','sets','rarities','duplicates'].includes(id)).map(id=>investigate(personal,INVESTIGATIONS.find(option=>option.id===id)!).clue);
 const value=npcKnowledgeValue({count:auction.lot.length,observed:slots.map(index=>auction.lot[index]),random:randomSlots.map(index=>auction.lot[index]),clues:valuationClues});
 return {investigations,inspected,identified,prices:slots.map(index=>auction.lot[index].cents),...value};
}
