import {INVESTIGATIONS,investigate,RETIRED_INVESTIGATION_IDS} from './auction-information.ts';
import {auctionRandom,type Auction,type Npc,type Clue,type Investigation} from './auction-types.ts';
import {publicAuctionSlots} from './auction-public.ts';
import {AUCTION_NPCS,auctionNpcRoster} from './auction-npcs.ts';
import {npcKnowledgeValue} from './auction-npc-valuation.ts';
import {REBALANCED_INVESTIGATIONS,followUpSlots,valuationClues} from './auction-investigations-v2.ts';
import {auctionClueReveals} from './auction-clue-reveals.ts';
import {npcCanInvestigate} from './auction-npc-schedule.ts';
import {REVISED_INVESTIGATIONS,investigationCensusBand} from './auction-investigations-v3.ts';

export const NPC_INVESTIGATION_IDS=['reveal3','bulk','rares','top5','top2','appraisal','common3','uncommon3','rare2','epic2','alt1','chase1','sets','rarities','duplicates','identity3','common-count','uncommon-count','rare8','epic5','alt3','value-band','value-band4',...REBALANCED_INVESTIGATIONS.map(option=>option.id),...REVISED_INVESTIGATIONS.map(option=>option.id)];
export function npcInvestigationEquivalent(id:string){return ({reveal3:'reveal5',bulk:'bulk-core-v3',rares:'alt-value-v3',top2:'top2-final',chase1:'chase-scan-v2',sets:'lot-audit-v3',rarities:'rarities-v3',duplicates:'lot-audit-v3',identity3:'identity5','common-count':'lot-audit-v3','uncommon-count':'lot-audit-v3',rare8:'rare12',epic5:'epic6',alt3:'alt4'} as Record<string,string>)[id]??id;}
export function npcInvestigationName(npc:Npc){return INVESTIGATIONS.find(option=>option.id===npc.investigations?.at(-1))?.label??'Card Inspection (Legacy)'}
export function npcInvestigationNotes(npc:Npc,round?:number):Clue[]{
 const id=npc.investigations?.at(-1);
 const finding=npc.findings?.findLast(clue=>clue.id===id);
 if(round!==undefined&&(!id||finding?.round!==undefined&&finding.round!==round))return [{id:'public-start',label:'Shared Public Reveals',text:'Used public reveals and retained earlier findings. No new private investigation this round.'}];
 return [{id:'public-start',label:'Shared Public Reveals',text:'Used the shared cards and prices revealed to all bidders.'},finding?{...finding,...(finding.reveals?{reveals:finding.reveals.map(reveal=>({...reveal}))}:{})}:{id:id??'legacy-inspection',label:npcInvestigationName(npc),text:'Detailed findings are unavailable for this older saved investigation.'}];
}
export function chooseNpcInvestigation(choices:Investigation[],name:string,seed:number){
 const profile=AUCTION_NPCS.find(npc=>npc.name===name)??AUCTION_NPCS[0];
 const priorities:readonly string[]=[...new Set(profile.cluePriority.map(npcInvestigationEquivalent))];
 const weights=choices.map(option=>{const rank=priorities.indexOf(option.id);return rank<0?.15:[12,7,4,2][rank]});
 let roll=auctionRandom(seed)()*weights.reduce((sum,weight)=>sum+weight,0);
 return choices.find((_,index)=>{roll-=weights[index];return roll<0});
}
function personalKnowledge(auction:Auction,previous?:Npc){
 const history=previous?.investigations??[];
 // Rebuild only recorded disclosures, never carry old automatic samples through
 // inspected/identified arrays or invent missing findings from a legacy save.
 const findings=previous?.findings??[],reveals=findings.flatMap(clue=>clue.reveals??[]);
 const priced=[...new Set([...publicAuctionSlots(auction),...reveals.filter(reveal=>reveal.visibility==='price').map(reveal=>reveal.slot)])],known=[...new Set([...priced,...reveals.filter(reveal=>reveal.visibility==='identity').map(reveal=>reveal.slot)])];
 const personal={...auction,known,priced,rarityKnown:reveals.filter(reveal=>reveal.visibility==='rarity').map(reveal=>reveal.slot),topCardSlot:undefined,clues:findings};
 return {history,priced,known,findings,personal};
}
export function npcRoundInformation(auction:Auction,index:number,_sample:number[],previous?:Npc,name=previous?.name??auctionNpcRoster(auction.seed)[index].name){
 const rank=auction.round===1?'targeted':auction.round===2?'strong':'premium',ranks=['basic','targeted','strong','premium'];
 const {history,priced,known,findings,personal}=personalKnowledge(auction,previous);
 const personalClues=personal;
 const choices=INVESTIGATIONS.filter(option=>NPC_INVESTIGATION_IDS.includes(option.id)&&!RETIRED_INVESTIGATION_IDS.includes(option.id)&&!history.includes(option.id)&&ranks.indexOf(option.tier)<=ranks.indexOf(rank)&&(option.id!=='top2-final'||auction.round===4)&&(option.id!=='follow-up'||followUpSlots(personalClues).length>0));
 const chosen=npcCanInvestigate(auction,name)?chooseNpcInvestigation(choices,name,auction.seed+index*191+auction.round*43):undefined;
 const investigations=chosen?[...history,chosen.id]:history;
 const result=chosen?investigate(personal,chosen,chosen.id==='follow-up'?followUpSlots(personal)[0]:undefined):null;
 const inspected=result?.priced??priced,identified=result?.known??known,slots=[...new Set([...priced,...inspected])];
 const randomSlots=publicAuctionSlots(auction);
 const nextFindings=result?[...findings,{...result.clue,round:auction.round,reveals:auctionClueReveals(personal,result)}]:findings;
 const rarityKnown=result?.rarityKnown??personal.rarityKnown,markedBands=[...new Set([...rarityKnown,...identified])].filter(slot=>!slots.includes(slot)).map(slot=>investigationCensusBand(auction.lot[slot]));
 const value=npcKnowledgeValue({count:auction.lot.length,observed:slots.map(index=>auction.lot[index]),random:randomSlots.map(index=>auction.lot[index]),clues:valuationClues(nextFindings),prior:auction.marketPrior,round:auction.round,kind:auction.kind,markedBands});
 return {investigations,inspected,identified,rarityKnown,findings:nextFindings,prices:slots.map(index=>auction.lot[index].cents),...value};
}
