import type {Auction} from '../../core/domain/auction-types';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';
import {auctionWinner} from '../../core/domain/auction-engine';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
import InfoHint from '../InfoHint';
import {INVESTIGATIONS} from '../../core/domain/auction-information';
import {npcInvestigationEquivalent} from '../../core/domain/auction-npc-information';

export default function AuctionBidders({auction}:{auction:Auction}){
 const bidders=[{name:'You',locked:auction.selected!==null},...auction.npcs];
 return <ul className="auction-npcs">{bidders.map(bidder=><li key={bidder.name} className={bidder.locked?'is-locked':''}>
  <div className="auction-bid-status"><BidderIdentity name={bidder.name}/><span className="auction-lock-status">{bidder.locked?'Locked':'Considering…'}</span></div>
  {auction.round>1&&<PreviousBid auction={auction} name={bidder.name}/>}
 </li>)}</ul>;
}
function PreviousBid({auction,name}:{auction:Auction;name:string}){
 const round=auction.round-1,bids=auction.bidHistory[round-1],bid=bids?.find(bid=>bid.name===name),leader=bids?auctionWinner(bids,4,auction.seed).winner?.name:null;
 return <div className="auction-previous-bids" role="group" aria-label={`${name} previous round bid`}><span role="group" className={`auction-prior-bid${leader===name?' is-round-leader':''}`} aria-label={`${name}, round ${round}${leader===name?', winning bid':''}`}><small>Round {round}</small><strong>{bid?auctionUsd(bid.cents):'N/A'}</strong></span></div>;
}
function BidderIdentity({name}:{name:string}){
 const profile=AUCTION_NPCS.find(npc=>npc.name===name);
 const priorities=profile?[...new Set(profile.cluePriority.map(npcInvestigationEquivalent))].map(id=>INVESTIGATIONS.find(option=>option.id===id)?.label??id).join(', '):'';
 const detail=profile?`${profile.strategy}. ${profile.description} Favored investigations: ${priorities}. Opening bids cautiously combine catalog expectations with public reveals and personal clues. Speculation fades each round; previous public bids can have a stronger but limited influence later—never your locked current-round bid or the full hidden collection.`:undefined;
 return <span className="auction-bidder-identity"><AuctionBidder name={name} detail={detail}/>{profile&&<InfoHint label={`${name} profile`}>{detail}</InfoHint>}</span>;
}
