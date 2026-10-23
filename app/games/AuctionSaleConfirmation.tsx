"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import AuctionDialog from './AuctionDialog';
import {auctionUsd} from './AuctionWallet';
export type AuctionMarketCheck=()=>Promise<AuctionCard[]|null>;
type Quote={copies:number;net:number};
type Props={title:string;label:string;save:AuctionSave;catalog:AuctionCard[];disabled:boolean;quote:(save:AuctionSave,catalog:AuctionCard[])=>Quote;commit:(save:AuctionSave,catalog:AuctionCard[])=>AuctionSave;transact:(update:(save:AuctionSave)=>AuctionSave)=>unknown;checkMarket?:AuctionMarketCheck;close:()=>void;children:ReactNode};
const sameQuote=(a:Quote,b:Quote)=>a.copies===b.copies&&a.net===b.net;
export default function AuctionSaleConfirmation({title,label,save,catalog,disabled,quote,commit,transact,checkMarket,close,children}:Props){
 const [shown,setShown]=useState(()=>quote(save,catalog)),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),alive=useRef(true),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const confirm=async()=>{
  if(pending.current||disabled)return;pending.current=true;setBusy(true);setMessage('');
  try{
   const latest=checkMarket?await checkMarket():catalog;if(!alive.current)return;
   if(!latest){setMessage('No valid prices are available. Nothing has been sold.');return}
   const next=quote(save,latest);if(!sameQuote(shown,next)){setShown(next);setMessage('Prices or holdings changed. Review the updated sale value and confirm again.');return}
   let changed=false,updated:Quote|null=null;
   const result=transact(current=>{const actual=quote(current,latest);if(current.auction||!sameQuote(actual,next)){updated=actual;return current}const value=commit(current,latest);changed=value!==current;return value});
   if(changed&&result!==null){close();return}
   if(updated)setShown(updated);setMessage('Your game changed or the sale could not be saved. Review your inventory and try again.');
  }catch{if(alive.current)setMessage('The sale could not be checked. Nothing has been sold. Please retry.')}finally{pending.current=false;if(alive.current)setBusy(false)}
 };
 return <AuctionDialog title={title} onClose={()=>{if(!busy)close()}}><p>Sell {shown.copies} cards for {auctionUsd(shown.net)} virtual cash after the fixed 10% fee.</p>{children}<p role="status">{message}</p><button className="game-control" type="button" disabled={disabled||busy||!shown.copies} onClick={()=>void confirm()}>{busy?'Checking Prices…':label}</button></AuctionDialog>;
}
