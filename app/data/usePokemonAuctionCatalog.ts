/* eslint-disable react-hooks/set-state-in-effect -- loading follows client-only catalog request lifecycle */
"use client";
import {useEffect,useMemo,useState} from 'react';
import {readGamePracticePool} from './game-practice-catalog';
import {unpackGameCatalog,type GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
import {pokemonAuctionCatalog} from '../../core/domain/pokemon-auction';
import {useAuctionPool} from '../games/AuctionGameContext';

// Main play provides its selected snapshot. Inventory/showcase use the complete
// market cache to reprice holdings, including cards won in previous scopes.
export function usePokemonAuctionCatalog(enabled:boolean){
 const provided=useAuctionPool(),[loaded,setLoaded]=useState<GameCatalogSnapshot|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!enabled||provided)return;
  const controller=new AbortController();setLoading(true);
  void readGamePracticePool({market:'pokemon',eras:[],sets:[]},controller.signal).then(snapshot=>{if(!controller.signal.aborted){setLoaded(snapshot);setError(null)}}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[enabled,provided,attempt]);
 const snapshot=loaded??provided,items=useMemo(()=>snapshot?unpackGameCatalog(snapshot):[],[snapshot]);
 const checkLatest=async()=>{if(!enabled)return null;try{const next=await readGamePracticePool(snapshot?.scope??{market:'pokemon',eras:[],sets:[]},new AbortController().signal);setLoaded(next);return pokemonAuctionCatalog(unpackGameCatalog(next))}catch(cause){setError((cause as Error).message);return snapshot?pokemonAuctionCatalog(items):null}};
 return {items:enabled?items:[],status:!enabled?'idle':snapshot?'success':error?'error':'loading',loading,checking:loading,error,reload:()=>setAttempt(value=>value+1),manifest:snapshot,checkLatest};
}
