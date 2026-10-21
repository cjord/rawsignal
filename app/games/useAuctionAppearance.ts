"use client";
import {useCallback,useEffect,useState} from 'react';
import {useAccount} from '../account/context';
import {getSavedItem,setSavedItem} from '../account/storage';
import {AUCTION_APPEARANCE_KEY,defaultAuctionAppearance,parseAuctionAppearance,validAuctionAppearance,type AuctionAppearance} from '../../core/domain/auction-appearance';
export function useAuctionAppearance(){
 const account=useAccount(),[appearance,setAppearance]=useState(defaultAuctionAppearance),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(account.loading||account.error)return;const read=()=>{try{setAppearance(parseAuctionAppearance(getSavedItem(AUCTION_APPEARANCE_KEY)));setError('')}catch{setAppearance(defaultAuctionAppearance());setError('Profile appearance could not be loaded. Nothing has been overwritten.')}setReady(true)};read();const receive=(event:StorageEvent)=>{if(event.key===AUCTION_APPEARANCE_KEY)read()};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive)},[account.loading,account.error,account.user?.id]);
 const save=useCallback((value:AuctionAppearance)=>{try{if(!validAuctionAppearance(value))throw new Error('Choose up to twelve catalog cards.');setSavedItem(AUCTION_APPEARANCE_KEY,JSON.stringify(value));setAppearance(value);setError('');window.dispatchEvent(new StorageEvent('storage',{key:AUCTION_APPEARANCE_KEY,newValue:JSON.stringify(value)}));return true}catch{setError('Appearance could not be saved. Check storage, sign-in and account-save warnings.');return false}},[]);
 return {appearance,ready,error,save};
}
