"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- focusable overflow notes allow keyboard scrolling without hover */
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {RoundBid} from '../../core/domain/auction-types';
import AuctionClueIcon from './AuctionClueIcon';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';
import {publicAuctionBidNotes} from '../../core/domain/auction-display';

export default function AuctionBidTile({bid,round,leading=false}:{bid:RoundBid;round:number;leading?:boolean}){
 const notes=publicAuctionBidNotes(bid);
 const id=useId(),button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,above:false});
 const cancel=()=>{if(timer.current)clearTimeout(timer.current)};
 const show=()=>{cancel();const rect=button.current?.getBoundingClientRect();if(rect){const width=Math.min(340,innerWidth-24),above=innerHeight-rect.bottom<230;setPosition({left:Math.max(12,Math.min(rect.left,innerWidth-width-12)),top:above?rect.top-8:rect.bottom+8,above});window.dispatchEvent(new CustomEvent('raw-signal-auction-bid-popup',{detail:id}));setOpen(true)}};
 const leave=()=>{cancel();timer.current=setTimeout(()=>setOpen(false),180)};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!button.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  const resize=()=>setOpen(false);
  const another=(event:Event)=>{if((event as CustomEvent<string>).detail!==id)setOpen(false)};
  window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);window.addEventListener('resize',resize);window.addEventListener('raw-signal-auction-bid-popup',another);
  return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);window.removeEventListener('resize',resize);window.removeEventListener('raw-signal-auction-bid-popup',another)};
 },[open,id]);
 return <>
  <button ref={button} className={`auction-history-cell${leading?' is-winning':''}${open?' is-inspected':''}`} data-completed="true" type="button" aria-label={`${bid.name}, round ${round}, ${auctionUsd(bid.cents)}${leading?', round leader':''}: investigation notes`} aria-expanded={open} aria-describedby={open?id:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={leave} onFocus={show} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget))leave()}} onClick={()=>{cancel();show()}}>
   <strong>{auctionUsd(bid.cents)}</strong><span className="auction-bid-clues">{notes?.map(note=><AuctionClueIcon key={note.id} id={note.id}/>)}{notes?.length===0&&<small>No Clues</small>}{notes===undefined&&<small>Notes Unavailable</small>}</span>
  </button>
  {open&&createPortal(<div ref={panel} id={id} role="tooltip" className="auction-bid-popup" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}} onPointerEnter={cancel} onPointerLeave={leave} tabIndex={0} onFocus={cancel} onBlur={leave}>
   <AuctionBidder name={bid.name}/><strong>Round {round}</strong>{notes===undefined?<p>Investigation history is unavailable for this older saved round.</p>:notes.length===0?<p>No investigations purchased by this round.</p>:<ul>{notes.map(note=><li key={note.id}><b><AuctionClueIcon id={note.id}/>{note.label}</b><p>{note.text}</p></li>)}</ul>}
  </div>,document.body)}
 </>;
}
