"use client";
import {useState} from 'react';
import AuctionDialog from './AuctionDialog';
import {gameSharePath,type GameShare} from '../../core/domain/game-sharing';

export default function ShareGameResults({share,text}:{share:GameShare;text:(url:string)=>string}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const url=typeof window==='undefined'?'':`${window.location.origin}${gameSharePath(share)}`,content=text(url);
 const copy=async(value:string)=>{try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(value);setMessage('Copied to clipboard.')}catch{setMessage('Clipboard unavailable. Select and copy the preview below.')}};
 const native=async()=>{try{await navigator.share({title:'Raw Signal Daily Challenge',text:content});setMessage('Share sheet opened.')}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage('Sharing unavailable. Use Copy Results instead.')}};
 return <><button className="game-control" type="button" onClick={()=>{setOpen(true);setMessage('')}}>Share Results</button>{open&&<AuctionDialog title="Share Your Daily Results" onClose={()=>setOpen(false)}>
  <p className="games-note">Emoji results avoid card/price spoilers. The results link opens a detailed breakdown and contains spoilers. Scores are self-reported—not a verified leaderboard.</p>
  <label className="game-share-preview">Discord / Social Preview<textarea readOnly rows={7} value={content} onFocus={event=>event.target.select()}/></label>
  <div className="auction-actions"><button className="game-control" type="button" onClick={()=>void copy(content)}>Copy Results</button><button className="game-control" type="button" onClick={()=>void copy(url)}>Copy Results Link</button>{typeof navigator!=='undefined'&&typeof navigator.share==='function'&&<button className="game-control" type="button" onClick={()=>void native()}>Share…</button>}</div>
  <p role="status">{message}</p><a className="games-back" href={gameSharePath(share)} target="_blank" rel="noopener noreferrer">Preview Results Page →</a>
 </AuctionDialog>}</>;
}
