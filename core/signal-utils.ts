import {changeAtCutoff} from "./domain/history-metrics.ts";
import {classifyRegime,type RegimeDemand,type RegimeReading} from "./domain/regime.ts";
import type {MarketSignal,PricePoint,SignalConfidence,SignalStrictness} from "./domain/types.ts";
export type {MarketSignal,SignalConfidence,SignalSide,SignalStrictness} from "./domain/types.ts";

const presets={conservative:{base:1.5,scale:.13,max:8,minScore:72},balanced:{base:2.25,scale:.2,max:12,minScore:58},aggressive:{base:3.5,scale:.28,max:18,minScore:44}} as const;
// v2 anchors extremes on winsorized 10th/90th percentiles (research §15.1) instead of raw
// min/max. v2.2 recalibration (feature-dump sweeps, docs/backtests.md): evidence-weighted
// turn confirmation with a hump-shaped weekly term (moderate bounces beat overheated
// ones), and per-side minScores at the calibrated 75th/45th/15th score percentiles so
// strictness tiers finally order by quality.
const presetsV2={conservative:{base:1.5,scale:.13,max:8,minScoreBuy:83,minScoreSell:72},balanced:{base:2.25,scale:.2,max:12,minScoreBuy:74,minScoreSell:56},aggressive:{base:3.5,scale:.28,max:18,minScoreBuy:63,minScoreSell:41}} as const;
const pct=(value:number)=>`${value.toFixed(1)}%`;
const quantile=(sorted:number[],q:number)=>{if(!sorted.length)return 0;const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo)};
const windowPrices=(points:PricePoint[],days:number)=>{if(!points.length)return[];const end=new Date(`${points.at(-1)!.date}T00:00:00Z`),start=new Date(end);start.setUTCDate(start.getUTCDate()-days);return points.filter(p=>new Date(`${p.date}T00:00:00Z`)>=start&&p.price>0).map(p=>p.price)};

export type SignalExclusionCode="missing-current-price"|"insufficient-history"|"insufficient-liquidity"|"awaiting-stabilization"|"awaiting-rollover"|"breakout-continuation"|"outside-adaptive-cutoff"|"below-minimum-score";
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
// `cohort` (todo P4, §15.3): the cohort's median 30-day log return and rising-member
// breadth, from the ladder cohort the product belongs to; absent = neutral.
export type SignalCohort={logReturn30:number|null;breadth:number|null;label?:string};
export type SignalContext={liquidity?:SignalLiquidity|null;model?:SignalModel;demand?:RegimeDemand|null;regime?:RegimeReading|null;cohort?:SignalCohort|null};
// (The P4 COHORT_DAMPENER was removed in v2.2 — the calibration sweep showed its sign
// inverted under turn-confirmation gates; cohort context now lives in the breadth score
// term. `SignalCohort.logReturn30` stays in the context for future use.)
// v2 sales bump (todo P5, middle version): one binary lift, not a curve — heavy realized
// volume backs the marks the signal is judged on. Forward shadow-validation only:
// archives carry no sales, so the harness can never see this branch (see P1 limit).
export const SALES_CONFIDENCE_BUMP={sales30:20} as const;

// Boards require real transaction backing: below the floor the evaluation stops here.
function liquidityExclusion(liquidity:SignalLiquidity|null|undefined):SignalEvaluation|null{
 if(liquidity&&liquidity.sales30!=null&&(liquidity.sales30<LIQUIDITY_FLOOR.sales30||(liquidity.sales7??0)<LIQUIDITY_FLOOR.sales7)){
  return{eligible:false,signal:null,code:"insufficient-liquidity",detail:`${liquidity.sales30} completed sale${liquidity.sales30===1?"":"s"} in 30 days${liquidity.sales7!=null?` (${liquidity.sales7} in 7)`:""}; boards require ${LIQUIDITY_FLOOR.sales30}/30D and ${LIQUIDITY_FLOOR.sales7}/7D.`};
 }
 return null;
}

// Winsorized 10th–90th spread relative to the median; v1 and v2 share the volatility term.
const robustRange=(prices:number[])=>{if(prices.length<2)return 0;const s=[...prices].sort((a,b)=>a-b),median=quantile(s,.5);return median?((quantile(s,.9)-quantile(s,.1))/median)*100:0};
// The adaptive cutoff: the preset base widened by blended 30/90-day volatility, capped.
function adaptiveCutoff(p30:number[],p90:number[],preset:{base:number;scale:number;max:number}){
 const volatility=.6*robustRange(p30)+.4*robustRange(p90);
 return Math.min(preset.max,Math.max(preset.base,preset.base+preset.scale*volatility));
}

