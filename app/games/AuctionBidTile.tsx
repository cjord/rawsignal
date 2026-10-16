"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- focusable overflow notes allow keyboard scrolling without hover */
import {useAuctionPopup} from './useAuctionPopup';
import {createPortal} from 'react-dom';
import type {Auction,RoundBid,Clue} from '../../core/domain/auction-types';
import AuctionClueIcon from './AuctionClueIcon';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';
import {publicAuctionBidNotes} from '../../core/domain/auction-display';
import {auctionPlacementLabel} from '../../core/domain/auction-ranking';
import {INVESTIGATIONS} from '../../core/domain/auction-information';
import AuctionClueCards from './AuctionClueCards';

export default function AuctionBidTile({bid,round,leading=false,placement,auction,details=false}:{bid:RoundBid;round:number;leading?:boolean;placement?:number;auction?:Auction;details?:boolean}){
 const settled=auction?.stage==='result'&&details,notes=publicAuctionBidNotes(bid,settled);
 const {id,button,panel,open,position,cancel,show,leave}=useAuctionPopup();
 return <>
  <button ref={button} className={`auction-history-cell${leading?' is-winning':''}${open?' is-inspected':''}`} data-completed="true" type="button" aria-label={`${bid.name}, round ${round}, ${auctionUsd(bid.cents)}${placement?`, ${auctionPlacementLabel(placement)} place`:''}${leading?', round leader':''}: investigation notes`} aria-expanded={open} aria-describedby={open?id:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={leave} onFocus={show} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget))leave()}} onClick={()=>{cancel();show()}}>
   <span className="auction-bid-amount"><strong>{auctionUsd(bid.cents)}</strong>{placement&&<span className="auction-placement">{auctionPlacementLabel(placement)}</span>}</span><span className="auction-bid-clues">{notes?.map(note=><AuctionClueIcon key={note.id} id={note.id}/>)}{notes?.length===0&&<small>No Private Clues</small>}{notes===undefined&&<small>Notes Unavailable</small>}</span>
  </button>
  {open&&createPortal(<div ref={panel} id={id} role="tooltip" className="auction-bid-popup" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}} onPointerEnter={cancel} onPointerLeave={leave} onFocus={cancel} onBlur={leave}><div className="auction-popup-scroll" tabIndex={0} role="region" aria-label="Bid investigation notes">
   <AuctionBidder name={bid.name}/><strong>Round {round}</strong>{notes===undefined?<p>Investigation history is unavailable for this older saved round.</p>:notes.length===0?<p>No private investigations recorded by this round.</p>:<ul>{notes.map(note=><InvestigationNote key={note.id} note={note} auction={auction} settled={settled}/>)}</ul>}
  </div></div>,document.body)}
 </>;
}
function InvestigationNote({note,auction,settled}:{note:Clue;auction:Auction|undefined;settled:boolean}){
 const description=settled?INVESTIGATIONS.find(option=>option.id===note.id)?.description:undefined;
 return <li><b><AuctionClueIcon id={note.id}/>{note.label}</b>{description&&<p className="games-note">{description}</p>}<p>{note.text}</p>{settled&&auction&&<AuctionClueCards auction={auction} reveals={note.reveals}/>}</li>;
}
