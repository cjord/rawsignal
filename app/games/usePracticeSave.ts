"use client";
import {useEffect,useRef} from 'react';
import {useAccount} from '../account/AccountProvider';
import {getSavedItem,setSavedItem} from '../account/storage';
import {validAccountValue} from '../../core/domain/account-data';
import type {PriceGameDifficulty,PriceGameState} from '../../core/domain/price-game';
import {initialPriceGame} from '../../core/domain/price-game';
const key='raw-signal-showdown-practice-v1';
export function resetPracticeSave(difficulty:PriceGameDifficulty){setSavedItem(key,JSON.stringify({v:1,difficulty,state:initialPriceGame([])}));}
export function readPracticeSave(difficulty:PriceGameDifficulty):PriceGameState|null{
 try{const raw=getSavedItem(key);if(!raw||!validAccountValue(key,raw))return null;const save=JSON.parse(raw);return save.difficulty===difficulty?save.state:null}catch{return null}
}
export function usePracticeSave(state:PriceGameState,difficulty:PriceGameDifficulty,ready:boolean){
 const {user}=useAccount(),last=useRef('');
 useEffect(()=>{if(!user||!ready||!state.round.length)return;const raw=JSON.stringify({v:1,difficulty,state});if(last.current===raw)return;try{setSavedItem(key,raw);last.current=raw}catch{/* The global cloud banner reports save failures; do not discard this round. */}},[state,difficulty,ready,user]);
}
