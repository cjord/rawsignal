"use client";
import {useState} from 'react';
import type {AuctionSave} from '../../core/domain/auction-types';
import {dailyAuctionDate,startDailyAuction} from '../../core/domain/auction-daily';
import {validDailyManifest} from '../../core/domain/auction-save';
import {auctionUsd} from './AuctionWallet';
import ShareGameResults from './ShareGameResults';
import {auctionShareText} from '../../core/domain/game-sharing';

type Props={root:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void;enter:(kind:'free'|'paid')=>Promise<void>;preparing:boolean};
export default function AuctionDaily({root,now,transact,enter,preparing}:Props){
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const daily=root.daily?.date===dailyAuctionDate(now)?root.daily:null;
 const start=async()=>{
  setLoading(true);setError('');
  try{const response=await fetch('/api/auction/daily',{cache:'no-store'});if(!response.ok)throw new Error();const manifest:unknown=await response.json();if(!validDailyManifest(manifest))throw new Error();transact(current=>startDailyAuction(current,manifest,Date.now()))}
  catch{setError('The daily lineup is unavailable. Your attempt has not started. Please retry later.')}
  finally{setLoading(false)}
 };
 if(daily?.status==='playing'&&daily.save.auction)return <section className="detail-section auction-daily"><strong>Daily Challenge · Auction {daily.index+1} / 5</strong><span className="games-note"> · Challenge Cash {auctionUsd(daily.save.wallet.cash)} · Resets at midnight UTC</span></section>;
 return <section className="detail-section auction-daily"><h2>Daily Five-Auction Challenge</h2><p>Same collections. Same rivals. One daily run.</p><p className="games-note">Start with $2,500 challenge cash: three free auctions, then two $50 auctions. Won cards auto-sell after each auction at frozen prices less a fixed 10% fee. Complete all five to keep 25% of positive net profit in your normal wallet, with no cap. This is virtual cash.</p>
  <p className="games-note">Resets at midnight UTC. Active timers continue when away; unfinished runs expire without a reward. Browser-only attempt limit—not a secure leaderboard. Leaving an auction ends the run. Resetting normal progress does not reset today’s attempt.</p>
  {root.auction&&!daily&&<p className="games-note">Finish your current normal auction before starting the daily challenge.</p>}
  {!daily?<button type="button" className="game-control auction-finish" disabled={loading||!!root.auction} onClick={()=>void start()}>{loading?'Loading Daily Lineup…':'Start Daily Challenge'}</button>:<>
   <p className="auction-daily-bankroll">Challenge Cash: <strong>{auctionUsd(daily.save.wallet.cash)}</strong> · {daily.status==='playing'?`Auction ${daily.index+1} / 5`:daily.status==='completed'?'Challenge Complete':'Run Ended'}</p>
   {daily.status==='completed'?<><p role="status">{auctionUsd(daily.reward)} added to your normal wallet. Next challenge at midnight UTC.</p>{daily.receipts?.length===5&&<ShareGameResults share={{v:1,g:'auction',d:daily.date,r:daily.receipts}} text={url=>auctionShareText(daily.manifest,daily.receipts!,url)}/>}</>:daily.status==='failed'?<p role="status">No completion reward. Your normal wallet is unchanged.</p>:!daily.save.auction&&<button type="button" className="game-control auction-finish" disabled={preparing} onClick={()=>void enter(daily.manifest.auctions[daily.index].kind)}>{preparing?'Preparing Auction…':`Enter Auction ${daily.index+1} · ${daily.index<3?'Free':'$50'}`}</button>}
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
