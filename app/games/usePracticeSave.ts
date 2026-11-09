"use client";
import {useEffect,useRef} from 'react';
import {useAccount} from '../account/AccountProvider';
import {getSavedItem,setSavedItem} from '../account/storage';
import {validAccountValue} from '../../core/domain/account-data';
import type {PriceGameDifficulty,PriceGameState} from '../../core/domain/price-game';
import {initialPriceGame} from '../../core/domain/price-game';
import {GAME_PROFILES,type GameMarket} from '../../core/domain/game-profile';
import {gameScopeKey,type GameScope} from '../../core/domain/game-scope';
export type PracticeContext={market:GameMarket;scope?:GameScope};
export const RIFTBOUND_PRACTICE:PracticeContext={market:'riftbound'};
const payload=(state:PriceGameState,difficulty:PriceGameDifficulty,context:PracticeContext)=>({v:1,difficulty,state,...(context.market==='pokemon'?{market:'pokemon',scope:context.scope}:{})});
export function resetPracticeSave(difficulty:PriceGameDifficulty,context:PracticeContext=RIFTBOUND_PRACTICE){setSavedItem(GAME_PROFILES[context.market].keys.practice,JSON.stringify(payload(initialPriceGame([]),difficulty,context)));}
function practiceDocument(market:GameMarket){
 try{const key=GAME_PROFILES[market].keys.practice,raw=getSavedItem(key);return raw&&validAccountValue(key,raw)?JSON.parse(raw):null}catch{return null}
}
export function readPracticeScope(market:GameMarket):GameScope|null{
 const save=practiceDocument(market);return save?.market==='pokemon'?save.scope:null;
}
export function readPracticeSave(difficulty:PriceGameDifficulty,context:PracticeContext=RIFTBOUND_PRACTICE):PriceGameState|null{
 try{const save=practiceDocument(context.market);if(!save)return null;if(context.market==='pokemon'&&(!context.scope||gameScopeKey(save.scope)!==gameScopeKey(context.scope)))return null;return save.difficulty===difficulty?save.state:null}catch{return null}
}
export function usePracticeSave(state:PriceGameState,difficulty:PriceGameDifficulty,ready:boolean,context:PracticeContext=RIFTBOUND_PRACTICE){
 const {user}=useAccount(),last=useRef('');
 useEffect(()=>{if(!user||!ready||!state.round.length)return;const raw=JSON.stringify(payload(state,difficulty,context));if(last.current===raw)return;try{setSavedItem(GAME_PROFILES[context.market].keys.practice,raw);last.current=raw}catch{/* The global cloud banner reports save failures; do not discard this round. */}},[state,difficulty,ready,user,context]);
}
