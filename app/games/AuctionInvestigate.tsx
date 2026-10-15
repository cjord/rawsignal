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
  {!auction.bought&&<div className="auction-offers">{auction.offers.map(option=><button className="game-control" type="button" key={option.id} disabled={auction.selected!==null||now>=auction.deadline||save.wallet.cash<option.cost} onClick={()=>transact(current=>buyInformation(current,option.id,Date.now()))}><AuctionClueIcon id={option.id}/><span>{option.label}{option.description&&<small>{option.description}</small>}</span><strong>{auctionUsd(option.cost)}</strong></button>)}</div>}
  <PublicInformation auction={auction}/>
  {!!auction.clues.length&&<div className="auction-investigation-results"><h3>Your Investigations</h3><ClueResults clues={auction.clues}/><PrivateCards auction={auction}/></div>}
 </section>;
}
function PublicInformation({auction}:{auction:Auction}){
 const reveals=auction.publicReveals??[{round:1,slots:publicAuctionSlots(auction)}];
 return <div className="auction-public-information"><h3>Shared Public Information</h3>{reveals.map(reveal=><div className={`auction-shared-reveal${reveal.round===auction.round?' is-new':''}`} key={reveal.round}>
  <h4>Round {reveal.round} Shared Reveal</h4><p className="games-note">{reveal.slots.length} cards and prices shared with every bidder.</p>
  {reveal.round===auction.round&&<span className="auction-public-announcement" role="status">Round {reveal.round}: {reveal.slots.length} public cards revealed.</span>}
  <ul>{reveal.slots.map(slot=><li key={slot}><span>{auction.lot[slot].name} <small>{auction.lot[slot].printing}</small></span><strong>{auctionUsd(auction.lot[slot].cents)}</strong></li>)}</ul>
 </div>)}</div>;
}
function PrivateCards({auction}:{auction:Auction}){
 const shared=new Set(publicAuctionSlots(auction)),slots=auction.known.filter(slot=>!shared.has(slot));
 if(!slots.length)return null;
 return <div className="auction-private-cards"><h4>Your Revealed Cards</h4><ul>{slots.map(slot=><li key={slot}><span>{auction.lot[slot].name} <small>{auction.lot[slot].printing}</small></span><strong>{auction.priced.includes(slot)?auctionUsd(auction.lot[slot].cents):'Price Unknown'}</strong></li>)}</ul></div>;
}
