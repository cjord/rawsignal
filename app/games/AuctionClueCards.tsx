import type {Auction,ClueReveal} from '../../core/domain/auction-types';
import {auctionRarityLabel} from '../../core/domain/auction-copy-policy';
import DeferredImage from '../DeferredImage';
import {auctionUsd} from './AuctionWallet';
import AuctionInvestigationText from './AuctionInvestigationText';

export default function AuctionClueCards({auction,reveals}:{auction:Auction;reveals:ClueReveal[]|undefined}){
 if(reveals===undefined)return <p className="games-note">Detailed card records are unavailable for this older saved investigation.</p>;
 return reveals.length>0?<ul className="auction-clue-cards">{reveals.map(({slot,visibility})=>{
  const card=auction.lot[slot];if(!card)return null;
  return <li key={slot} data-visibility={visibility}>{visibility==='rarity'?<span className="auction-clue-card-back" aria-hidden="true">?</span>:<DeferredImage src={card.image} alt=""/>}<div><b>{visibility==='rarity'?<AuctionInvestigationText text={`Card ${slot+1} · ${auctionRarityLabel(card)}`}/>:card.name}</b><small>{visibility==='rarity'?'Rarity Only — identity and price not revealed':<>{card.printing} · <AuctionInvestigationText text={auctionRarityLabel(card)}/></>}</small>{visibility!=='rarity'&&<strong>{visibility==='price'?auctionUsd(card.cents):'Price Not Revealed'}</strong>}</div></li>;
 })}</ul>:null;
}
