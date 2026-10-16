import type {Auction} from '../../core/domain/auction-types.ts';
import type {AuctionSoundCue} from './auction-sound.ts';

export function auctionSoundState(auction:Auction,visible:number){
 const hidden=auction.lot.map((_,slot)=>slot).filter(slot=>!auction.known.includes(slot)),shown=[...auction.known,...hidden.slice(0,Math.max(0,visible-auction.known.length))];
 const priceVisible=shown.filter(slot=>auction.stage==='result'||auction.priced.includes(slot));
 return {seed:auction.seed,stage:auction.stage,selected:auction.selected,locked:auction.npcs.filter(npc=>npc.locked).length,clues:auction.clues.length,visible,total:auction.lot.length,pending:auction.pendingFollowUp===true,won:auction.result?.winner==='You',priceVisible,blingSlots:priceVisible.filter(slot=>auction.lot[slot].cents>100000)};
}
export function auctionSoundEvents(previous:ReturnType<typeof auctionSoundState>|null,current:ReturnType<typeof auctionSoundState>):AuctionSoundCue[]{
 if(!previous||previous.seed!==current.seed)return current.stage==='round'&&current.visible>0?current.blingSlots?.length?['flip','bling']:['flip']:[];
 const cues:AuctionSoundCue[]=[];
 if(previous.stage!==current.stage&&current.stage==='result')cues.push(current.won?'win':'settled');
 if(current.clues>previous.clues)cues.push('investigation');
 if(previous.selected===null&&current.selected!==null&&current.stage==='round')cues.push('bid');
 else if(current.locked>previous.locked&&current.stage==='round')cues.push('rival');
 if(current.stage==='result'&&current.visible===current.total&&previous.visible<current.total)cues.push('counted');
 else if(current.visible>previous.visible||previous.pending&&!current.pending&&current.stage==='round')cues.push('flip');
 if(current.blingSlots?.some(slot=>!previous.priceVisible?.includes(slot)))cues.push('bling');
 return cues;
}
