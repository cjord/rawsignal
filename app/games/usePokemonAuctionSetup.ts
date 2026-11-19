"use client";
import {useEffect,useRef,useState} from 'react';
import type {AuctionSave} from '../../core/domain/auction-types';
import type {GameScope} from '../../core/domain/game-scope';
import type {GameScopeMetadata} from '../../core/domain/game-scope-metadata';
import type {GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
import {readGameScopeMetadata,readGamePracticePool} from '../data/game-practice-catalog';
import {POKEMON_INITIAL_SCOPE} from './PokemonPoolSelector';

export function usePokemonAuctionSetup(save:AuctionSave){
 const [scope,setScope]=useState<GameScope>(save.scope??POKEMON_INITIAL_SCOPE),[metadata,setMetadata]=useState<GameScopeMetadata|null>(null),[snapshot,setSnapshot]=useState<GameCatalogSnapshot|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const request=useRef<AbortController|null>(null),[restoreScope,setRestoreScope]=useState(()=>JSON.stringify((save.auction??save.drafts?.free??save.drafts?.paid)?.scope??null));
 const metadataReady=useRef(false),loadedScope=useRef<string|null>(null);
 const pending=Boolean(save?.auction||Object.keys(save?.drafts??{}).length);
 const active=Boolean(save.auction);
 useEffect(()=>{
  if(active)return;
  const controller=new AbortController();
  if(!metadataReady.current)void readGameScopeMetadata('pokemon',controller.signal).then(next=>{if(!controller.signal.aborted){metadataReady.current=true;setMetadata(next)}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)});
  const frozen:GameScope|null=JSON.parse(restoreScope);
  if(frozen&&loadedScope.current!==restoreScope)void readGamePracticePool(frozen,controller.signal).then(next=>{if(!controller.signal.aborted){loadedScope.current=JSON.stringify(next.scope);setScope(next.scope);setSnapshot(next)}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)});
  return()=>controller.abort();
 },[restoreScope,attempt,active]);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function start(){
  request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{const next=await readGamePracticePool(scope,controller.signal);if(!controller.signal.aborted){if(next.count<25)throw new Error('Select a larger pool: auctions need at least 25 eligible printings.');loadedScope.current=JSON.stringify(next.scope);setSnapshot(next)}}catch(cause){if(!controller.signal.aborted)setError((cause as Error).message)}finally{if(!controller.signal.aborted)setLoading(false)}
 }
 return {scope,setScope,metadata,snapshot,pending,loading,error,start,clear:()=>{loadedScope.current=null;setSnapshot(null);setRestoreScope('null')},retry:()=>{metadataReady.current=false;loadedScope.current=null;setError('');setAttempt(value=>value+1)}};
}
