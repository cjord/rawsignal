export const AUCTION_SOUND_CUES={tick:{from:520,to:520,duration:.15,volume:.025},round:{from:780,to:1040,duration:.15,volume:.03},flip:{from:700,to:180,duration:.045,volume:.012},investigation:{from:660,to:1320,duration:.2,volume:.025},bid:{from:380,to:570,duration:.12,volume:.025},rival:{from:320,to:300,duration:.04,volume:.008},win:{from:660,to:1760,duration:.4,volume:.03},settled:{from:440,to:330,duration:.22,volume:.02},counted:{from:880,to:1320,duration:.24,volume:.02}} as const;
export type AuctionSoundCue=keyof typeof AUCTION_SOUND_CUES;
export function playAuctionSound(audio:AudioContext|null,enabled:boolean,cue:AuctionSoundCue){
 if(!enabled||!audio||audio.state!=='running'||document.hidden)return;
 try{
  const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;
  const {from,to,duration,volume}=AUCTION_SOUND_CUES[cue];
  oscillator.type=cue==='flip'?'triangle':'sine';
  oscillator.frequency.setValueAtTime(from,start);
  oscillator.frequency.exponentialRampToValueAtTime(to,start+duration);
  gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+duration+.01);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
 }catch{/* Optional sound must never interrupt gameplay. */}
}
