export type AuctionSoundCue='tick'|'round'|'flip'|'investigation';
export function playAuctionSound(audio:AudioContext|null,enabled:boolean,cue:AuctionSoundCue){
 if(!enabled||!audio||audio.state!=='running'||document.hidden)return;
 try{
  const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;
  const flip=cue==='flip',investigation=cue==='investigation',tick=cue==='tick',duration=flip?.045:investigation?.2:.15;
  oscillator.type=flip?'triangle':'sine';
  oscillator.frequency.setValueAtTime(flip?700:investigation?660:tick?520:780,start);
  oscillator.frequency.exponentialRampToValueAtTime(flip?180:investigation?1320:tick?520:1040,start+duration);
  gain.gain.setValueAtTime(flip?.012:.035,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+duration+.01);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
 }catch{/* Optional sound must never interrupt gameplay. */}
}
