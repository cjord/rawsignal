"use client";
import {useState} from 'react';
import type {Auction,AuctionSave} from '../../core/domain/auction-types';
import {leaveAuction} from '../../core/domain/auction-engine';
import AuctionDialog from './AuctionDialog';
import {auctionUsd} from './AuctionWallet';

export default function AuctionLeave({auction,transact}:{auction:Auction|null;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const [confirm,setConfirm]=useState(false);
 if(!auction||auction.stage==='result')return null;
 return <><button className="game-control auction-leave" type="button" onClick={()=>setConfirm(true)}>Leave Auction</button>
  {confirm&&<AuctionDialog title="Leave This Auction?" onClose={()=>setConfirm(false)}>
   <p>Your entry fee ({auctionUsd(auction.entryFee??0)}) and investigation spending ({auctionUsd(auction.spent)}) will not be refunded.</p>
   <p>You will not receive this collection or any NPC loss share. An unsettled bid is not charged. Your existing cash and inventory will be kept.</p>
   <button className="game-control" type="button" onClick={()=>transact(current=>leaveAuction(current,auction.seed))}>Confirm Leave</button>
  </AuctionDialog>}
 </>;
}
