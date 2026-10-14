import InfoHint from '../InfoHint';
import AuctionClueIcon from './AuctionClueIcon';
import {auctionUsd} from './AuctionWallet';
import {buyInformation} from '../../core/domain/auction-engine';
import type {AuctionSave,Clue} from '../../core/domain/auction-types';
function ClueResults({clues}:{clues:Clue[]}){
 return <div className="auction-clues"><ul>{clues.map(clue=><li key={clue.id}><b><AuctionClueIcon id={clue.id}/>{clue.label}</b><span>{clue.text}</span></li>)}</ul></div>;
}
export default function AuctionInvestigate({save,now,transact}:{save:AuctionSave;now:number;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const auction=save.auction!,previous=auction.bought?auction.clues.slice(0,-1):auction.clues;
 return <section className="detail-section auction-investigate"><h2>{auction.bought?'Investigation Results':'Investigate'} <InfoHint label="Investigation rules">Optional: one purchase per round. Costs are not refunded if you lose.</InfoHint></h2>
  {auction.bought?<div className="auction-investigation-results" role="status"><ClueResults clues={auction.clues.slice(-1)}/></div>:<div className="auction-offers">{auction.offers.map(option=><button className="game-control" type="button" key={option.id} disabled={auction.selected!==null||now>=auction.deadline||save.wallet.cash<option.cost} onClick={()=>transact(current=>buyInformation(current,option.id,Date.now()))}><AuctionClueIcon id={option.id}/><span>{option.label}</span><strong>{auctionUsd(option.cost)}</strong></button>)}</div>}
  {!!previous.length&&<details className="auction-prior-clues"><summary>Previous Investigations ({previous.length})</summary><ClueResults clues={previous}/></details>}
 </section>;
}
