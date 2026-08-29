"use client";
import {useMemo,useState} from "react";
import DeferredImage from "./DeferredImage";
import InfoHint from "./InfoHint";
import MarketTabs from "./MarketTabs";
import TopBar from "./TopBar";
import {readStoredMarket,storeMarket} from "./state/market-memory";
import {SETS_MARKETS,serializeSetsScope,useSetsScopeUrl,type SetsMarket} from "./state/sets-query";
import {setFavoriteKey,toggleSetFavorite,useSetFavorites} from "./state/set-favorites";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import {setGroupsFor} from "../core/domain/eras";
import {formatGameName,formatPercent} from "../core/domain/formatters";
import type {SetDirectoryRow,SetsDirectoryPayload} from "../core/domain/sets";
import setLogos from "../public/data/set-logos.json";

const GAMES:Exclude<SetsMarket,"all">[]=["pokemon","riftbound","onepiece"];
const marketTabOptions=SETS_MARKETS.map(item=>({key:item,label:item==="all"?"All":formatGameName(item)}));

// Must mirror scripts/sets/sync-set-logos.mjs so lookups land on the generated keys.
const normalizeSetName=(value:string)=>value.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
const logoFor=(game:string,set:string)=>game==="pokemon"?(setLogos as {sets:Record<string,{logo:string;symbol:string|null}>}).sets[normalizeSetName(set)]??null:null;

const compactUsd=(value:number)=>value>=1_000_000?`$${(value/1_000_000).toFixed(2)}M`:value>=10_000?`$${Math.round(value/1000).toLocaleString()}k`:`$${Math.round(value).toLocaleString()}`;
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function releaseLine(row:SetDirectoryRow,asOf:string){
 const date=row.releaseDate??(row.releaseYear?`${row.releaseYear}-01-01`:null);
 if(!date)return null;
 const released=new Date(`${date}T00:00:00Z`),now=new Date(asOf);
 const label=row.releaseDate?`${MONTHS[released.getUTCMonth()]} ${released.getUTCFullYear()}`:String(row.releaseYear);
 const months=Math.max(0,(now.getUTCFullYear()-released.getUTCFullYear())*12+now.getUTCMonth()-released.getUTCMonth());
 const age=months<1?"new":months<12?`${months} month${months===1?"":"s"} old`:`${Math.floor(months/12)}y ${months%12}m old`;
 return `${label} · ${age}`;
}

function ChangeChip({value,window:windowLabel}:{value:number|null;window:string}){
 if(value==null)return null;
 const tone=value===0?"":value>0?"up":"down";
 return <span className={`set-chip ${tone}`}>{value>0?"▲":value<0?"▼":"◆"} {formatPercent(value)} <em>/ {windowLabel}</em></span>;
}

function SetTile({row,asOf,starred}:{row:SetDirectoryRow;asOf:string;starred:boolean}){
 const logo=logoFor(row.game,row.set);
 const release=releaseLine(row,asOf);
 const counts=[row.chase>0?`${row.chase} chase`:null,row.sealed>0?`${row.sealed} sealed`:null].filter(Boolean).join(" · ");
 return <a className="set-tile" href={`/sets/${row.game}/${row.slug}`}>
  <div className="set-tile-head">
   {logo?<span className="set-tile-logo"><DeferredImage src={logo.logo} alt={`${row.set} logo`} className="set-logo-image"/></span>
    :<span className={`set-tile-mark mark-${row.game}`} aria-hidden="true">{row.set}</span>}
   <span className="set-tile-title"><b>{row.set}</b>{release&&<small>{release}</small>}</span>
   <button type="button" className={`set-star ${starred?"is-starred":""}`} aria-label={starred?`Unstar ${row.set}`:`Star ${row.set}`} aria-pressed={starred}
    onClick={event=>{event.preventDefault();event.stopPropagation();toggleSetFavorite(row.game,row.set)}}>{starred?"★":"☆"}</button>
  </div>
  <div className="set-tile-foot">
   <span className="set-tile-chips"><ChangeChip value={row.change7} window="7d"/><ChangeChip value={row.change30} window="30d"/></span>
   <span className="set-tile-meta">{counts||"—"}
    {(row.buySignals>0||row.sellSignals>0)&&<span className="set-signals">{row.buySignals>0&&<i className="set-signal buy">{row.buySignals} buy</i>}{row.sellSignals>0&&<i className="set-signal sell">{row.sellSignals} sell</i>}</span>}
   </span>
   <span className="set-tile-open" aria-hidden="true">Open set →</span>
  </div>
 </a>;
}

