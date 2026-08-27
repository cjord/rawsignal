import type {PriceHistory,PricePoint,SalesBucket} from "./types";

export const distanceAbove=(value:number|null,low:number|null)=>value==null||low==null||low<=0?null:(value-low)/low*100;
export const distanceBelow=(value:number|null,high:number|null)=>value==null||high==null||high<=0?null:(high-value)/high*100;
export const rangePosition=(value:number|null,low:number|null,high:number|null)=>value==null||low==null||high==null||high<=low?null:Math.max(0,Math.min(100,(value-low)/(high-low)*100));
export const rangeWidth=(low:number|null,high:number|null)=>low==null||high==null||low<=0||high<low?null:(high-low)/low*100;
export function historyDepth(history:PriceHistory|null){return history?.points.length?{count:history.points.length,first:history.points[0].date,last:history.points.at(-1)!.date}:{count:0,first:null,last:null}}

const windowPoints=(points:PricePoint[],days:number)=>{if(!points.length)return[];const end=new Date(`${points.at(-1)!.date}T00:00:00Z`),start=new Date(end);start.setUTCDate(start.getUTCDate()-days);return points.filter(point=>new Date(`${point.date}T00:00:00Z`)>=start&&point.price>0)};
const quantileOf=(sorted:number[],q:number)=>{const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo)};

// Robust 10th–90th percentile range relative to the window median, as a percentage.
export function volatilityRange(points:PricePoint[],days:number){const prices=windowPoints(points,days).map(point=>point.price);if(prices.length<4)return null;const sorted=[...prices].sort((a,b)=>a-b),median=quantileOf(sorted,.5);return median?((quantileOf(sorted,.9)-quantileOf(sorted,.1))/median)*100:null}
// Current price relative to the window's average observation.
export function momentum(current:number|null,points:PricePoint[],days:number){if(current==null||current<=0)return null;const prices=windowPoints(points,days).map(point=>point.price);if(prices.length<2)return null;const average=prices.reduce((sum,price)=>sum+price,0)/prices.length;return average?(current/average-1)*100:null}
// How far the current price sits below the window peak (0 when at the peak).
export function drawdownFromPeak(current:number|null,points:PricePoint[],days:number){if(current==null||current<=0)return null;const prices=windowPoints(points,days).map(point=>point.price);if(prices.length<2)return null;const peak=Math.max(...prices);return peak?Math.min(0,(current/peak-1)*100):null}
// Consecutive same-direction observations counted back from the latest point.
export function priceStreak(points:PricePoint[]){const usable=points.filter(point=>point.price>0);if(usable.length<2)return null;let length=0,direction=0;for(let i=usable.length-1;i>0;i--){const step=Math.sign(usable[i].price-usable[i-1].price);if(!step)break;if(!direction)direction=step;if(step!==direction)break;length++}return length?{direction:direction as 1|-1,length}:null}
// Ordinary least-squares slope over the window, expressed in dollars per week.
export function trendSlope(points:PricePoint[],days:number){const window=windowPoints(points,days);if(window.length<3)return null;const times=window.map(point=>Date.parse(`${point.date}T00:00:00Z`)/86_400_000),prices=window.map(point=>point.price),n=window.length;const meanT=times.reduce((a,b)=>a+b,0)/n,meanP=prices.reduce((a,b)=>a+b,0)/n;let num=0,den=0;for(let i=0;i<n;i++){num+=(times[i]-meanT)*(prices[i]-meanP);den+=(times[i]-meanT)**2}return den?(num/den)*7:null}
// Median market observation over the trailing window.
export function windowMedian(points:PricePoint[],days:number){const prices=windowPoints(points,days).map(point=>point.price);if(prices.length<2)return null;return quantileOf([...prices].sort((a,b)=>a-b),.5)}
// Transparent weighted blend: 90D median (.5), 30D median (.3), current median listing (.2), renormalized over available components. Null when no component exists.
export function modeledFairValue(points:PricePoint[],midPrice:number|null){
 const components:[number|null,number][]=[[windowMedian(points,90),.5],[windowMedian(points,30),.3],[midPrice!=null&&midPrice>0?midPrice:null,.2]];
 const usable=components.filter((entry):entry is [number,number]=>entry[0]!=null);
 if(!usable.length)return null;
 const totalWeight=usable.reduce((sum,[,weight])=>sum+weight,0);
 return usable.reduce((sum,[value,weight])=>sum+value*weight,0)/totalWeight;
}
// Units sold in the last 30 days of buckets vs the 30 days before that.
export function demandTrend(buckets:SalesBucket[]){
 const recent=salesWindow(buckets,30).quantity,prior=salesWindow(buckets,60).quantity-recent;
 if(!recent&&!prior)return null;
 const change=prior?((recent-prior)/prior)*100:100;
 return {recent,prior,change,label:change>15?"rising":change<-15?"cooling":"holding"} as const;
}
// Sales aggregation over the trailing N days of buckets, using the latest bucket as "now".
export function salesWindow(buckets:SalesBucket[],days:number){if(!buckets.length)return{quantity:0,low:null as number|null,high:null as number|null,lowWithShipping:null as number|null,highWithShipping:null as number|null};const end=new Date(`${buckets.at(-1)!.date}T00:00:00Z`),start=new Date(end);start.setUTCDate(start.getUTCDate()-days);const inWindow=buckets.filter(bucket=>new Date(`${bucket.date}T00:00:00Z`)>=start);const pick=(values:(number|null)[],reducer:(a:number,b:number)=>number)=>{const usable=values.filter((value):value is number=>value!=null);return usable.length?usable.reduce((a,b)=>reducer(a,b)):null};return{quantity:inWindow.reduce((sum,bucket)=>sum+bucket.quantity,0),low:pick(inWindow.map(b=>b.low),Math.min),high:pick(inWindow.map(b=>b.high),Math.max),lowWithShipping:pick(inWindow.map(b=>b.lowWithShipping),Math.min),highWithShipping:pick(inWindow.map(b=>b.highWithShipping),Math.max)}}

