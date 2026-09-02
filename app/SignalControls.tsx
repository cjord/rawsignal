"use client";
import SlidingTabs from "./SlidingTabs";
import type {SignalSide,SignalStrictness,MarketSignal} from "../core/signal-utils";
import {REGIME_LABELS,type MarketRegime} from "../core/domain/regime";

// Favorites rides the same slider as a fourth, gold entry (user request 2026-08-28):
// it is a filter, not a signal side, so it stays a separate flag the page owns.
export function SignalTabs({value,onChange,favoritesActive=false,onFavorites}:{value:SignalSide;onChange:(value:SignalSide)=>void;favoritesActive?:boolean;onFavorites?:()=>void}){
 const options=[{key:"leaderboard",label:"Leaderboard"},{key:"buy",label:"Hot Buys"},{key:"sell",label:"Hot Sells"},...(onFavorites?[{key:"favorites",label:"★ Favorites"}]:[])];
 const selectedKey=favoritesActive?"favorites":value;
 return <SlidingTabs options={options} selectedKey={selectedKey} onSelect={key=>key==="favorites"?onFavorites?.():onChange(key as SignalSide)} label="Market signal" className={`tone-${selectedKey}`}/>}
export function StrictnessControl({value,onChange}:{value:SignalStrictness;onChange:(value:SignalStrictness)=>void}){return <label className="strictness-control"><span>Signal strictness</span><select value={value} onChange={e=>onChange(e.target.value as SignalStrictness)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select><small>{value==="conservative"?"Strongest signals · tighter cutoff":value==="aggressive"?"Earlier signals · wider cutoff":"Useful signals · moderate cutoff"}</small></label>}
export function SignalBadge({signal}:{signal:MarketSignal}){return <span className={`signal-badge ${signal.side} confidence-${signal.confidence}`} title={signal.detail}><b>{signal.reason}</b><small>{signal.score} signal · {signal.confidence} confidence</small></span>}

// Descriptive market-regime chip (todo P3): a label, never a recommendation — it rides
// next to signal badges and history titles wherever a regime is known.
export function RegimeChip({regime,detail}:{regime:MarketRegime|null|undefined;detail?:string}){
 if(!regime)return null;
 return <span className={`regime-chip regime-${regime}`} title={detail??REGIME_HINTS[regime]}>{REGIME_LABELS[regime]}</span>;
}
const REGIME_HINTS:Record<MarketRegime,string>={falling:"Price is trending down over the last 30 days.",improving:"Recovering from a drawdown — turning up this week.",breakout:"Accelerating through its recent high — momentum still building.",overextended:"At its recent high with fading momentum.",spike:"One outsized jump — low confidence until it holds.",steady:"No dominant trend right now."};
