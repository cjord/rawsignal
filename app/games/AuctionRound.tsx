"use client";
import {useState} from 'react';
import InfoHint from '../InfoHint';
import AuctionBidder from './AuctionBidder';
import AuctionBidders from './AuctionBidders';
import {AuctionRoundBids} from './AuctionBidHistory';
import {auctionUsd} from './AuctionWallet';
import {AUCTION_ROUNDS,type Auction,type AuctionSave} from '../../core/domain/auction-types';
import {lockBid,nextAuctionRound,finishAuction} from '../../core/domain/auction-engine';
import AuctionInvestigate from './AuctionInvestigate';
import AuctionResultMetrics from './AuctionResultMetrics';

type Props={save:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void;revealDone?:boolean;visible?:number[]};
function RoundControls({save,now,transact}:Props){
 const auction=save.auction!,[bid,setBid]=useState(''),locked=auction.selected!==null,expired=now>=auction.deadline;
 const valid=/^\d+(\.\d{1,2})?$/.test(bid),cents=valid?Math.round(Number(bid)*100):NaN;
 const lock=(amount:number)=>transact(current=>lockBid(current,amount,Date.now()));
 return <>
  <AuctionInvestigate save={save} now={now} transact={transact}/>
  <section className="detail-section auction-bidding" id="auction-bidding"><div className="auction-bidding-heading"><h2>{locked?'Bid Locked':'Place Your Bid'} <InfoHint label="Bidding rules">Each round is a new total bid, not an added payment. Locking is irreversible. Unsubmitted bids become $0 at the deadline.</InfoHint></h2><div className="auction-balance"><small>Available Balance</small><strong>{auctionUsd(save.wallet.cash)}</strong></div></div>
   {locked?<p className="auction-locked-amount">{auctionUsd(auction.selected!)} · waiting for bidders</p>:<form className="auction-bid-form" onSubmit={event=>{event.preventDefault();if(!expired&&valid&&Number.isSafeInteger(cents)&&cents<=save.wallet.cash)lock(cents)}}><label>Bid (virtual USD)<input inputMode="decimal" type="text" value={bid} disabled={expired} onChange={event=>setBid(event.target.value)}/></label><button className="game-control" type="submit" disabled={expired||!valid||!Number.isSafeInteger(cents)||cents>save.wallet.cash}>Lock Bid</button><button className="game-control" type="button" disabled={expired} onClick={()=>lock(0)}>Pass ($0)</button></form>}
   <AuctionBidders auction={auction}/>
  </section>
 </>;
}
export function AuctionRoundHeader({auction,now}:{auction:Auction;now:number}){
 const seconds=Math.min(60,Math.max(0,Math.ceil((auction.deadline-now)/1000)));
 return <div className="detail-section auction-round-header"><div className="auction-round-heading"><strong>Round {auction.round} / 4</strong><span className={`auction-timer${auction.stage==='round'&&seconds<=10?' is-urgent':''}`} role="timer" aria-live="off">{auction.stage==='round'?`${seconds}s`:'Bids Revealed'}</span></div>
  <p className="games-note">{auction.round<4?`Buyout: top bid must be ${AUCTION_ROUNDS[auction.round-1].threshold}% above second place, with at least two positive bids.`:'Final round: highest positive bid wins; seeded priority breaks ties. All passes mean no sale.'}</p>
 </div>;
}
export default function AuctionRound({save,now,transact,revealDone=true,visible=save.auction!.lot.map((_,index)=>index)}:Props){
 const auction=save.auction!;
 return <div className={`auction-round-panel${auction.stage==='round'?'':' is-results'}`}>
  {auction.stage==='round'?<RoundControls key={auction.round} save={save} now={now} transact={transact}/>:<section className="detail-section auction-results" id={auction.stage==='result'?'auction-settled':undefined}><h2>{auction.stage==='result'?'Auction Settled':'Round Bids'}</h2>
   {auction.stage==='reveal'?<><p className="auction-no-buyout">No Early Buyout</p><p className="games-note">The buyout threshold wasn’t met. Another round gives you a fresh chance to win.</p><AuctionRoundBids auction={auction}/><button className="game-control auction-finish auction-next-round" type="button" onClick={()=>transact(current=>nextAuctionRound(current,Date.now()))}>Next Auction Round</button></>:<AuctionOutcome save={save} transact={transact} revealDone={revealDone} visible={visible}/>}
  </section>}
 </div>;
}
function AuctionOutcome({save,transact,revealDone=true,visible=[]}:Omit<Props,'now'>){
 const result=save.auction!.result!,won=result.winner==='You';
 return <><div className="auction-settled-winner" role="status">{result.winner?<><AuctionBidder name={result.winner}/><span>won{result.buyout?' by early buyout':''} for {auctionUsd(result.bid)}.</span></>:'No positive bids: this collection was not sold.'}</div>
  <AuctionResultMetrics auction={save.auction!} visible={visible} done={revealDone}/>
  {won&&<p className="games-note">The cards you won have been added to your inventory. Market values can change daily—sell whenever you’re ready between auctions.</p>}
  <div className="auction-finish-actions"><button className={`game-control${revealDone?' auction-finish':''}`} disabled={!revealDone} type="button" onClick={()=>transact(finishAuction)}>Finish &amp; Manage Inventory</button></div>
 </>;
}
