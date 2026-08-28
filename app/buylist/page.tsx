"use client";
/* eslint-disable react-hooks/set-state-in-effect -- the strictness preference hydrates after mount */
import {useMemo,useState,useEffect} from "react";
import TopBar from "../TopBar";
import {formatGameName,formatUsd} from "../domain/formatters";
import type {SignalStrictness} from "../domain/types";
import {buylistTotals,type FavoriteEntry} from "../state/favorites";
import {useFavorites} from "../state/useFavorites";

// The card-show buy list (audit Phase B / R4): favorites rendered as a checkable shopping
// list with a running scoreboard. Prices are the ones captured when each product was
// starred — stamped, not estimated — so the list stays useful offline in an aisle.

type BuySort="set"|"price"|"added";
const dateLabel=(iso:string)=>new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});

function Row({entry,acquired,paid,onAcquired,onPaid,onRemove}:{entry:FavoriteEntry;acquired:boolean;paid:number|null;onAcquired:(next:boolean)=>void;onPaid:(next:number|null)=>void;onRemove:()=>void}){
 const href=entry.kind==="single"?`/cards/${entry.productId}`:`/sealed/${entry.productId}`;
 return <li className={`buylist-row ${acquired?"acquired":""}`}>
  <label className="buylist-check"><input type="checkbox" checked={acquired} onChange={event=>onAcquired(event.target.checked)} aria-label={`Mark ${entry.name} acquired`}/><span aria-hidden="true"/></label>
  <a className="buylist-identity" href={href}>
   <b>{entry.name}</b>
   <span>{entry.set}{entry.number?` · ${entry.number}`:""} · {formatGameName(entry.game)}</span>
  </a>
  <span className="buylist-price"><b>{formatUsd(entry.price,"N/A")}</b><small>as of {dateLabel(entry.addedAt)}</small></span>
  <label className="buylist-paid"><span>Paid</span><input inputMode="decimal" placeholder="—" value={paid==null?"":String(paid)} onChange={event=>{const value=event.target.value.trim();if(value==="")return onPaid(null);const parsed=Number(value);if(Number.isFinite(parsed)&&parsed>=0)onPaid(parsed)}} aria-label={`Price paid for ${entry.name}`}/></label>
  <button type="button" className="buylist-remove" onClick={onRemove} aria-label={`Remove ${entry.name} from the list`}>★</button>
 </li>;
}

export default function BuylistPage(){
 const [strictness,setStrictness]=useState<SignalStrictness>("balanced");
 useEffect(()=>{const saved=localStorage.getItem("raw-signal-strictness");if(saved==="conservative"||saved==="aggressive")setStrictness(saved)},[]);
 const changeStrictness=(value:SignalStrictness)=>{setStrictness(value);try{localStorage.setItem("raw-signal-strictness",value)}catch{/* Storage unavailable; page-local only. */}};
 const favorites=useFavorites();
 const [sort,setSort]=useState<BuySort>("set");
 const entries=useMemo(()=>{
  const sorted=[...favorites.entries];
  if(sort==="set")sorted.sort((a,b)=>a.set.localeCompare(b.set)||a.name.localeCompare(b.name));
  else if(sort==="price")sorted.sort((a,b)=>(b.price??-1)-(a.price??-1));
  else sorted.sort((a,b)=>b.addedAt.localeCompare(a.addedAt));
  return sorted;
 },[favorites.entries,sort]);
 const totals=useMemo(()=>buylistTotals(favorites.entries,favorites.buyStates),[favorites.entries,favorites.buyStates]);
 return <main className="detail-page buylist-page"><TopBar className="detail-topbar" active="buylist" strictness={strictness} onStrictness={changeStrictness}/>
  <article className="detail-content">
   <header className="metrics-head"><span className="kicker">Card-show companion</span><h1>Buy list</h1>
    <p className="detail-note">Starred products as a checkable shopping list. Prices are the values captured when each item was starred — check the item&apos;s page for the live number.</p></header>
   {entries.length===0?<section className="detail-section"><header><span>Empty</span><h2>Nothing starred yet</h2></header>
    <p className="detail-unavailable">Star products from their detail pages, or open Hot Buys and add the top of the board. The list lives on this device.</p></section>:<>
   <section className="detail-section"><header><span>Scoreboard</span><h2>Totals</h2></header>
    <div className="detail-history-grid buylist-totals">
     <div className="detail-metric"><small>Items</small><b>{totals.acquired}/{totals.count}</b><span>acquired</span></div>
     <div className="detail-metric"><small>List market value</small><b>{formatUsd(totals.marketTotal)}</b></div>
     <div className="detail-metric"><small>Acquired at market</small><b>{formatUsd(totals.acquiredMarket)}</b></div>
     <div className="detail-metric"><small>Actually paid</small><b className={totals.paidTotal<=totals.acquiredMarket?"up":"down"}>{formatUsd(totals.paidTotal)}</b>{totals.acquired>0&&<span>{totals.paidTotal<=totals.acquiredMarket?`${formatUsd(totals.acquiredMarket-totals.paidTotal)} under market`:`${formatUsd(totals.paidTotal-totals.acquiredMarket)} over market`}</span>}</div>
    </div></section>
   <section className="detail-section"><header><span>{totals.count} starred</span><h2>The list</h2>
    <label className="buylist-sort"><span>Sort</span><select value={sort} onChange={event=>setSort(event.target.value as BuySort)}><option value="set">By set</option><option value="price">By price</option><option value="added">Recently added</option></select></label></header>
    <ol className="buylist-rows">{entries.map(entry=>{
     const state=favorites.buyStates[entry.key];
     return <Row key={entry.key} entry={entry} acquired={Boolean(state?.acquired)} paid={state?.paid??null}
      onAcquired={next=>favorites.setBuyState(entry.key,{acquired:next,paid:state?.paid??null})}
      onPaid={next=>favorites.setBuyState(entry.key,{acquired:Boolean(state?.acquired),paid:next})}
      onRemove={()=>favorites.remove(entry.key)}/>;
    })}</ol></section>
   </>}
  </article></main>;
}
