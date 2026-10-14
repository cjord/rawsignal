"use client";
import {useEffect,useRef,type ReactNode} from 'react';

export default function AuctionDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[]);
 return <dialog ref={dialog} className="auction-dialog" aria-label={title} onCancel={onClose}>
  <h2>{title}</h2>{children}<button className="game-control" type="button" onClick={onClose}>Close</button>
 </dialog>;
}