type Candidate={days:number;prices:number[];sorted:number[]|null;extreme:number;distance:number};
// The nearest reference extreme across the 30-day, 90-day, and full windows (ties keep
// that order). v2: the window's winsorized 10th/90th percentile — one anomalous daily mark
// no longer defines "the low"; v1: the raw min/max. Raw extremes stay as displayed facts.
function nearestExtreme(windows:{days:number;prices:number[]}[],side:"buy"|"sell",current:number,robust:boolean):Candidate|null{
 const extrema=(prices:number[],sortedPrices:number[]|null)=>robust?quantile(sortedPrices!,side==="buy"?.1:.9):side==="buy"?Math.min(...prices):Math.max(...prices);
 const distance=(extreme:number)=>side==="buy"?(current/extreme-1)*100:(1-current/extreme)*100;
 const candidates=windows.filter(x=>x.prices.length>=2).map(x=>{const s=robust?[...x.prices].sort((a,b)=>a-b):null;return{...x,sorted:s,extreme:extrema(x.prices,s)}}).map(x=>({...x,distance:Math.max(0,distance(x.extreme))}));
 return candidates.length?candidates.sort((a,b)=>a.distance-b.distance)[0]:null;
}

// Scores. v1: proximity-led (unchanged, still serving production). v2.2: evidence-led
// turn confirmation — the feature dump showed proximity is ANTI-predictive, and the
// sweeps picked a hump-shaped weekly term for buys (a ~3% bounce is the sweet spot;
// overheated bounces revert), breadth ×.35, and a 90-day trend-context term
// (docs/backtests.md). All weights are the calibrated round numbers, not fits.
function scoreSignal(args:{robust:boolean;side:"buy"|"sell";change7:number|null;change30:number|null;change90:number|null;breadth:number;confidence:SignalConfidence;swing:number;distance:number;cutoff:number}){
 const {robust,side,change7,change30:change30v,change90:change90v,breadth,confidence,swing,distance,cutoff}=args;
 const clampTo=(value:number|null|undefined,lo:number,hi:number)=>Math.min(hi,Math.max(lo,value??0));
 const hump=(value:number)=>Math.max(0,(clampTo(value,0,15)/3)*Math.exp(1-clampTo(value,0,15)/3))*25;
 return robust
  ?Math.round(Math.min(100,side==="buy"
    ?hump(change7??0)+clampTo(change30v,0,10)*1.5+breadth*.35+(confidence==="high"?20:confidence==="medium"?5:0)+clampTo(swing,0,15)+clampTo(change90v,0,25)*.4
    :clampTo(-(change7??0),0,5)*5+clampTo(-(change30v??0),0,10)*1.5+(100-breadth)*.35+(confidence==="high"?10:confidence==="medium"?5:0)+clampTo(swing,0,15)+clampTo(distance,0,8)*1.25+clampTo(-(change90v??0),0,20)*.35))
  :Math.round(Math.min(100,Math.max(0,1-distance/cutoff)*62+Math.min(24,Math.max(0,swing)*.8)+(confidence==="high"?14:confidence==="medium"?8:3)));
}

