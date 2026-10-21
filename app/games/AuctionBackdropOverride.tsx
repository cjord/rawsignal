"use client";
import {useEffect} from 'react';
import {useAuctionShell,type AuctionBackdropCard} from './auction-shell-context';
function ConnectedOverride({cards}:{cards:AuctionBackdropCard[]}){
 const {path,setBackdrop}=useAuctionShell();
 useEffect(()=>{setBackdrop({path,cards});return()=>setBackdrop(null)},[path,cards,setBackdrop]);return null;
}
export default function AuctionBackdropOverride({cards}:{cards:AuctionBackdropCard[]}){return useAuctionShell().active?<ConnectedOverride cards={cards}/>:null}
