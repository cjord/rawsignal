"use client";
import {useState} from 'react';
import type {AuctionSave} from '../../core/domain/auction-types';
import {dailyAuctionDate,startDailyAuction} from '../../core/domain/auction-daily';
import {validDailyManifest} from '../../core/domain/auction-save';
import {auctionUsd} from './AuctionWallet';
import ShareGameResults from './ShareGameResults';
import {auctionShareText} from '../../core/domain/game-sharing';
import AuctionDailyArtwork from './AuctionDailyArtwork';
import InfoHint from '../InfoHint';

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
 return <section className="detail-section auction-daily"><h2>Daily Five-Auction Challenge</h2><p className="auction-daily-intro">Build your bankroll across five auctions. Everyone faces the same collections and rivals in today’s lineup.</p>
  <dl className="auction-daily-facts"><div><dt>Starting Cash</dt><dd>$2,500 <small>Separate virtual bankroll</small></dd></div><div><dt>The Lineup</dt><dd>3 Bilgewater + 2 Piltover <small>Free entry, then $50 per auction</small></dd></div><div><dt>Completion Reward</dt><dd>25% of Net Profit <small>Positive profit only · No cap</small></dd></div></dl>
  <p className="auction-daily-rules">Won cards sell automatically after each auction at the daily lineup’s frozen prices, less the 10% selling fee. Finish all five to add your reward to your normal wallet. Challenge losses never reduce your normal cash or inventory.</p>
  <p className="auction-daily-deadline"><strong>Finish before midnight UTC.</strong> Active round timers keep running while you’re away. Leaving an auction, or being unable to pay the next entry fee, ends the run. Unfinished runs expire without a reward.</p>
  <p className="games-note">One attempt per day <InfoHint label="Daily attempt rules">The attempt limit is stored in this browser, so it is not a secure competition. Resetting normal progress does not reset today’s attempt. You can resume between auctions until midnight UTC.</InfoHint></p>
  {root.auction&&!daily&&<p className="games-note">Finish your current normal auction before starting the daily challenge.</p>}
  {!daily?<button type="button" className="game-control auction-entry-card auction-daily-entry auction-daily-start" aria-label="Start Daily Challenge" aria-busy={loading} disabled={loading||!!root.auction} onClick={()=>void start()}><AuctionDailyArtwork title={loading?'Loading Daily Lineup…':'Start Daily Challenge'} description="Five auctions · One daily run"/></button>:<>
   <p className="auction-daily-bankroll">Challenge Cash: <strong>{auctionUsd(daily.save.wallet.cash)}</strong> · {daily.status==='playing'?`Auction ${daily.index+1} / 5`:daily.status==='completed'?'Challenge Complete':'Run Ended'}</p>
   {daily.status==='completed'?<><p role="status">{auctionUsd(daily.reward)} added to your normal wallet. Next challenge at midnight UTC.</p>{daily.receipts?.length===5&&<ShareGameResults share={{v:1,g:'auction',d:daily.date,r:daily.receipts}} text={url=>auctionShareText(daily.manifest,daily.receipts!,url)}/>}</>:daily.status==='failed'?<p role="status">No completion reward. Your normal wallet is unchanged.</p>:!daily.save.auction&&<button type="button" className="game-control auction-finish" disabled={preparing} onClick={()=>void enter(daily.manifest.auctions[daily.index].kind)}>{preparing?'Preparing Auction…':`Enter Auction ${daily.index+1} · ${daily.index<3?'Free':'$50'}`}</button>}
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
