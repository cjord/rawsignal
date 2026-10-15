/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- focusable scroll region provides keyboard access to all four rounds */
import type {Auction} from '../../core/domain/auction-types';
import {auctionWinner} from '../../core/domain/auction-engine';
import AuctionBidder from './AuctionBidder';
import AuctionBidTile from './AuctionBidTile';
import {rankAuctionBids} from '../../core/domain/auction-ranking';

export default function AuctionBidHistory({auction,heading=true}:{auction:Auction;heading?:boolean}){
 const names=['You',...auction.npcs.map(npc=>npc.name)];
 const placements=auction.bidHistory.map(bids=>new Map(rankAuctionBids(bids,auction.seed).map((bid,index)=>[bid.name,index+1])));
 return <div className="auction-bid-history">{heading&&<h3>Bid History</h3>}<div className="auction-history-scroll" tabIndex={0} role="region" aria-label="Four-round bid history"><table className="auction-history-table"><thead><tr><th scope="col">Bidder</th>{[1,2,3,4].map(round=><th scope="col" key={round}>Round {round}</th>)}</tr></thead><tbody>{names.map(name=><tr key={name}><th scope="row"><AuctionBidder name={name}/></th>{[0,1,2,3].map(index=>{
  const bids=auction.bidHistory[index],bid=bids?.find(row=>row.name===name),leader=bids?auctionWinner(bids,4,auction.seed).winner?.name:null;
  return <td key={index}>{bid?<AuctionBidTile bid={bid} round={index+1} leading={leader===name} placement={placements[index]?.get(name)}/>:<div className="auction-history-cell is-pending" aria-label={`${name}, round ${index+1}, ${auction.stage==='result'?'not played':'pending'}`}><span>—</span><small>{auction.stage==='result'?'Not Played':'Pending'}</small></div>}</td>;
 })}</tr>)}</tbody></table></div></div>;
}
