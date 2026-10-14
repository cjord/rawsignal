import type {Auction} from '../../core/domain/auction-types';
import AuctionBidder from './AuctionBidder';
import AuctionClueIcon from './AuctionClueIcon';
import {auctionUsd} from './AuctionWallet';

export default function AuctionBidders({auction}:{auction:Auction}){
 const bidders=[{name:'You',locked:auction.selected!==null},...auction.npcs];
 return <ul className="auction-npcs">{bidders.map(bidder=><li key={bidder.name} className={bidder.locked?'is-locked':''}>
  <div className="auction-bid-status"><AuctionBidder name={bidder.name}/><span className="auction-lock-status"><span>{bidder.locked?'Locked':'Considering…'}</span><span className="auction-bid-clues">{bidder.name==='You'?auction.clues.map(clue=><AuctionClueIcon key={clue.id} id={clue.id}/>):<AuctionClueIcon id="identity3"/>}</span></span></div>
  {auction.round>1&&<div className="auction-previous-bids" aria-label={`${bidder.name} previous round bids`}><small>Previous Bids</small>{Array.from({length:auction.round-1},(_,index)=>{const bid=auction.bidHistory[index]?.find(bid=>bid.name===bidder.name);return <span key={index}><small>R{index+1}</small><strong>{bid?auctionUsd(bid.cents):'N/A'}</strong></span>})}</div>}
 </li>)}</ul>;
}
