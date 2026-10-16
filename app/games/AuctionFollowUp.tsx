"use client";
import {useState} from 'react';
import type {AuctionSave,Investigation} from '../../core/domain/auction-types';
import {followUpSlots} from '../../core/domain/auction-investigations-v2';
import {auctionRarityLabel} from '../../core/domain/auction-copy-policy';
import {buyInformation} from '../../core/domain/auction-engine';
import {auctionUsd} from './AuctionWallet';
import AuctionClueIcon from './AuctionClueIcon';

export default function AuctionFollowUp({save,option,disabled,transact}:{save:AuctionSave;option:Investigation;disabled:boolean;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const [selected,setSelected]=useState<number|null>(null),auction=save.auction!,slots=followUpSlots(auction);
 const target=selected!==null&&slots.includes(selected)?selected:slots[0];
 return <form className="auction-follow-up" data-investigation={option.id} onSubmit={event=>{event.preventDefault();if(!disabled&&target!==undefined)transact(current=>buyInformation(current,option.id,Date.now(),target));}}>
  <label htmlFor="auction-follow-up-card"><AuctionClueIcon id={option.id}/><span>{option.label}<small>{option.description}</small></span></label>
  <select id="auction-follow-up-card" value={target??''} disabled={disabled||!slots.length} onChange={event=>setSelected(Number(event.target.value))}>
   {slots.map(slot=><option key={slot} value={slot}>Card {slot+1} · {auction.known.includes(slot)?auction.lot[slot].name:auctionRarityLabel(auction.lot[slot])}</option>)}
  </select>
  <button className="game-control" type="submit" disabled={disabled||!slots.length}><span>Inspect Card ·</span><strong>{auctionUsd(option.cost)}</strong></button>
 </form>;
}
