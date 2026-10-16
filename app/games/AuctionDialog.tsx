"use client";
import {useEffect,useRef,type ReactNode} from 'react';

function outsideDialog(event:{target:EventTarget;currentTarget:HTMLDialogElement;clientX:number;clientY:number}){
 if(event.target!==event.currentTarget)return false;
 const rect=event.currentTarget.getBoundingClientRect();
 return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
}
export default function AuctionDialog({title,children,onClose,dismissOnOutside=false}:{title:string;children:ReactNode;onClose:()=>void;dismissOnOutside?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),pressedOutside=useRef(false);
 useEffect(()=>{const element=dialog.current,opener=document.activeElement;element?.showModal();return()=>{element?.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true})}},[]);
 // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Native dialog Escape uses onCancel; pointer handlers dismiss only its unfocusable backdrop.
 return <dialog ref={dialog} className="auction-dialog" aria-label={title} onCancel={event=>{event.preventDefault();onClose()}}
  onPointerDown={event=>{pressedOutside.current=dismissOnOutside&&outsideDialog(event)}}
  onClick={event=>{const dismiss=pressedOutside.current&&outsideDialog(event);pressedOutside.current=false;if(dismiss)onClose()}}>
  <header className="auction-dialog-heading"><h2>{title}</h2><button className="game-control auction-dialog-close" type="button" onClick={onClose}>Close</button></header>{children}
 </dialog>;
}
