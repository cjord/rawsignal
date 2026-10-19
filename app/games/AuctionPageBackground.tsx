"use client";
import art from '../data/auction-backdrop.json';
import AuctionBackdrop from './AuctionBackdrop';
export default function AuctionPageBackground(){return <div className="auction-page-art" aria-hidden="true"><AuctionBackdrop catalog={art.cards} lobby/></div>}
