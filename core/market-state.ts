import type {SealedMarket,SealedView,SignalSide,SignalStrictness,SinglesMarket,SinglesView} from "./domain/types.ts";

// The market query-state shapes and the section registry: pure data contracts shared by
// the URL codec (app/state/market-query.ts), the catalog query engine, the D1
// repositories, and the Worker's feed enumeration. No parsing lives here.

export type Direction="asc"|"desc";
export type SinglesSort="name"|"signal"|"set"|"market"|"low"|"high"|"change7"|"change30";
export type SealedSort="name"|"signal"|"set"|"msrp"|"market"|"low"|"high"|"change7"|"change30"|"profit"|"profitPct";

// `favorites` is the slider's Favorites lens (decision D12): shareable URL state like
// the signal side, serialized only when on.
type SharedState={signal:SignalSide;strictness:SignalStrictness;favorites:boolean};
export type SinglesQueryState=SharedState&{mode:"singles";market:SinglesMarket;rarities:string[];view:SinglesView;sort:SinglesSort;direction:Direction;page:number;perPage:number;query:string;minPrice:string;maxPrice:string;sets:string[];up7:boolean;down7:boolean;up30:boolean;down30:boolean};
export type SealedQueryState=SharedState&{mode:"sealed";market:SealedMarket;productTypes:string[];view:SealedView;sort:SealedSort;direction:Direction;page:number;perPage:number;query:string;sets:string[];marketMin:string;marketMax:string;msrpMin:string;msrpMax:string;profitMin:string;profitMax:string;profitPctMin:string;profitPctMax:string;basis:"market"|"median";keepPct:number;taxOn:boolean;taxRate:number;shipping:number;profitableOnly:boolean};
export type MarketQueryState=SinglesQueryState|SealedQueryState;

// The "all" scope unions both games (visual pass rework 2026-08-28): defaults combine
// each game's landing rarities, and every section stays valid.
export const defaultRarities:Record<SinglesMarket,string[]>={pokemon:["illustration-rares","special-illustration-rares"],riftbound:["overnumbered"],all:["illustration-rares","special-illustration-rares","overnumbered"]};
const pokemonRarities=["illustration-rares","special-illustration-rares","promos","ultra-rares","double-rares","secret-hyper-rares","shiny-radiant-rares","vintage","japanese-promos"],riftboundRarities=["rares","epics","alt-arts","overnumbered","signatures"];
export const allowedRarities:Record<SinglesMarket,string[]>={pokemon:pokemonRarities,riftbound:riftboundRarities,all:[...pokemonRarities,...riftboundRarities]};
