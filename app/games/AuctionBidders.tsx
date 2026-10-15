import type {Auction} from '../../core/domain/auction-types';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';
import {auctionWinner} from '../../core/domain/auction-engine';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
import InfoHint from '../InfoHint';
import {INVESTIGATIONS} from '../../core/domain/auction-information';

export default function AuctionBidders({auction}:{auction:Auction}){
 const bidders=[{name:'You',locked:auction.selected!==null},...auction.npcs];
 return <ul className="auction-npcs">{bidders.map(bidder=><li key={bidder.name} className={bidder.locked?'is-locked':''}>
  <div className="auction-bid-status"><BidderIdentity name={bidder.name}/><span className="auction-lock-status">{bidder.locked?'Locked':'Considering…'}</span></div>
  {auction.round>1&&<div className="auction-previous-bids" role="group" aria-label={`${bidder.name} previous round bids`}>{Array.from({length:auction.round-1},(_,index)=>{const bids=auction.bidHistory[index],bid=bids?.find(bid=>bid.name===bidder.name),leader=bids?auctionWinner(bids,4,auction.seed).winner?.name:null;return <span key={index} role="group" className={`auction-prior-bid${leader===bidder.name?' is-round-leader':''}`} aria-label={`${bidder.name}, round ${index+1}${leader===bidder.name?', winning bid':''}`}><small>Round {index+1}</small><strong>{bid?auctionUsd(bid.cents):'N/A'}</strong></span>})}</div>}
 </li>)}</ul>;
}
function BidderIdentity({name}:{name:string}){
 const profile=AUCTION_NPCS.find(npc=>npc.name===name);
 const priorities=profile?.cluePriority.map(id=>INVESTIGATIONS.find(option=>option.id===id)?.label??id).join(', ');
 const detail=profile?`${profile.strategy}. ${profile.description} Favored investigations: ${priorities}. Bids use public reveals and personal clues, with occasional small nudges from previous public bids—never your locked current-round bid or the full hidden collection.`:undefined;
 return <span className="auction-bidder-identity"><AuctionBidder name={name} detail={detail}/>{profile&&<InfoHint label={`${name} profile`}>{detail}</InfoHint>}</span>;
}
