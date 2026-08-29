"use client";
import SlidingTabs from "./SlidingTabs";
import type {SignalSide,SignalStrictness,MarketSignal} from "../core/signal-utils";

// Favorites rides the same slider as a fourth, gold entry (user request 2026-08-28):
// it is a filter, not a signal side, so it stays a separate flag the page owns.
export function SignalTabs({value,onChange,favoritesActive=false,onFavorites}:{value:SignalSide;onChange:(value:SignalSide)=>void;favoritesActive?:boolean;onFavorites?:()=>void}){
 const options=[{key:"leaderboard",label:"Leaderboard"},{key:"buy",label:"Hot Buys"},{key:"sell",label:"Hot Sells"},...(onFavorites?[{key:"favorites",label:"★ Favorites"}]:[])];
 const selectedKey=favoritesActive?"favorites":value;
 return <SlidingTabs options={options} selectedKey={selectedKey} onSelect={key=>key==="favorites"?onFavorites?.():onChange(key as SignalSide)} label="Market signal" className={`tone-${selectedKey}`}/>}
export function StrictnessControl({value,onChange}:{value:SignalStrictness;onChange:(value:SignalStrictness)=>void}){return <label className="strictness-control"><span>Signal strictness</span><select value={value} onChange={e=>onChange(e.target.value as SignalStrictness)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select><small>{value==="conservative"?"Strongest signals · tighter cutoff":value==="aggressive"?"Earlier signals · wider cutoff":"Useful signals · moderate cutoff"}</small></label>}
export function SignalBadge({signal}:{signal:MarketSignal}){return <span className={`signal-badge ${signal.side} confidence-${signal.confidence}`} title={signal.detail}><b>{signal.reason}</b><small>{signal.score} signal · {signal.confidence} confidence</small></span>}
