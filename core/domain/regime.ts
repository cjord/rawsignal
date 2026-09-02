import {changeAtCutoff} from "./history-metrics.ts";
import type {PricePoint} from "./types.ts";

// Market regime classification (todo P3, research §3.5/§15.2). Price-only core with an
// optional demand-trend refinement; every threshold is exported so the walk-forward
// harness can sweep them one dimension at a time. Descriptive labels ship everywhere;
// the only scoring hook is the v2 sell gate (breakout ≠ overextension).
export type MarketRegime="falling"|"improving"|"breakout"|"overextended"|"spike"|"steady";
export type RegimeDemand={recent:number;prior:number;change:number};
export type RegimeReading={regime:MarketRegime;detail:string};

export const REGIME_THRESHOLDS={
 spikeDayPct:12,      // one observation-to-observation jump this large (≤3 days apart) is a Spike
 nearHighPct:2.5,     // within this % of the 90-day robust (q90) high counts as "near the high"
 hotChange7:5,        // weekly change at/above this while near the high = accelerating
 hotMomentum:3,       // % above the trailing-30-day average required for Breakout
 coolChange7:1,       // weekly change at/below this while near the high = weakening (Overextended)
 fallChange30:-5,     // 30-day change at/below this with a non-positive week = Falling
 reboundDrawdown:-10, // at least this far off the 90-day peak to qualify as a recovery…
 reboundChange7:2,    // …turning up at least this much on the week = Improving
 demandCooling:-15,   // demand change at/below this vetoes Breakout / confirms Overextended
} as const;

const pct=(value:number)=>`${value>0?"+":""}${value.toFixed(1)}%`;
const quantile=(sorted:number[],q:number)=>{if(!sorted.length)return 0;const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo)};
const dayMs=86_400_000,timestamp=(date:string)=>Date.parse(`${date}T00:00:00Z`);

export function classifyRegime(points:PricePoint[],currentOverride?:number|null,demand?:RegimeDemand|null):RegimeReading|null{
 const sorted=[...points].filter(p=>p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
 const current=currentOverride??sorted.at(-1)?.price;
 if(!current||!Number.isFinite(current)||sorted.length<2)return null;
 const cutoff=timestamp(sorted.at(-1)!.date)-90*dayMs,window90=sorted.filter(p=>timestamp(p.date)>=cutoff).map(p=>p.price);
 if(window90.length<5)return null;
 const change7=changeAtCutoff(sorted,7),change30=changeAtCutoff(sorted,30);
 const mean30=(()=>{const cut30=timestamp(sorted.at(-1)!.date)-30*dayMs,prices=sorted.filter(p=>timestamp(p.date)>=cut30).map(p=>p.price);return prices.length>=2?prices.reduce((a,b)=>a+b,0)/prices.length:null})();
 const momentum=mean30?(current/mean30-1)*100:null;
 const peak90=Math.max(...window90),drawdown=peak90?(current/peak90-1)*100:null;
 const t=REGIME_THRESHOLDS,cooling=demand!=null&&demand.change<=t.demandCooling;
 // Spike: one outsized jump between adjacent observations no more than 3 days apart.
 const last=sorted.at(-1)!,prev=sorted.at(-2)!;
 const jump=(last.price/prev.price-1)*100,gapDays=(timestamp(last.date)-timestamp(prev.date))/dayMs;
 if(jump>=t.spikeDayPct&&gapDays<=3)return{regime:"spike",detail:`Jumped ${pct(jump)} in a single step — one print is not a trend; confidence is limited until it holds.`};
 const sorted90=[...window90].sort((a,b)=>a-b),robustHigh=quantile(sorted90,.9),robustLow=quantile(sorted90,.1),median90=quantile(sorted90,.5);
 // "Near the high" only means something when there IS a range — a flat series is steady,
 // not overextended, so the high-side states require a ≥5% robust 90-day spread.
 const spread=median90?(robustHigh-robustLow)/median90*100:0;
 const nearHigh=robustHigh>0&&spread>=5&&(1-current/robustHigh)*100<=t.nearHighPct;
 if(nearHigh){
  const accelerating=change7!=null&&momentum!=null&&change7>=t.hotChange7&&momentum>=t.hotMomentum&&!cooling;
  if(accelerating)return{regime:"breakout",detail:`Accelerating through the 90-day high: ${pct(change7)} this week, ${pct(momentum)} above the 30-day average${demand&&demand.change>=15?`, sales up ${pct(demand.change)}`:""}.`};
  const weakening=change7==null||momentum==null||change7<=t.coolChange7||momentum<=0||cooling;
  if(weakening)return{regime:"overextended",detail:`At the 90-day high with fading momentum${change7!=null?` (${pct(change7)} this week)`:""}${cooling?`; sales cooling ${pct(demand!.change)}`:""}.`};
  return{regime:"steady",detail:`Near the 90-day high with mixed momentum (${pct(change7)} this week).`};
 }
 if(change30!=null&&change30<=t.fallChange30&&(change7??0)<=0)return{regime:"falling",detail:`Down ${pct(change30)} over 30 days and still slipping this week.`};
 if(drawdown!=null&&drawdown<=t.reboundDrawdown&&change7!=null&&change7>=t.reboundChange7)return{regime:"improving",detail:`Recovering: ${pct(change7)} this week from ${pct(drawdown)} below the 90-day peak.`};
 return{regime:"steady",detail:`No dominant trend: ${change30!=null?`${pct(change30)} over 30 days`:"limited movement data"}.`};
}

export const REGIME_LABELS:Record<MarketRegime,string>={falling:"Falling",improving:"Improving",breakout:"Breakout",overextended:"Overextended",spike:"Spike",steady:"Steady"};
