"use client";
import {useState} from 'react';
import {auctionUsd} from './AuctionWallet';
import {AUCTION_ROUNDS,type Auction,type AuctionSave} from '../../core/domain/auction-types';
import {buyInformation,lockBid,nextAuctionRound,finishAuction} from '../../core/domain/auction-engine';

type Props={save:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void};
function RoundControls({save,now,transact}:Props){
 const auction=save.auction!,[bid,setBid]=useState(''),locked=auction.selected!==null,expired=now>=auction.deadline;
 const valid=/^\d+(\.\d{1,2})?$/.test(bid),cents=valid?Math.round(Number(bid)*100):NaN;
 const lock=(amount:number)=>transact(current=>lockBid(current,amount,Date.now()));
 return <>
  <section className="detail-section auction-investigate"><h2>Investigate</h2><p className="games-note">Optional · one purchase per round · costs are not refunded if you lose.</p>
   <div className="auction-offers">{auction.offers.map(option=><button className="game-control" type="button" key={option.id} disabled={locked||expired||auction.bought||save.wallet.cash<option.cost} onClick={()=>transact(current=>buyInformation(current,option.id,Date.now()))}><span>{option.label}</span><strong>{auctionUsd(option.cost)}</strong></button>)}</div>
   {auction.bought&&<p role="status" className="games-note">Investigation purchased. Its result stays in your notes.</p>}
  </section>
  <section className="detail-section auction-bidding" id="auction-bidding"><h2>{locked?'Bid locked':'Place your bid'}</h2><p className="games-note">Available cash: {auctionUsd(save.wallet.cash)}. Each round is a new total bid—not an added payment.</p>
   {locked?<p className="auction-locked-amount">{auctionUsd(auction.selected!)} · waiting for bidders</p>:<><label>Bid (virtual USD)<input inputMode="decimal" type="text" value={bid} disabled={expired} onChange={event=>setBid(event.target.value)} aria-describedby="auction-bid-help"/></label><p id="auction-bid-help" className="games-note">Up to {auctionUsd(save.wallet.cash)}; locking is irreversible for this round.</p><div className="auction-actions">
    {[2500,10000,25000].map(amount=><button key={amount} type="button" className="game-control" disabled={amount>save.wallet.cash||expired} onClick={()=>setBid(String(amount/100))}>{auctionUsd(amount)}</button>)}
    <button className="game-control" type="button" disabled={expired||!valid||!Number.isSafeInteger(cents)||cents>save.wallet.cash} onClick={()=>lock(cents)}>Lock Bid</button><button className="game-control" type="button" disabled={expired} onClick={()=>lock(0)}>Pass ($0)</button>
   </div></>}
   <ul className="auction-npcs">{auction.npcs.map(npc=><li key={npc.name}><b>{npc.name}</b><span>{npc.locked?'Locked':'Considering…'}</span></li>)}</ul>
  </section>
 </>;
}
export function AuctionRoundHeader({auction,now}:{auction:Auction;now:number}){
 return <div className="auction-round-header"><div className="auction-round-heading"><strong>Round {auction.round} / 4</strong><span role="timer" aria-live="off">{auction.stage==='round'?`${Math.min(AUCTION_ROUNDS[auction.round-1].seconds,Math.max(0,Math.ceil((auction.deadline-now)/1000)))}s remaining`:'Bids revealed'}</span>{auction.stage==='round'&&<a className="games-back" href="#auction-bidding">Jump to bid ↓</a>}</div>
  <p className="games-note">{auction.round<4?`Buyout: top bid must be ${AUCTION_ROUNDS[auction.round-1].threshold}% above second place, with at least two positive bids.`:'Final round: highest positive bid wins; seeded priority breaks ties. All passes mean no sale.'}</p>
 </div>;
}
export default function AuctionRound({save,now,transact}:Props){
 const auction=save.auction!;
 return <div className="auction-round-panel">
  {auction.stage==='round'?<RoundControls key={auction.round} save={save} now={now} transact={transact}/>:<section className="detail-section auction-results"><h2>{auction.stage==='result'?'Auction settled':'Round bids'}</h2>
   <ul className="auction-bid-reveal">{auction.bids.map(bid=><li className={bid.cents>0&&bid.cents===Math.max(...auction.bids.map(row=>row.cents))?'is-leading':''} key={bid.name}><b>{bid.name}</b><strong>{auctionUsd(bid.cents)}</strong></li>)}</ul>
   {auction.stage==='reveal'?<><p>No early buyout. Previous bids expire before the next round.</p><button className="game-control" type="button" onClick={()=>transact(current=>nextAuctionRound(current,Date.now()))}>Next auction round</button></>:<AuctionOutcome save={save} transact={transact}/>}
  </section>}
 </div>;
}
function AuctionOutcome({save,transact}:Omit<Props,'now'>){
 const result=save.auction!.result!,won=result.winner==='You',playerNet=won?result.net:-result.playerExpenses;
 return <><p role="status">{result.winner?`${result.winner} won${result.buyout?' by early buyout':''} for ${auctionUsd(result.bid)}.`:'No positive bids: this collection was not sold.'}</p>
  <dl className="auction-result-metrics"><div><dt>Collection market value</dt><dd>{auctionUsd(result.value)}</dd></div><div><dt>Gross market spread</dt><dd>{result.winner?auctionUsd(result.value-result.bid):'N/A'}</dd></div><div><dt>Modeled selling fee ({save.auction!.feeBps/100}%)</dt><dd>{auctionUsd(result.fee)}</dd></div><div><dt>Winner net profit / loss</dt><dd>{result.winner?auctionUsd(result.net):'N/A'}</dd></div><div><dt>Your investigation spend</dt><dd>{auctionUsd(result.playerExpenses)}</dd></div><div><dt>Your auction result</dt><dd className={playerNet>=0?'up':'down'}>{auctionUsd(playerNet)}</dd></div></dl>
  <p className="games-note">{won?'The collection is now in your inventory. Its current market value may change; selling is optional.':'Your losing bid was not charged. Investigation expenses remain spent.'} Virtual modeled proceeds—not guaranteed resale profit. Free entry: $0. NPC private clues have no modeled investigation charge in this prototype.</p>
  <button className="game-control" type="button" onClick={()=>transact(finishAuction)}>Finish &amp; manage inventory</button>
 </>;
}
