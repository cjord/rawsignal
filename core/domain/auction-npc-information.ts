import {INVESTIGATIONS,investigate} from './auction-information.ts';
import {sampleIndices,type Auction,type Npc,type Clue} from './auction-types.ts';
import {auctionSampleValue,publicAuctionSlots} from './auction-public.ts';

export const NPC_INVESTIGATION_IDS=['reveal3','bulk','rares','top5','appraisal'];
export function npcInvestigationName(npc:Npc){return INVESTIGATIONS.find(option=>option.id===npc.investigations?.at(-1))?.label??'Card Inspection (Legacy)'}
export function npcInvestigationNotes(npc:Npc):Clue[]{
 const id=npc.investigations?.at(-1);
 return [{id:'public-start',label:'Shared Public Reveals',text:'Used the shared cards and prices revealed to all bidders.'},{id:id??'legacy-inspection',label:npcInvestigationName(npc),text:'Used this investigation to estimate the collection. Card identities, prices and findings remain private.'}];
}
const amounts=(clue:Clue)=>[...clue.text.matchAll(/\$([\d,.]+)/g)].map(match=>Math.round(Number(match[1].replaceAll(',',''))*100));
function aggregateEstimate(auction:Auction,ids:string[],slots:number[],mean:number){
 const id=ids.includes('appraisal')?'appraisal':[...ids].reverse().find(id=>id!=='reveal3');
 if(!id)return mean*auction.lot.length;
 const clue=investigate(auction,INVESTIGATIONS.find(option=>option.id===id)!).clue,values=amounts(clue);
 if(id==='appraisal')return (values[0]+values[1])/2;
 if(id==='top5'){const count=Math.min(5,auction.lot.length);return values[0]+Math.min(mean,values[0]/count)*(auction.lot.length-count)}
 const included=(rarity:string)=>id==='bulk'?/^(common|uncommon)$/i.test(rarity):/^rare$/i.test(rarity);
 // Only the chosen aggregate is exact. The rest is extrapolated from personally
 // inspected cards, NOT the actual hidden count or prices outside the clue.
 const outside=auctionSampleValue(slots.map(index=>included(auction.lot[index].rarity)?0:auction.lot[index].cents));
 return values[0]+outside*auction.lot.length;
}
export function npcRoundInformation(auction:Auction,index:number,sample:number[],previous?:Npc){
 const history=previous?.investigations??[],rank=auction.round===1?'targeted':auction.round===2?'strong':'premium';
 const ranks=['basic','targeted','strong','premium'];
 const choices=INVESTIGATIONS.filter(option=>NPC_INVESTIGATION_IDS.includes(option.id)&&!history.includes(option.id)&&ranks.indexOf(option.tier)<=ranks.indexOf(rank));
 const chosen=choices[sampleIndices(choices.length,1,auction.seed+index*191+auction.round*43)[0]];
 const investigations=chosen?[...history,chosen.id]:history,known=[...new Set([...publicAuctionSlots(auction),...sample,...(previous?.inspected??[])])];
 const result=chosen?.id==='reveal3'?investigate({...auction,known,priced:known},chosen):null;
 const inspected=result?.priced??previous?.inspected??[],slots=[...new Set([...known,...inspected])];
 const prices=slots.map(index=>auction.lot[index].cents),shared=auctionSampleValue(publicAuctionSlots(auction).map(index=>auction.lot[index].cents)),mean=shared*.25+auctionSampleValue(prices)*.75;
 return {investigations,inspected,prices,estimate:aggregateEstimate(auction,investigations,slots,mean)};
}
