"use client";
import {memo,useState} from 'react';
import AuctionWalletSummary from './AuctionWalletSummary';
import AuctionDialog from './AuctionDialog';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import {auctionWalletSummary} from '../../core/domain/auction-wallet';
import AuctionWalletControls from './AuctionWalletControls';

export const auctionUsd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
type Props={save:AuctionSave;catalog:AuctionCard[];reset:()=>void;loading:boolean};
function AuctionWallet({save,catalog,reset,loading}:Props){
 const [confirm,setConfirm]=useState(false);
 const values=auctionWalletSummary(save,catalog);
 return <section className="detail-section auction-wallet" aria-label="Virtual bankroll and inventory">
  <AuctionWalletSummary values={values} loading={loading}/>
  <AuctionWalletControls reset={()=>setConfirm(true)}/>
  {confirm&&<AuctionDialog title="Reset your auction progress?" onClose={()=>setConfirm(false)}>
   <p>This removes your normal-play inventory, showcase, display name, auction statistics, pending collections and unfinished auction, restores $2,500 virtual cash, and resets the selling fee to 10%. Today’s daily challenge attempt is preserved. Previously shared snapshots are not removed. Other site preferences are unchanged.</p>
   <button className="game-control" type="button" onClick={()=>{reset();setConfirm(false)}}>Confirm reset</button>
  </AuctionDialog>}
 </section>;
}
export default memo(AuctionWallet);
