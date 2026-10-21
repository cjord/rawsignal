"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {GamesShell} from '../GamesView';
import AuctionPageBackground from './AuctionPageBackground';
import {AuctionShellContext,type AuctionBackdropChoice} from './auction-shell-context';
export default function AuctionShell({children}:{children:ReactNode}){
 const path=usePathname(),previous=useRef(path),guards=useRef(new Set<()=>boolean>()),[backdrop,setBackdrop]=useState<AuctionBackdropChoice|null>(null);
 const addGuard=useCallback((guard:()=>boolean)=>{guards.current.add(guard);return()=>{guards.current.delete(guard)}},[]);
 const allowNavigation=useCallback(()=>[...guards.current].every(guard=>guard()),[]);
 const context=useMemo(()=>({active:true,path:path??'',setBackdrop,addGuard,allowNavigation}),[path,addGuard,allowNavigation]);
 useEffect(()=>{if(previous.current===path)return;previous.current=path;const frame=requestAnimationFrame(()=>{const heading=document.querySelector<HTMLElement>('main h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}});return()=>cancelAnimationFrame(frame)},[path]);
 return <GamesShell auction background={<AuctionPageBackground cards={backdrop?.path===path?backdrop.cards:undefined}/>}><AuctionShellContext.Provider value={context}>{children}</AuctionShellContext.Provider></GamesShell>;
}
