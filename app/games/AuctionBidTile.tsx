"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- focusable overflow notes allow keyboard scrolling without hover */
import {useAuctionPopup} from './useAuctionPopup';
import {createPortal} from 'react-dom';
import type {RoundBid} from '../../core/domain/auction-types';
import AuctionClueIcon from './AuctionClueIcon';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';
import {publicAuctionBidNotes} from '../../core/domain/auction-display';
import {auctionPlacementLabel} from '../../core/domain/auction-ranking';

export default function AuctionBidTile({bid,round,leading=false,placement}:{bid:RoundBid;round:number;leading?:boolean;placement?:number}){
 const notes=publicAuctionBidNotes(bid);
 const {id,button,panel,open,position,cancel,show,leave}=useAuctionPopup();
 return <>
  <button ref={button} className={`auction-history-cell${leading?' is-winning':''}${open?' is-inspected':''}`} data-completed="true" type="button" aria-label={`${bid.name}, round ${round}, ${auctionUsd(bid.cents)}${placement?`, ${auctionPlacementLabel(placement)} place`:''}${leading?', round leader':''}: investigation notes`} aria-expanded={open} aria-describedby={open?id:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={leave} onFocus={show} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget))leave()}} onClick={()=>{cancel();show()}}>
   <span className="auction-bid-amount"><strong>{auctionUsd(bid.cents)}</strong>{placement&&<span className="auction-placement">{auctionPlacementLabel(placement)}</span>}</span><span className="auction-bid-clues">{notes?.map(note=><AuctionClueIcon key={note.id} id={note.id}/>)}{notes?.length===0&&<small>No Private Clues</small>}{notes===undefined&&<small>Notes Unavailable</small>}</span>
  </button>
  {open&&createPortal(<div ref={panel} id={id} role="tooltip" className="auction-bid-popup" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}} onPointerEnter={cancel} onPointerLeave={leave} tabIndex={0} onFocus={cancel} onBlur={leave}>
   <AuctionBidder name={bid.name}/><strong>Round {round}</strong>{notes===undefined?<p>Investigation history is unavailable for this older saved round.</p>:notes.length===0?<p>No private investigations recorded by this round.</p>:<ul>{notes.map(note=><li key={note.id}><b><AuctionClueIcon id={note.id}/>{note.label}</b><p>{note.text}</p></li>)}</ul>}
  </div>,document.body)}
 </>;
}
