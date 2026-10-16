import type {Auction} from '../../core/domain/auction-types.ts';
import type {AuctionSoundCue} from './auction-sound.ts';

export function auctionSoundState(auction:Auction,visible:number){return {seed:auction.seed,stage:auction.stage,selected:auction.selected,locked:auction.npcs.filter(npc=>npc.locked).length,clues:auction.clues.length,visible,total:auction.lot.length,pending:auction.pendingFollowUp===true,won:auction.result?.winner==='You'};}
export function auctionSoundEvents(previous:ReturnType<typeof auctionSoundState>|null,current:ReturnType<typeof auctionSoundState>):AuctionSoundCue[]{
 if(!previous||previous.seed!==current.seed)return current.stage==='round'&&current.visible>0?['flip']:[];
 const cues:AuctionSoundCue[]=[];
 if(previous.stage!==current.stage&&current.stage==='result')cues.push(current.won?'win':'settled');
 if(current.clues>previous.clues)cues.push('investigation');
 if(previous.selected===null&&current.selected!==null&&current.stage==='round')cues.push('bid');
 else if(current.locked>previous.locked&&current.stage==='round')cues.push('rival');
 if(current.stage==='result'&&current.visible===current.total&&previous.visible<current.total)cues.push('counted');
 else if(current.visible>previous.visible||previous.pending&&!current.pending&&current.stage==='round')cues.push('flip');
 return cues;
}
