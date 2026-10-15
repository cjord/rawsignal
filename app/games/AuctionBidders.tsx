import type {Auction} from '../../core/domain/auction-types';
import AuctionBidder from './AuctionBidder';
import AuctionClueIcon from './AuctionClueIcon';
import {auctionUsd} from './AuctionWallet';
import {auctionWinner} from '../../core/domain/auction-engine';
import {npcInvestigationName} from '../../core/domain/auction-npc-information';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';

export default function AuctionBidders({auction}:{auction:Auction}){
 const bidders=[{name:'You',locked:auction.selected!==null},...auction.npcs];
 return <ul className="auction-npcs">{bidders.map(bidder=><li key={bidder.name} className={bidder.locked?'is-locked':''}>
  <div className="auction-bid-status"><span className="auction-bidder-identity"><AuctionBidder name={bidder.name}/>{bidder.name!=='You'&&<small>{AUCTION_NPCS.find(npc=>npc.name===bidder.name)?.strategy}</small>}</span><span className="auction-lock-status"><span>{bidder.locked?'Locked':'Considering…'}</span><span className="auction-bid-clues">{bidder.name==='You'?auction.clues.map(clue=><AuctionClueIcon key={clue.id} id={clue.id}/>):<span title={npcInvestigationName(bidder as Auction['npcs'][number])}><AuctionClueIcon id={(bidder as Auction['npcs'][number]).investigations?.at(-1)??'identity3'}/></span>}</span></span></div>
  {auction.round>1&&<div className="auction-previous-bids" role="group" aria-label={`${bidder.name} previous round bids`}>{Array.from({length:auction.round-1},(_,index)=>{const bids=auction.bidHistory[index],bid=bids?.find(bid=>bid.name===bidder.name),leader=bids?auctionWinner(bids,4,auction.seed).winner?.name:null;return <span key={index} role="group" className={`auction-prior-bid${leader===bidder.name?' is-round-leader':''}`} aria-label={`${bidder.name}, round ${index+1}${leader===bidder.name?', winning bid':''}`}><small>Round {index+1}</small><strong>{bid?auctionUsd(bid.cents):'N/A'}</strong></span>})}</div>}
 </li>)}</ul>;
}
