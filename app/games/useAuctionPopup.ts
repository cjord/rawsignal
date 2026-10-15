"use client";
import {useEffect,useId,useRef,useState} from 'react';

export function useAuctionPopup(){
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
 return {id,button,panel,open,position,cancel,show,leave};
}
