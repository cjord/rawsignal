import {changeAtCutoff} from "./domain/history-metrics.ts";
import {classifyRegime,type RegimeDemand,type RegimeReading} from "./domain/regime.ts";
import type {MarketSignal,PricePoint,SignalConfidence,SignalStrictness} from "./domain/types.ts";
export type {MarketSignal,SignalConfidence,SignalSide,SignalStrictness} from "./domain/types.ts";

const presets={conservative:{base:1.5,scale:.13,max:8,minScore:72},balanced:{base:2.25,scale:.2,max:12,minScore:58},aggressive:{base:3.5,scale:.28,max:18,minScore:44}} as const;
// v2 anchors extremes on winsorized 10th/90th percentiles (research §15.1) instead of raw
// min/max, so measured distances shrink; cutoffs are recalibrated on the walk-forward
// harness (docs/backtests.md) to keep board coverage comparable to v1.
const presetsV2={conservative:{base:1.5,scale:.13,max:8,minScore:72},balanced:{base:2.25,scale:.2,max:12,minScore:58},aggressive:{base:3.5,scale:.28,max:18,minScore:44}} as const;
const pct=(value:number)=>`${value.toFixed(1)}%`;
const quantile=(sorted:number[],q:number)=>{if(!sorted.length)return 0;const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo)};
const windowPrices=(points:PricePoint[],days:number)=>{if(!points.length)return[];const end=new Date(`${points.at(-1)!.date}T00:00:00Z`),start=new Date(end);start.setUTCDate(start.getUTCDate()-days);return points.filter(p=>new Date(`${p.date}T00:00:00Z`)>=start&&p.price>0).map(p=>p.price)};

export type SignalExclusionCode="missing-current-price"|"insufficient-history"|"insufficient-liquidity"|"awaiting-stabilization"|"breakout-continuation"|"outside-adaptive-cutoff"|"below-minimum-score";
export type SignalLiquidity={sales7:number|null;sales30:number|null};
// Hot boards require real transaction backing (user decision 2026-08-28): at least 5
// completed sales in 30 days AND one in the last 7 — a signal on a card nobody trades has
// no confidence behind it. Unknown counts pass (absence of data is not proof of illiquidity).
export const LIQUIDITY_FLOOR={sales30:5,sales7:1} as const;
export type SignalEvaluation={eligible:true;signal:MarketSignal}|{eligible:false;signal:null;code:SignalExclusionCode;detail:string;confidence?:SignalConfidence;distance?:number;cutoff?:number;score?:number};
export type SignalModel="v1"|"v2";
// Every surface (batch writer, detail panel, row badges, backtest harness) evaluates
// through this one context object; absent fields are neutral. `model` selects the
// champion ("v1", the default production model) or the challenger under shadow
// evaluation ("v2", robust percentile extremes + breakout sell gate — todo P1b/P2/P3).
// `demand` is the trailing-30 vs prior-30 sales trend when the caller has buckets.
// `regime` lets a caller that already classified the series (batch writer, harness)
// share the reading instead of re-classifying per side/strictness; undefined = compute
// here, an explicit null = no usable regime (gate stays neutral).
export type SignalContext={liquidity?:SignalLiquidity|null;model?:SignalModel;demand?:RegimeDemand|null;regime?:RegimeReading|null};

