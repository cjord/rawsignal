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
import {publicAuctionSlots} from '../../core/domain/auction-public';
import {auctionRarityLabel} from '../../core/domain/auction-copy-policy';
import {AUCTION_LOT_THEMES} from '../../core/domain/auction-lot-themes';

export default function AuctionCollection({auction,visible,done,skip}:{auction:Auction;visible:number[];done:boolean;skip:()=>void}){
 const [inspected,setInspected]=useState<number|null>(null),complete=auction.stage==='result';
 const selected=inspected===null?null:auction.lot[inspected],priceKnown=complete||inspected!==null&&auction.priced.includes(inspected);
 const theme=AUCTION_LOT_THEMES.find(theme=>theme.id===auction.lotTheme);
 const shared=new Set(publicAuctionSlots(auction)),value=complete?auctionRevealQuote(auction,visible).value:knownValue(auction);
 return <section className="detail-section auction-collection">
  <div className="auction-collection-heading"><h2>{complete?'Collection Revealed':'Mystery Collection'}</h2><p className="auction-known-value">{complete?'Total Value':'Known Value'} <InfoHint label={complete?'Total collection value explanation':'Collection value explanation'}>{complete?'Frozen market value of the cards revealed so far; adds up as cards flip. Before selling fees and auction costs.':'Only individually revealed prices; aggregate clues are separate and never counted twice.'}</InfoHint><strong>{auctionUsd(value)}</strong></p><strong className="auction-copy-count">{auction.lot.length} <small>Cards</small></strong></div>
  {complete&&!done&&<div className="auction-reveal-controls"><button className="game-control" type="button" onClick={skip}>Skip Reveal</button></div>}
  {theme&&<p className="auction-lot-theme"><strong>{theme.name}</strong><span>{theme.description}</span><small>Collection theme, not guaranteed contents or value{auction.kind==='paid'?' · Paid quality weighting':''}.</small></p>}
  <div className="auction-collection-grid">{orderedAuctionSlots(auction,visible).map(index=>{const card=auction.lot[index];
   if(!visible.includes(index)){const marked=auction.rarityKnown?.includes(index);return <div className="auction-card is-hidden" data-rarity={marked?auctionRarity(card):undefined} key={index} aria-label={`Unrevealed card ${index+1}${marked?`, ${auctionRarityLabel(card)} rarity only`:''}${auction.topCardSlot===index?', top card':''}`}><span className="auction-back-art"><img src="/images/games/riftbound-card-back.webp" alt=""/><b aria-hidden="true">?</b></span>{marked&&<small className="auction-rarity-marker">{auction.topCardSlot===index?'Top Card · ':''}{auctionRarityLabel(card)} · Rarity Only</small>}</div>}
   const priced=complete||auction.priced.includes(index),rarity=auctionRarity(card);
   const publicFlip=!complete&&auction.publicReveals?.find(reveal=>reveal.round===auction.round)?.slots.includes(index);
   return <button className={`auction-card${publicFlip||complete&&!auction.known.includes(index)?' is-flipping':''}`} data-rarity={rarity} type="button" key={index} onClick={()=>setInspected(index)} aria-label={`Inspect ${card.name}${priced?'':', price unknown'}`}>
    <DeferredImage src={card.image} alt=""/><b>{card.name}</b><small>{card.printing} · {card.rarity}</small><strong>{priced?auctionUsd(card.cents):'Price Unknown'}</strong>
    {shared.has(index)&&<span className="auction-public-marker" role="img" aria-label="Public knowledge" title="Public knowledge — revealed to every bidder"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></span>}
    {auction.topCardSlot===index&&<span className="auction-top-marker" role="img" aria-label="Top card" title="Most valuable card in this collection">Top</span>}
   </button>;
  })}</div>
  {selected&&<AuctionDialog title={selected.name} onClose={()=>setInspected(null)}><DeferredImage className="auction-inspect-art" src={selected.image} alt={selected.name}/><p>{selected.printing} · {selected.set}</p><strong>{priceKnown?auctionUsd(selected.cents):'Price Unknown'}</strong></AuctionDialog>}
 </section>;
}
