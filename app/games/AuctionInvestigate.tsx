/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- keyboard users can scroll cumulative round findings */
import InfoHint from '../InfoHint';
import AuctionClueIcon from './AuctionClueIcon';
import {auctionUsd} from './AuctionWallet';
import {buyInformation} from '../../core/domain/auction-engine';
import type {Auction,AuctionSave,Clue} from '../../core/domain/auction-types';
import {publicAuctionSlots} from '../../core/domain/auction-public';
function ClueResults({clues}:{clues:Clue[]}){
 return <div className="auction-clues"><ul>{clues.map(clue=><li key={clue.id}><b><AuctionClueIcon id={clue.id}/>{clue.label}</b><span>{clue.text}</span></li>)}</ul></div>;
}
export default function AuctionInvestigate({save,now,transact}:{save:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const auction=save.auction!;
 return <section className="detail-section auction-investigate"><h2>{auction.bought?'Investigation Results':'Investigation'} <InfoHint label="Investigation rules">Shared reveals are free and visible to every bidder. Optionally buy one private investigation per round. Costs are not refunded if you lose. All findings carry forward.</InfoHint></h2>
  <div className="auction-investigation-scroll" role="region" aria-label="Investigation options and round findings" tabIndex={0}>
   {!auction.bought&&<div className="auction-offers">{auction.offers.map(option=><button className="game-control" type="button" key={option.id} disabled={auction.selected!==null||now>=auction.deadline||save.wallet.cash<option.cost} onClick={()=>transact(current=>buyInformation(current,option.id,Date.now()))}><AuctionClueIcon id={option.id}/><span>{option.label}{option.description&&<small>{option.description}</small>}</span><strong>{auctionUsd(option.cost)}</strong></button>)}</div>}
   <PublicInformation auction={auction}/>
  </div>
 </section>;
}
function PublicInformation({auction}:{auction:Auction}){
 const reveals=auction.publicReveals??[{round:1,slots:publicAuctionSlots(auction)}];
 return <div className="auction-public-information">{Array.from({length:auction.round},(_,index)=>auction.round-index).map(round=>{
  const reveal=reveals.find(reveal=>reveal.round===round);
  const clues=auction.clues.filter(clue=>(clue.round??legacyClueRound(auction,clue))===round);
  return <section className={`auction-investigation-round${round===auction.round?' is-new':''}`} key={round} aria-label={`Round ${round} investigation information`}><h3>Round {round}</h3>
   {reveal&&<div className="auction-shared-reveal"><h4>Public Reveal — {reveal.slots.length} cards with prices</h4>{round===auction.round&&<span className="auction-public-announcement" role="status">Round {round}: {reveal.slots.length} public cards revealed.</span>}</div>}
   {!!clues.length&&<div className="auction-investigation-results"><h4>Your Investigation</h4><ClueResults clues={clues}/></div>}
  </section>;
 })}</div>;
}
function legacyClueRound(auction:Auction,clue:Clue){
 const completed=auction.bidHistory.findIndex(bids=>bids.find(bid=>bid.name==='You')?.notes?.some(note=>note.id===clue.id));
 return completed>=0?completed+1:auction.round;
}
