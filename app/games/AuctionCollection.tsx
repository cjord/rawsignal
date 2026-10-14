"use client";
import {useState} from 'react';
import DeferredImage from '../DeferredImage';
import AuctionDialog from './AuctionDialog';
import {auctionUsd} from './AuctionWallet';
import {knownValue} from '../../core/domain/auction-information';
import type {Auction} from '../../core/domain/auction-types';

export default function AuctionCollection({auction}:{auction:Auction}){
 const [inspected,setInspected]=useState<number|null>(null),complete=auction.stage==='result';
 const visible=complete?auction.lot.map((_,index)=>index):auction.known;
 const selected=inspected===null?null:auction.lot[inspected],priceKnown=complete||inspected!==null&&auction.priced.includes(inspected);
 return <section className="detail-section auction-collection">
  <span className="games-eyebrow">Small binder · casual collector</span><h2>{complete?'Collection revealed':'Mystery collection'}</h2>
  <p className="games-note">A former player’s small binder: mixed Riftbound singles, including duplicates. Approximately {auction.range[0]}–{auction.range[1]} copies. All cards are modeled Near Mint.</p>
  {!complete&&<p className="auction-known-value">Known value: <strong>{auctionUsd(knownValue(auction))}</strong><small>Only individually revealed prices. Aggregate clues below are separate—not added twice.</small></p>}
  <div className="auction-collection-grid">{visible.map(index=>{
   const card=auction.lot[index],priced=complete||auction.priced.includes(index);
   const top=complete&&card.cents===Math.max(...auction.lot.map(row=>row.cents));
   return <button className={`auction-card${top?' is-top-value':''}`} type="button" key={index} onClick={()=>setInspected(index)} aria-label={`Inspect ${card.name}${priced?'':', price unknown'}`}>
    <DeferredImage src={card.image} alt=""/><b>{card.name}</b><small>{card.printing} · {card.rarity}</small><strong>{priced?auctionUsd(card.cents):'Price Unknown'}</strong>{top&&<small>Top value</small>}
   </button>;
  })}</div>
  {!complete&&<div className="auction-hidden"><span className="auction-card-back" aria-hidden="true">?</span><p>{auction.clues.some(clue=>clue.id==='count')?`${auction.lot.length-visible.length} unrevealed copies`:'Unrevealed copies'} <small>Investigations can reveal more. Exact contents stay hidden until settlement.</small></p></div>}
  {!!auction.clues.length&&<div className="auction-clues"><h3>Investigation notes</h3><ul>{auction.clues.map(clue=><li key={clue.id}><b>{clue.label}</b><span>{clue.text}</span></li>)}</ul></div>}
  {selected&&<AuctionDialog title={selected.name} onClose={()=>setInspected(null)}><DeferredImage className="auction-inspect-art" src={selected.image} alt={selected.name}/><p>{selected.printing} · {selected.set} · Near Mint</p><strong>{priceKnown?auctionUsd(selected.cents):'Price Unknown'}</strong></AuctionDialog>}
 </section>;
}
