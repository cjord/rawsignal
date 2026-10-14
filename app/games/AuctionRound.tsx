"use client";
import {useState} from 'react';
import InfoHint from '../InfoHint';
import AuctionBidder from './AuctionBidder';
import AuctionClueIcon from './AuctionClueIcon';
import {AuctionRoundBids} from './AuctionBidHistory';
import {auctionUsd} from './AuctionWallet';
import {AUCTION_ROUNDS,type Auction,type AuctionSave} from '../../core/domain/auction-types';
import {buyInformation,lockBid,nextAuctionRound,finishAuction} from '../../core/domain/auction-engine';

type Props={save:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void;revealDone?:boolean};
function RoundControls({save,now,transact}:Props){
 const auction=save.auction!,[bid,setBid]=useState(''),locked=auction.selected!==null,expired=now>=auction.deadline;
 const valid=/^\d+(\.\d{1,2})?$/.test(bid),cents=valid?Math.round(Number(bid)*100):NaN;
 const lock=(amount:number)=>transact(current=>lockBid(current,amount,Date.now()));
 return <>
  <section className="detail-section auction-investigate"><h2>Investigate <InfoHint label="Investigation rules">Optional: one purchase per round. Costs are not refunded if you lose.</InfoHint></h2>
   <div className="auction-offers">{auction.offers.map(option=><button className="game-control" type="button" key={option.id} disabled={locked||expired||auction.bought||save.wallet.cash<option.cost} onClick={()=>transact(current=>buyInformation(current,option.id,Date.now()))}><AuctionClueIcon id={option.id}/><span>{option.label}</span><strong>{auctionUsd(option.cost)}</strong></button>)}</div>
   {auction.bought&&<p role="status" className="games-note">Investigation purchased. Its result stays in your notes.</p>}
  </section>
  <section className="detail-section auction-bidding" id="auction-bidding"><div className="auction-bidding-heading"><h2>{locked?'Bid Locked':'Place Your Bid'} <InfoHint label="Bidding rules">Each round is a new total bid, not an added payment. Locking is irreversible. Unsubmitted bids become $0 at the deadline.</InfoHint></h2><div className="auction-balance"><small>Available Balance</small><strong>{auctionUsd(save.wallet.cash)}</strong></div></div>
   {locked?<p className="auction-locked-amount">{auctionUsd(auction.selected!)} · waiting for bidders</p>:<form className="auction-bid-form" onSubmit={event=>{event.preventDefault();if(!expired&&valid&&Number.isSafeInteger(cents)&&cents<=save.wallet.cash)lock(cents)}}><label>Bid (virtual USD)<input inputMode="decimal" type="text" value={bid} disabled={expired} onChange={event=>setBid(event.target.value)}/></label><button className="game-control" type="submit" disabled={expired||!valid||!Number.isSafeInteger(cents)||cents>save.wallet.cash}>Lock Bid</button><button className="game-control" type="button" disabled={expired} onClick={()=>lock(0)}>Pass ($0)</button></form>}
   <ul className="auction-npcs"><li className={locked?'is-locked':''}><AuctionBidder name="You"/><span className="auction-lock-status"><span>{locked?'Locked':'Considering…'}</span><span className="auction-bid-clues">{auction.clues.map(clue=><AuctionClueIcon key={clue.id} id={clue.id}/>)}</span></span></li>{auction.npcs.map(npc=><li key={npc.name} className={npc.locked?'is-locked':''}><AuctionBidder name={npc.name}/><span className="auction-lock-status"><span>{npc.locked?'Locked':'Considering…'}</span><AuctionClueIcon id="identity3"/></span></li>)}</ul>
  </section>
 </>;
}
export function AuctionRoundHeader({auction,now}:{auction:Auction;now:number}){
 const seconds=Math.min(60,Math.max(0,Math.ceil((auction.deadline-now)/1000)));
 return <div className="auction-round-header"><div className="auction-round-heading"><strong>Round {auction.round} / 4</strong><span className={`auction-timer${auction.stage==='round'&&seconds<=10?' is-urgent':''}`} role="timer" aria-live="off">{auction.stage==='round'?`${seconds}s`:'Bids Revealed'}</span>{auction.stage==='round'&&<a className="games-back" href="#auction-bidding">Jump to Bid ↓</a>}</div>
  <p className="games-note">{auction.round<4?`Buyout: top bid must be ${AUCTION_ROUNDS[auction.round-1].threshold}% above second place, with at least two positive bids.`:'Final round: highest positive bid wins; seeded priority breaks ties. All passes mean no sale.'}</p>
 </div>;
}
export default function AuctionRound({save,now,transact,revealDone=true}:Props){
 const auction=save.auction!;
 return <div className={`auction-round-panel${auction.stage==='round'?'':' is-results'}`}>
  {auction.stage==='round'?<RoundControls key={auction.round} save={save} now={now} transact={transact}/>:<section className="detail-section auction-results"><h2>{auction.stage==='result'?'Auction Settled':'Round Bids'}</h2>
   {auction.stage==='reveal'?<><p className="auction-no-buyout">No Early Buyout</p><p className="games-note">The buyout threshold wasn’t met. Another round gives you a fresh chance to win.</p><AuctionRoundBids auction={auction}/><button className="game-control" type="button" onClick={()=>transact(current=>nextAuctionRound(current,Date.now()))}>Next auction round</button></>:revealDone?<AuctionOutcome save={save} transact={transact}/>:<p role="status">Revealing the collection…</p>}
  </section>}
 </div>;
}
function AuctionOutcome({save,transact}:Omit<Props,'now'>){
 const result=save.auction!.result!,won=result.winner==='You',playerNet=won?result.net:-result.playerExpenses;
 return <><div className="auction-settled-winner" role="status">{result.winner?<><AuctionBidder name={result.winner}/><span>won{result.buyout?' by early buyout':''} for {auctionUsd(result.bid)}.</span></>:'No positive bids: this collection was not sold.'}</div>
  <dl className="auction-result-metrics"><div className="is-info"><dt>Collection Market Value</dt><dd>{auctionUsd(result.value)}</dd></div><div className={!result.winner?'':result.value>=result.bid?'is-gain':'is-loss'}><dt>Gross Market Spread</dt><dd>{result.winner?auctionUsd(result.value-result.bid):'N/A'}</dd></div><div className="is-cost"><dt>Modeled Selling Fee ({save.auction!.feeBps/100}%)</dt><dd>{auctionUsd(result.fee)}</dd></div><div className={!result.winner?'':result.net>=0?'is-gain':'is-loss'}><dt>Winner Net Profit / Loss</dt><dd>{result.winner?auctionUsd(result.net):'N/A'}</dd></div><div className="is-cost"><dt>Your Investigation Spend</dt><dd>{auctionUsd(result.playerExpenses)}</dd></div><div className={playerNet>=0?'is-gain':'is-loss'}><dt>Your Auction Result</dt><dd>{auctionUsd(playerNet)}</dd></div></dl>
  {won&&<p className="games-note">The collection is now in your inventory. Its current market value may change; selling is optional.</p>}
  <button className="game-control auction-finish" type="button" onClick={()=>transact(finishAuction)}>Finish &amp; manage inventory</button>
 </>;
}
