import type {AuctionCard} from '../../core/domain/auction-types';
import {showcaseValueTone} from '../../core/domain/auction-showcase';
import {auctionRarity,auctionValueEffect} from '../../core/domain/auction-display';
import {auctionUsd} from './AuctionWallet';
import DeferredImage from '../DeferredImage';
export type ShowcaseDisplayCard=Omit<AuctionCard,'cents'>&{cents:number|null};
export default function AuctionShowcaseGallery({cards,shared,inspect}:{cards:ShowcaseDisplayCard[];shared:boolean;inspect:(card:AuctionCard)=>void}){
 const value=cards.reduce((sum,card)=>sum+(card.cents??0),0);
 return <section className="detail-section auction-showcase-gallery auction-showcase-valued" data-showcase-tone={showcaseValueTone(value)}><h2>Showcase ({cards.length} / 20)</h2><strong className="auction-showcase-total">{auctionUsd(value)}{cards.some(card=>card.cents===null)?' + Unpriced Cards':''}</strong>{!cards.length&&<p className="games-note">{shared?'No cards were included in this snapshot.':'Select Edit Showcase to move cards from inventory into your display.'}</p>}<div className="auction-showcase-grid">{cards.map((card,index)=><button type="button" className="auction-card" data-rarity={auctionRarity(card)} data-value-effect={card.cents===null?undefined:auctionValueEffect(card.cents,true)} key={index} onClick={()=>inspect({...card,cents:card.cents??0})}><DeferredImage src={card.image} alt=""/><b>{card.name}</b><small>{card.printing} · {card.rarity}</small><strong>{card.cents===null?'Price Unavailable':auctionUsd(card.cents)}</strong></button>)}</div><p className="games-note">{shared?'Prices and statistics are frozen at sharing time; artwork uses the available catalog. This link cannot update or change your inventory.':'Prices use the currently loaded catalog; unavailable prices remain unavailable. Each displayed card is one reserved copy.'}</p></section>;
}