export function evaluateMarketSignal(points:PricePoint[],side:"buy"|"sell",strictness:SignalStrictness,currentOverride?:number|null,context?:SignalContext|null):SignalEvaluation{
 const liquidity=context?.liquidity,robust=context?.model==="v2";
 const sorted=[...points].filter(p=>p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
 const current=currentOverride??sorted.at(-1)?.price;if(!current||!Number.isFinite(current))return{eligible:false,signal:null,code:"missing-current-price",detail:"No positive current market price is available."};
 if(liquidity&&liquidity.sales30!=null&&(liquidity.sales30<LIQUIDITY_FLOOR.sales30||(liquidity.sales7??0)<LIQUIDITY_FLOOR.sales7)){
  return{eligible:false,signal:null,code:"insufficient-liquidity",detail:`${liquidity.sales30} completed sale${liquidity.sales30===1?"":"s"} in 30 days${liquidity.sales7!=null?` (${liquidity.sales7} in 7)`:""}; boards require ${LIQUIDITY_FLOOR.sales30}/30D and ${LIQUIDITY_FLOOR.sales7}/7D.`};
 }
 const p30=windowPrices(sorted,30),p90=windowPrices(sorted,90),all=sorted.map(p=>p.price);
 const enough90=p90.length>=12,enough30=p30.length>=5,confidence:SignalConfidence=enough90&&all.length>=30?"high":enough30?"medium":"low";
 const robustRange=(prices:number[])=>{if(prices.length<2)return 0;const s=[...prices].sort((a,b)=>a-b),median=quantile(s,.5);return median?((quantile(s,.9)-quantile(s,.1))/median)*100:0};
 const volatility=.6*robustRange(p30)+.4*robustRange(p90),preset=(robust?presetsV2:presets)[strictness],cutoff=Math.min(preset.max,Math.max(preset.base,preset.base+preset.scale*volatility));
 // v2: the reference extreme is the window's winsorized 10th/90th percentile — one
 // anomalous daily mark no longer defines "the low"; raw extremes stay as displayed facts.
 const extrema=(prices:number[],sortedPrices:number[]|null)=>robust?quantile(sortedPrices!,side==="buy"?.1:.9):side==="buy"?Math.min(...prices):Math.max(...prices);
 const distance=(extreme:number)=>side==="buy"?(current/extreme-1)*100:(1-current/extreme)*100;
 const candidates=[{days:30,prices:p30},{days:90,prices:p90},{days:0,prices:all}].filter(x=>x.prices.length>=2).map(x=>{const s=robust?[...x.prices].sort((a,b)=>a-b):null;return{...x,sorted:s,extreme:extrema(x.prices,s)}}).map(x=>({...x,distance:Math.max(0,distance(x.extreme))}));
 if(!candidates.length)return{eligible:false,signal:null,code:"insufficient-history",detail:`${all.length} usable history point${all.length===1?"":"s"}; at least 2 are required.`,confidence};
 const best=candidates.sort((a,b)=>a.distance-b.distance)[0],opposite=robust?quantile(best.sorted!,side==="buy"?.9:.1):side==="buy"?Math.max(...best.prices):Math.min(...best.prices),swing=side==="buy"?(opposite-current)/opposite*100:(current-opposite)/opposite*100;
 const exact=best.distance<=.15,proximity=Math.max(0,1-best.distance/cutoff),score=Math.round(Math.min(100,proximity*62+Math.min(24,Math.max(0,swing)*.8)+(confidence==="high"?14:confidence==="medium"?8:3)));
 // A price sitting on its running low, or still in freefall, is a falling knife, not a buy
 // (audit C2): buys need bounce evidence — visibly off the low and not collapsing this week.
 if(side==="buy"){
  const change7=changeAtCutoff(sorted,7),falling=change7!=null&&change7<=-5;
  if(best.distance<.5||falling){
   const detail=falling?`Down ${pct(Math.abs(change7))} over 7 days; buys wait for stabilization.`:`Price sits on the ${best.days?`${best.days}-day`:"historic"} low with no bounce yet; buys wait for stabilization.`;
   return{eligible:false,signal:null,code:"awaiting-stabilization",detail,confidence,distance:best.distance,cutoff,score};
  }
 }
 if(best.distance>cutoff)return{eligible:false,signal:null,code:"outside-adaptive-cutoff",detail:`${pct(best.distance)} from the nearest ${side==="buy"?"low":"high"}; ${pct(cutoff)} is the ${strictness} cutoff.`,confidence,distance:best.distance,cutoff,score};
 // v2 sell gate (todo P3, mirrors awaiting-stabilization): a price accelerating through
 // its high is a breakout in progress, not overextension — the full-v1/v2 backtests show
 // near-a-high alone is anti-signal in a rising regime. Sells wait for momentum to fade.
 if(robust&&side==="sell"){
  const reading=context?.regime!==undefined?context.regime:classifyRegime(sorted,current,context?.demand);
  if(reading?.regime==="breakout")return{eligible:false,signal:null,code:"breakout-continuation",detail:`${reading.detail} Sells wait for momentum to fade.`,confidence,distance:best.distance,cutoff,score};
 }
 if(score<preset.minScore)return{eligible:false,signal:null,code:"below-minimum-score",detail:`Signal score ${score} is below the ${strictness} minimum of ${preset.minScore}.`,confidence,distance:best.distance,cutoff,score};
 const period=best.days?`${best.days}-day`:"historic",label=`${robust?"typical ":""}${side==="buy"?"low":"high"}`,reason=exact?`${robust?"At the":"New"} ${period} ${label}`:`Within ${pct(best.distance)} of ${period} ${label}`;
 return{eligible:true,signal:{side,score,confidence,reason,detail:`${pct(swing)} ${side==="buy"?"below":"above"} the opposite ${period} extreme · ${pct(cutoff)} ${strictness} cutoff`,distance:best.distance,cutoff}};
}

export function marketSignal(points:PricePoint[],side:"buy"|"sell",strictness:SignalStrictness,currentOverride?:number|null,context?:SignalContext|null):MarketSignal|null{return evaluateMarketSignal(points,side,strictness,currentOverride,context).signal}
