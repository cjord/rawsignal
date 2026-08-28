import type {SealedMarket,SealedView,SignalSide,SignalStrictness,SinglesGame,SinglesView} from "../domain/types";

export type Direction="asc"|"desc";
export type SinglesSort="name"|"signal"|"set"|"market"|"low"|"high"|"change7"|"change30";
export type SealedSort="name"|"signal"|"set"|"msrp"|"market"|"profit"|"profitPct";

type SharedState={signal:SignalSide;strictness:SignalStrictness};
export type SinglesQueryState=SharedState&{mode:"singles";market:SinglesGame;rarities:string[];view:SinglesView;sort:SinglesSort;direction:Direction;page:number;perPage:number;query:string;minPrice:string;maxPrice:string;sets:string[];up7:boolean;down7:boolean;up30:boolean;down30:boolean};
export type SealedQueryState=SharedState&{mode:"sealed";market:SealedMarket;productTypes:string[];view:SealedView;sort:SealedSort;direction:Direction;page:number;perPage:number;query:string;sets:string[];marketMin:string;marketMax:string;msrpMin:string;msrpMax:string;profitMin:string;profitMax:string;profitPctMin:string;profitPctMax:string;basis:"market"|"median";keepPct:number;taxOn:boolean;taxRate:number;shipping:number;profitableOnly:boolean};
export type MarketQueryState=SinglesQueryState|SealedQueryState;
export type HistoryWriteMode="replace"|"push"|"skip";

export const defaultRarities:Record<SinglesGame,string[]>={pokemon:["illustration-rares","special-illustration-rares"],riftbound:["overnumbered"]};
export const allowedRarities:Record<SinglesGame,string[]>={pokemon:["illustration-rares","special-illustration-rares","promos","ultra-rares","double-rares","secret-hyper-rares","shiny-radiant-rares","vintage"],riftbound:["rares","epics","alt-arts","overnumbered","signatures"]};
const singlesViews:SinglesView[]=["large","medium","text","full"],sealedViews:SealedView[]=["medium","text","full"];
const singlesSorts:SinglesSort[]=["name","signal","set","market","low","high","change7","change30"],sealedSorts:SealedSort[]=["name","signal","set","msrp","market","profit","profitPct"];
const signals:SignalSide[]=["leaderboard","buy","sell"],strictnesses:SignalStrictness[]=["conservative","balanced","aggressive"];
const pageSizes=[20,30,40,50];
const list=(value:string|null)=>value?.split("|").map(item=>item.trim()).filter(Boolean)??[];
const choice=<T extends string>(value:string|null,allowed:readonly T[],fallback:T)=>allowed.includes(value as T)?value as T:fallback;
const positiveInt=(value:string|null,fallback:number)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:fallback};
const finiteNumber=(value:string|null,fallback:number)=>{const parsed=Number(value);return value!==null&&Number.isFinite(parsed)?parsed:fallback};
const shared=(params:URLSearchParams)=>({signal:choice(params.get("signal"),signals,"leaderboard"),strictness:choice(params.get("strictness"),strictnesses,"balanced")});

