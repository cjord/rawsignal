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
 const pending=Boolean(save?.auction||Object.keys(save?.drafts??{}).length);
 useEffect(()=>{
  const controller=new AbortController();
  void readGameScopeMetadata('pokemon',controller.signal).then(next=>{if(!controller.signal.aborted)setMetadata(next)}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)});
  const frozen:GameScope|null=JSON.parse(restoreScope);
  if(frozen)void readGamePracticePool(frozen,controller.signal).then(next=>{if(!controller.signal.aborted){setScope(next.scope);setSnapshot(next)}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)});
  return()=>controller.abort();
 },[restoreScope,attempt]);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function start(){
  request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{const next=await readGamePracticePool(scope,controller.signal);if(!controller.signal.aborted){if(next.count<25)throw new Error('Select a larger pool: auctions need at least 25 eligible printings.');setSnapshot(next)}}catch(cause){if(!controller.signal.aborted)setError((cause as Error).message)}finally{if(!controller.signal.aborted)setLoading(false)}
 }
 return {scope,setScope,metadata,snapshot,pending,loading,error,start,clear:()=>{setSnapshot(null);setRestoreScope('null')},retry:()=>{setError('');setAttempt(value=>value+1)}};
}
