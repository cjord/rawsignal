"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {GAME_PROFILES,type GameMarket} from '../../core/domain/game-profile';
import type {GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
const GameContext=createContext<GameMarket>('riftbound');
export const AuctionPoolContext=createContext<GameCatalogSnapshot|null>(null);
export function AuctionGameProvider({market,children}:{market:GameMarket;children:ReactNode}){return <GameContext.Provider value={market}>{children}</GameContext.Provider>}
export const useAuctionGame=()=>GAME_PROFILES[useContext(GameContext)];
export const useAuctionPool=()=>useContext(AuctionPoolContext);