export function parseMarketQuery(input:string|URLSearchParams):MarketQueryState{
 const params=typeof input==="string"?new URLSearchParams(input.startsWith("?")?input.slice(1):input):input;
 const common=shared(params),direction:Direction=params.get("direction")==="asc"?"asc":"desc",page=positiveInt(params.get("page"),1),perPage=choice(params.get("perPage"),pageSizes.map(String),"20");
 if(params.get("mode")==="sealed")return{...common,mode:"sealed",market:choice(params.get("market"),["pokemon","riftbound","onepiece","scalping"] as const,"pokemon"),productTypes:list(params.get("type")).filter(value=>value!=="all"),view:choice(params.get("view"),sealedViews,"medium"),sort:choice(params.get("sort"),sealedSorts,common.signal==="leaderboard"?"market":"signal"),direction,page,perPage:Number(perPage),query:params.get("q")??"",sets:list(params.get("sets")),marketMin:params.get("marketMin")??"",marketMax:params.get("marketMax")??"",msrpMin:params.get("msrpMin")??"",msrpMax:params.get("msrpMax")??"",profitMin:params.get("profitMin")??"",profitMax:params.get("profitMax")??"",profitPctMin:params.get("profitPctMin")??"",profitPctMax:params.get("profitPctMax")??"",basis:params.get("basis")==="median"?"median":"market",keepPct:finiteNumber(params.get("keepPct"),100),taxOn:params.has("taxOn"),taxRate:finiteNumber(params.get("taxRate"),8),shipping:finiteNumber(params.get("shipping"),0),profitableOnly:params.has("profitableOnly")};
 const market:SinglesGame=params.get("market")==="riftbound"?"riftbound":"pokemon",valid=allowedRarities[market],raw=list(params.get("rarity")),requested=raw.filter(value=>valid.includes(value)),rarities=raw.includes("all")||requested.length===valid.length?[]:requested.length?requested:defaultRarities[market];
 return{...common,mode:"singles",market,rarities,view:choice(params.get("view"),singlesViews,"medium"),sort:choice(params.get("sort"),singlesSorts,common.signal==="leaderboard"?"market":"signal"),direction,page,perPage:Number(perPage),query:params.get("q")??"",minPrice:params.get("minPrice")??"",maxPrice:params.get("maxPrice")??"",sets:list(params.get("sets")),up7:params.has("up7"),down7:params.has("down7"),up30:params.has("up30"),down30:params.has("down30")};
}

const setOptional=(params:URLSearchParams,key:string,value:string|number,defaultValue:string|number="")=>{if(String(value)!==String(defaultValue))params.set(key,String(value))};
export function serializeMarketQuery(state:MarketQueryState){
 // Strictness is a device preference (settings menu), not shareable state; parse still tolerates old strictness= links.
 const params=new URLSearchParams({market:state.market,view:state.view,sort:state.sort,direction:state.direction,page:String(state.page),perPage:String(state.perPage),mode:state.mode,signal:state.signal});
 setOptional(params,"q",state.query);
 if(state.sets.length)params.set("sets",state.sets.join("|"));
 if(state.mode==="singles"){
  params.set("rarity",state.rarities.length?state.rarities.join("|"):"all");setOptional(params,"minPrice",state.minPrice);setOptional(params,"maxPrice",state.maxPrice);
  for(const key of ["up7","down7","up30","down30"] as const)if(state[key])params.set(key,"1");
 }else{
  params.set("type",state.productTypes.length?state.productTypes.join("|"):"all");
  for(const key of ["marketMin","marketMax","msrpMin","msrpMax","profitMin","profitMax","profitPctMin","profitPctMax"] as const)setOptional(params,key,state[key]);
  setOptional(params,"basis",state.basis,"market");setOptional(params,"keepPct",state.keepPct,100);if(state.taxOn)params.set("taxOn","1");setOptional(params,"taxRate",state.taxRate,8);setOptional(params,"shipping",state.shipping,0);if(state.profitableOnly)params.set("profitableOnly","1");
 }
 return params.toString();
}

function withoutSearchTransition(state:MarketQueryState):MarketQueryState{
 return state.mode==="singles"?{...state,query:"",page:1}:{...state,query:"",page:1};
}

export function getHistoryWriteMode(previous:MarketQueryState|null,next:MarketQueryState):HistoryWriteMode{
 if(!previous)return"replace";
 if(serializeMarketQuery(previous)===serializeMarketQuery(next))return"skip";
 const searchChanged=previous.mode===next.mode&&previous.query!==next.query;
 if(searchChanged&&serializeMarketQuery(withoutSearchTransition(previous))===serializeMarketQuery(withoutSearchTransition(next)))return"replace";
 return"push";
}
