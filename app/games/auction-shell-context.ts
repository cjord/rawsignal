"use client";
import {createContext,useContext} from 'react';
export type AuctionBackdropCard={image:string;rarity?:string;section?:string};
export type AuctionBackdropChoice={path:string;cards:AuctionBackdropCard[]};
type AuctionShellValue={active:boolean;path:string;navigate:(href:string)=>void;setBackdrop:(choice:AuctionBackdropChoice|null)=>void;addGuard:(guard:()=>boolean)=>()=>void;allowNavigation:()=>boolean};
export const AuctionShellContext=createContext<AuctionShellValue>({active:false,path:'',navigate:()=>{},setBackdrop:()=>{},addGuard:()=>()=>{},allowNavigation:()=>true});
export const useAuctionShell=()=>useContext(AuctionShellContext);
