"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- overflow popup is focusable for keyboard scrolling */
import {createPortal} from 'react-dom';
import type {Auction,Clue} from '../../core/domain/auction-types';
import AuctionClueIcon from './AuctionClueIcon';
import {auctionRarityLabel} from '../../core/domain/auction-copy-policy';
import {auctionUsd} from './AuctionWallet';
import {useAuctionPopup} from './useAuctionPopup';

export default function AuctionFindingTile({auction,round,clue,slots=[]}:{auction:Auction;round:number;clue?:Clue;slots?:number[]}){
 const {id,button,panel,open,position,cancel,show,leave}=useAuctionPopup();
 const title=clue?`Your Investigation — ${clue.label}`:`Public Reveal — ${slots.length} cards with prices`;
 const reveals=clue?.reveals??slots.map(slot=>({slot,visibility:'price' as const}));
 return <><button ref={button} type="button" className={`auction-finding-tile ${clue?'auction-private-finding':'auction-shared-reveal'}${open?' is-inspected':''}`} aria-label={`Round ${round}: ${title}`} aria-expanded={open} aria-describedby={open?id:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={leave} onFocus={show} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget))leave()}} onClick={show}>
  <span className="auction-finding-title">{clue&&<AuctionClueIcon id={clue.id}/>}<b>{title}</b></span>{clue&&<span>{clue.text}</span>}
 </button>{open&&createPortal(<div ref={panel} id={id} role="tooltip" className="auction-bid-popup auction-finding-popup" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}} onPointerEnter={cancel} onPointerLeave={leave} onFocus={cancel} onBlur={leave}><div className="auction-popup-scroll" tabIndex={0} role="region" aria-label="Revealed investigation information">
  <strong>Round {round}: {title}</strong>{clue&&<p>{clue.text}</p>}<ul>{reveals.map(({slot,visibility})=>{const card=auction.lot[slot];if(!card)return null;return <li key={slot}>{visibility==='rarity'?<span>Card {slot+1} · {auctionRarityLabel(card)} · Rarity Only</span>:<><b>{card.name}</b><span>{card.printing} · {auctionRarityLabel(card)} · {visibility==='price'?auctionUsd(card.cents):'Price Not Revealed'}</span></>}</li>})}</ul>
 </div></div>,document.body)}</>;
}
