import type {PriceHistory} from "./types";

export const distanceAbove=(value:number|null,low:number|null)=>value==null||low==null||low<=0?null:(value-low)/low*100;
export const distanceBelow=(value:number|null,high:number|null)=>value==null||high==null||high<=0?null:(high-value)/high*100;
export const rangePosition=(value:number|null,low:number|null,high:number|null)=>value==null||low==null||high==null||high<=low?null:Math.max(0,Math.min(100,(value-low)/(high-low)*100));
export const rangeWidth=(low:number|null,high:number|null)=>low==null||high==null||low<=0||high<low?null:(high-low)/low*100;
export function historyDepth(history:PriceHistory|null){return history?.points.length?{count:history.points.length,first:history.points[0].date,last:history.points.at(-1)!.date}:{count:0,first:null,last:null}}

