"use client";
/* eslint-disable @next/next/no-img-element -- local optimized WebP back; no provider requests */
import {useState} from 'react';
import DeferredImage from '../DeferredImage';
import InfoHint from '../InfoHint';
import AuctionDialog from './AuctionDialog';
import {auctionUsd} from './AuctionWallet';
import {knownValue} from '../../core/domain/auction-information';
import type {Auction} from '../../core/domain/auction-types';
import {auctionRarity,orderedAuctionSlots,auctionRevealQuote} from '../../core/domain/auction-display';

export default function AuctionCollection({auction,visible,done,skip}:{auction:Auction;visible:number[];done:boolean;skip:()=>void}){
 const [inspected,setInspected]=useState<number|null>(null),complete=auction.stage==='result';
 const selected=inspected===null?null:auction.lot[inspected],priceKnown=complete||inspected!==null&&auction.priced.includes(inspected);
 const quote=auctionRevealQuote(auction,visible),value=complete?quote.value:knownValue(auction);
 const result=auction.result,net=quote.net;
 return <section className="detail-section auction-collection">
  <div className="auction-collection-heading"><h2>{complete?'Collection Revealed':'Mystery Collection'}</h2><strong className="auction-copy-count">{auction.lot.length}<small>Cards</small></strong></div>
  <p className="auction-known-value">{complete?'Market Value':'Known Value'}: <strong>{auctionUsd(value)}</strong> <InfoHint label="Collection value explanation">{complete?'The frozen auction market value adds up as cards flip. Net profit includes selling fees, the winning bid and winner’s investigation spend.':'Only individually revealed prices; aggregate clues are separate and never counted twice.'}</InfoHint>{complete&&result?.winner&&<> · Net Profit / Loss: <strong className={net>=0?'up':'down'}>{auctionUsd(net)}</strong></>}{complete&&!done&&<button className="game-control" type="button" onClick={skip}>Skip Reveal</button>}</p>
  <div className="auction-collection-grid">{orderedAuctionSlots(auction,visible).map(index=>{const card=auction.lot[index];
   if(!visible.includes(index))return <div className="auction-card is-hidden" key={index} aria-label={`Unrevealed card ${index+1}`}><span className="auction-back-art"><img src="/images/games/riftbound-card-back.webp" alt=""/><b aria-hidden="true">?</b></span></div>;
   const priced=complete||auction.priced.includes(index),rarity=auctionRarity(card);
   return <button className={`auction-card${complete&&!auction.known.includes(index)?' is-flipping':''}`} data-rarity={rarity} type="button" key={index} onClick={()=>setInspected(index)} aria-label={`Inspect ${card.name}${priced?'':', price unknown'}`}>
    <DeferredImage src={card.image} alt=""/><b>{card.name}</b><small>{card.printing} · {card.rarity}</small><strong>{priced?auctionUsd(card.cents):'Price Unknown'}</strong>
   </button>;
  })}</div>
  {selected&&<AuctionDialog title={selected.name} onClose={()=>setInspected(null)}><DeferredImage className="auction-inspect-art" src={selected.image} alt={selected.name}/><p>{selected.printing} · {selected.set}</p><strong>{priceKnown?auctionUsd(selected.cents):'Price Unknown'}</strong></AuctionDialog>}
 </section>;
}