function GroupSection({label,rows,asOf,favorites}:{label:string;rows:SetDirectoryRow[];asOf:string;favorites:ReadonlySet<string>}){
 // Era rollup: total tracked value plus the tracked-value-weighted mean of member sets'
 // 30D momentum — big sets move the era, minor sets don't swamp it (metrics era rule).
 const tracked=rows.reduce((sum,row)=>sum+row.trackedValue,0);
 const weighted=rows.filter(row=>row.change30!=null&&row.trackedValue>0);
 const weightSum=weighted.reduce((sum,row)=>sum+row.trackedValue,0);
 const change30=weightSum>0?weighted.reduce((sum,row)=>sum+(row.change30 as number)*row.trackedValue,0)/weightSum:null;
 return <section className="set-group">
  <header className="set-group-head"><h3>{label}</h3><span className="set-group-stats">{rows.length} set{rows.length===1?"":"s"}{tracked>0&&<> · {compactUsd(tracked)} tracked</>}{change30!=null&&<> · <em className={change30>0?"up":change30<0?"down":""}>{formatPercent(change30)} / 30d</em></>}</span></header>
  <div className="set-grid">{rows.map(row=><SetTile key={`${row.game}:${row.set}`} row={row} asOf={asOf} starred={favorites.has(setFavoriteKey(row.game,row.set))}/>)}</div>
 </section>;
}

const groupSort=(a:SetDirectoryRow,b:SetDirectoryRow)=>{
 const aDate=a.releaseDate??(a.releaseYear?`${a.releaseYear}-00-00`:""),bDate=b.releaseDate??(b.releaseYear?`${b.releaseYear}-00-00`:"");
 return bDate.localeCompare(aDate)||a.set.localeCompare(b.set);
};

export default function SetsView({payload}:{payload:SetsDirectoryPayload|null}){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 const [market,setMarket]=useState<SetsMarket>("all");
 const writeScope=useSetsScopeUrl(({requestedMarket})=>{
  const valid=SETS_MARKETS.includes(requestedMarket as SetsMarket)?requestedMarket as SetsMarket:null;
  const stored=readStoredMarket();
  const next=valid??(stored&&SETS_MARKETS.includes(stored)?stored:"all");
  setMarket(next);
  if(!valid)window.history.replaceState(null,"",`/sets?${serializeSetsScope(next)}`);
 });
 const changeMarket=(next:SetsMarket)=>{if(next===market)return;setMarket(next);storeMarket(next);writeScope(next)};
 const favorites=useSetFavorites();
 const asOf=payload?.generatedAt??new Date().toISOString();
 const byGame=useMemo(()=>{
  const map=new Map<string,SetDirectoryRow[]>();
  for(const row of payload?.sets??[]){const list=map.get(row.game)??[];list.push(row);map.set(row.game,list)}
  return map;
 },[payload]);
 const games=market==="all"?GAMES:[market];
 const starredRows=useMemo(()=>(payload?.sets??[]).filter(row=>favorites.has(setFavoriteKey(row.game,row.set))&&(market==="all"||row.game===market)).sort(groupSort),[payload,favorites,market]);
 return <main className="detail-page sets-page"><TopBar active="sets" strictness={strictness} onStrictness={setStrictness}/>
  <header className="masthead" id="top">
   <p className="kicker">Every tracked set, by era</p>
   <h1>Sets, <span>mapped by market.</span></h1>
  </header>
  <div className="signal-navigation sets-market-nav"><MarketTabs className="sets-market-tabs" options={marketTabOptions} value={market} onChange={next=>changeMarket(next as SetsMarket)}/></div>
  <article className="detail-content">
   {!payload?<section className="detail-section"><header><span>Unavailable</span><h2>Sets need the database</h2></header><p className="detail-unavailable">This page reads set-level aggregates from the database-backed deployment. Feed-only deployments and local dev have no per-set metrics, so nothing is estimated here — visit the published site instead.</p></section>:<>
   <p className="detail-note sets-note">Set momentum is the median of member products&apos; price changes (singles where tracked, sealed otherwise) · signal counts read the balanced strictness hot boards.<InfoHint label="About set tiles">Each tile shows the set&apos;s tracked chase singles and sealed product counts, its 7 and 30 day median momentum, and how many of its singles currently sit on the Hot Buy or Hot Sell boards at balanced strictness. Stars pin sets to the Favorites shelf on this page.</InfoHint></p>
   {starredRows.length>0&&<GroupSection label="★ Favorites" rows={starredRows} asOf={asOf} favorites={favorites}/>}
   {games.map(game=>{
    const rows=byGame.get(game)??[];
    if(!rows.length)return null;
    return <section className="detail-section sets-game" key={game}>
     <header className="sets-game-head"><span>{formatGameName(game)}</span><h2>{formatGameName(game)} Sets</h2></header>
     {setGroupsFor(game).map(group=>{
      const members=rows.filter(row=>row.group===group.key).sort(groupSort);
      if(!members.length)return null;
      return <GroupSection key={group.key} label={group.label} rows={members} asOf={asOf} favorites={favorites}/>;
     })}
    </section>;
   })}
   </>}
  </article></main>;
}