export function evaluateMarketSignal(points:PricePoint[],side:"buy"|"sell",strictness:SignalStrictness,currentOverride?:number|null,context?:SignalContext|null):SignalEvaluation{
 const liquidity=context?.liquidity,robust=context?.model==="v2";
 const sorted=[...points].filter(p=>p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
 const current=currentOverride??sorted.at(-1)?.price;if(!current||!Number.isFinite(current))return{eligible:false,signal:null,code:"missing-current-price",detail:"No positive current market price is available."};
 const illiquid=liquidityExclusion(liquidity);if(illiquid)return illiquid;
 const p30=windowPrices(sorted,30),p90=windowPrices(sorted,90),all=sorted.map(p=>p.price);
 const enough90=p90.length>=12,enough30=p30.length>=5;
 let confidence:SignalConfidence=enough90&&all.length>=30?"high":enough30?"medium":"low",cohortNote="";
 // v2 sales bump (todo P5): heavy realized volume backs the marks the signal rests on.
 // (The P4 cohort dampener was REMOVED in v2.2 — under turn-confirmation gates the
 // dampened rows hit 79% vs 70% for the rest: co-moving with a recovering cohort is
 // strength, which the breadth score term now rewards with the correct sign.)
 if(robust&&liquidity&&(liquidity.sales30??0)>=SALES_CONFIDENCE_BUMP.sales30&&confidence!=="high"){
  confidence=confidence==="medium"?"high":"medium";
  cohortNote=` · ${liquidity!.sales30} sales/30D backing`;
 }
 const preset=(robust?presetsV2:presets)[strictness],cutoff=adaptiveCutoff(p30,p90,preset);
 const minScore=robust?(side==="buy"?presetsV2[strictness].minScoreBuy:presetsV2[strictness].minScoreSell):presets[strictness].minScore;
 const best=nearestExtreme([{days:30,prices:p30},{days:90,prices:p90},{days:0,prices:all}],side,current,robust);
 if(!best)return{eligible:false,signal:null,code:"insufficient-history",detail:`${all.length} usable history point${all.length===1?"":"s"}; at least 2 are required.`,confidence};
 const opposite=robust?quantile(best.sorted!,side==="buy"?.9:.1):side==="buy"?Math.max(...best.prices):Math.min(...best.prices),swing=side==="buy"?(opposite-current)/opposite*100:(current-opposite)/opposite*100;
 const exact=best.distance<=.15;
 const change7=changeAtCutoff(sorted,7),change30v=changeAtCutoff(sorted,30),change90v=robust?changeAtCutoff(sorted,90):null;
 const breadth=context?.cohort?.breadth??50;
 const score=scoreSignal({robust,side,change7,change30:change30v,change90:change90v,breadth,confidence,swing,distance:best.distance,cutoff});
 // Turn-confirmation gates. v1 buys keep the original stabilization rule (audit C2).
 // v2.2 hardens both (sweep-picked): buys ≥1% off the low AND week ≥ +0.5% (a null
 // change7 is unconfirmed); sells ≥0.8% off the high AND week ≤ −0.5% — a price still
 // printing highs with momentum up is continuation, not overextension.
 if(side==="buy"){
  const falling=change7!=null&&change7<=-5;
  const waiting=robust?(best.distance<1||change7==null||change7<.5):(best.distance<.5||falling);
  if(waiting){
   const detail=falling||(robust&&change7!=null&&change7<.5)?`${change7!<0?"Down":"Up only"} ${pct(Math.abs(change7!))} over 7 days; buys wait for a confirmed bounce.`:`Price sits on the ${best.days?`${best.days}-day`:"historic"} low with no ${robust?"confirmed bounce":"bounce yet"}; buys wait for stabilization.`;
   return{eligible:false,signal:null,code:"awaiting-stabilization",detail,confidence,distance:best.distance,cutoff,score};
  }
 }
 if(robust&&side==="sell"&&(best.distance<.8||change7==null||change7>-.5)){
  const reading=context?.regime!==undefined?context.regime:classifyRegime(sorted,current,context?.demand,context?.cohort?.breadth);
  if(reading?.regime==="breakout")return{eligible:false,signal:null,code:"breakout-continuation",detail:`${reading.detail} Sells wait for momentum to fade.`,confidence,distance:best.distance,cutoff,score};
  return{eligible:false,signal:null,code:"awaiting-rollover",detail:change7!=null&&change7>0?`Up ${pct(change7)} over 7 days at the high; sells wait for the roll-over.`:`Price sits at the ${best.days?`${best.days}-day`:"historic"} high with no confirmed roll-over; sells wait for fading momentum.`,confidence,distance:best.distance,cutoff,score};
 }
 if(best.distance>cutoff)return{eligible:false,signal:null,code:"outside-adaptive-cutoff",detail:`${pct(best.distance)} from the nearest ${side==="buy"?"low":"high"}; ${pct(cutoff)} is the ${strictness} cutoff.`,confidence,distance:best.distance,cutoff,score};
 if(score<minScore)return{eligible:false,signal:null,code:"below-minimum-score",detail:`Signal score ${score} is below the ${strictness} minimum of ${minScore}.`,confidence,distance:best.distance,cutoff,score};
 const period=best.days?`${best.days}-day`:"historic",label=`${robust?"typical ":""}${side==="buy"?"low":"high"}`,reason=exact?`${robust?"At the":"New"} ${period} ${label}`:`Within ${pct(best.distance)} of ${period} ${label}`;
 return{eligible:true,signal:{side,score,confidence,reason,detail:`${pct(swing)} ${side==="buy"?"below":"above"} the opposite ${period} extreme · ${pct(cutoff)} ${strictness} cutoff${cohortNote}`,distance:best.distance,cutoff}};
}

export function marketSignal(points:PricePoint[],side:"buy"|"sell",strictness:SignalStrictness,currentOverride?:number|null,context?:SignalContext|null):MarketSignal|null{return evaluateMarketSignal(points,side,strictness,currentOverride,context).signal}
