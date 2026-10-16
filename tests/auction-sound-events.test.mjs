import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionSoundEvents} from '../app/games/auction-sound-events.ts';
import {AUCTION_SOUND_CUES,playAuctionSound} from '../app/games/auction-sound.ts';
test('audio event cues are transition-only and distinguish locks, win/loss, inspection and count completion',()=>{
 const base={seed:1,stage:'round',selected:null,locked:0,clues:0,visible:3,total:30,pending:false,won:false};
 assert.deepEqual(auctionSoundEvents(null,base),['flip']);assert.deepEqual(auctionSoundEvents(base,base),[]);assert.deepEqual(auctionSoundEvents(base,{...base,seed:2}),['flip']);assert.deepEqual(auctionSoundEvents(null,{...base,stage:'result',visible:30}),[]);
 for(const [change,cue] of [[{selected:0},'bid'],[{locked:1},'rival'],[{stage:'result',won:true},'win'],[{stage:'result'},'settled'],[{clues:1},'investigation'],[{visible:4},'flip']])assert.ok(auctionSoundEvents(base,{...base,...change}).includes(cue));
 assert.deepEqual(auctionSoundEvents({...base,pending:true},base),['flip']);assert.deepEqual(auctionSoundEvents({...base,stage:'result'},{...base,stage:'result',visible:30}),['counted']);
});
test('all sound cues are bounded in volume and duration, and muted/background playback makes no audio nodes',()=>{
 const previous=globalThis.document;let nodes=0;globalThis.document={hidden:false};const audio={state:'running',createOscillator(){nodes++;throw new Error('not expected')}};
 try{for(const cue of Object.keys(AUCTION_SOUND_CUES)){const spec=AUCTION_SOUND_CUES[cue];assert.ok(spec.volume<=.035&&spec.duration<=.4);playAuctionSound(audio,false,cue);globalThis.document.hidden=true;playAuctionSound(audio,true,cue);}assert.equal(nodes,0);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
