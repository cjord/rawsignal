"use client";
import {useCallback,useEffect,useMemo,useSyncExternalStore} from 'react';
import {useAuctionGame} from '../games/AuctionGameContext';
import {usePokemonAuctionCatalog} from './usePokemonAuctionCatalog';
import {legacyAuctionCatalog} from './auction-legacy-catalog';
import {auctionCatalogCache} from './auction-catalog-cache';
import {auctionCatalog} from '../../core/domain/auction-market';
export function useAuctionCatalog(enabled:boolean,useSnapshot=false){
 const game=useAuctionGame(),pokemon=usePokemonAuctionCatalog(enabled&&game.market==='pokemon'),legacyEnabled=enabled&&game.market==='riftbound';
 const legacy=useSyncExternalStore(legacyAuctionCatalog.subscribe,legacyAuctionCatalog.getSnapshot,legacyAuctionCatalog.getServerSnapshot);
 const state=useSyncExternalStore(auctionCatalogCache.subscribe,auctionCatalogCache.getSnapshot,auctionCatalogCache.getServerSnapshot);
 useEffect(()=>{
  if(!legacyEnabled||!useSnapshot)return;
  void auctionCatalogCache.refresh();
  const visible=()=>{if(document.visibilityState==='visible'&&!document.querySelector('[role="dialog"]'))void auctionCatalogCache.refresh()};
  document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);
 },[legacyEnabled,useSnapshot]);
 useEffect(()=>{if(legacyEnabled&&!useSnapshot)void legacyAuctionCatalog.refresh()},[legacyEnabled,useSnapshot]);
 const legacyReload=useCallback(()=>{void legacyAuctionCatalog.refresh(true)},[]);
 const reload=useCallback(()=>{void auctionCatalogCache.refresh(true)},[]);
 const checkLatest=useCallback(async()=>{await auctionCatalogCache.refresh(true);const latest=auctionCatalogCache.getSnapshot();return latest.snapshot?auctionCatalog(latest.items):null},[]);
 return useMemo(()=>{
  if(game.market==='pokemon')return pokemon;
  if(!useSnapshot)return {...legacy,items:enabled?legacy.items:[],status:!enabled?'idle':legacy.status==='idle'?'loading':legacy.status,reload:legacyReload,manifest:null,checking:legacy.loading,checkLatest:undefined};
  const status=!enabled?'idle':state.snapshot?'success':state.error?'error':'loading';
  return {items:enabled?state.items:[],status,loading:status==='loading',checking:state.loading,error:state.error,reload,manifest:state.snapshot,checkLatest};
 },[legacy,legacyReload,useSnapshot,enabled,state,reload,checkLatest,game.market,pokemon]);
}
