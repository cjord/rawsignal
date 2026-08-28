"use client";
import type {CSSProperties} from "react";
import type {SignalSide,SignalStrictness,MarketSignal} from "./signal-utils";

// Favorites rides the same slider as a fourth, gold entry (user request 2026-08-28):
// it is a filter, not a signal side, so it stays a separate flag the page owns.
export function SignalTabs({value,onChange,favoritesActive=false,onFavorites}:{value:SignalSide;onChange:(value:SignalSide)=>void;favoritesActive?:boolean;onFavorites?:()=>void}){
 const options:[string,string][]=[["leaderboard","Leaderboard"],["buy","Hot Buys"],["sell","Hot Sells"],...(onFavorites?[["favorites","★ Favorites"] as [string,string]]:[])];
 const selectedKey=favoritesActive?"favorites":value,selected=Math.max(0,options.findIndex(([key])=>key===selectedKey));
 return <div className={`signal-tabs tone-${selectedKey}`} role="tablist" aria-label="Market signal" style={{"--selected-index":selected,"--view-count":options.length} as CSSProperties}><i className="signal-slider" aria-hidden="true"/>{options.map(([key,label])=><button key={key} role="tab" aria-selected={selectedKey===key} className={selectedKey===key?"active":""} onClick={()=>key==="favorites"?onFavorites?.():onChange(key as SignalSide)}>{label}</button>)}</div>}
export function StrictnessControl({value,onChange}:{value:SignalStrictness;onChange:(value:SignalStrictness)=>void}){return <label className="strictness-control"><span>Signal strictness</span><select value={value} onChange={e=>onChange(e.target.value as SignalStrictness)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select><small>{value==="conservative"?"Strongest signals · tighter cutoff":value==="aggressive"?"Earlier signals · wider cutoff":"Useful signals · moderate cutoff"}</small></label>}
export function SignalBadge({signal}:{signal:MarketSignal}){return <span className={`signal-badge ${signal.side} confidence-${signal.confidence}`} title={signal.detail}><b>{signal.reason}</b><small>{signal.score} signal · {signal.confidence} confidence</small></span>}
