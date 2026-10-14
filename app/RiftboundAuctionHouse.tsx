"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {GamesShell} from './GamesView';
import {useCatalogPage} from './data/useCatalogPage';
import {useAuctionSave} from './games/useAuctionSave';
import AuctionWallet from './games/AuctionWallet';
import AuctionCollection from './games/AuctionCollection';
import AuctionRound,{AuctionRoundHeader} from './games/AuctionRound';
import {allowedRarities} from '../core/market-state';
import {parseCards} from '../core/domain/contracts';
import {holdingKey} from '../core/domain/auction-types';
import {auctionCatalog,prototypeLot} from '../core/domain/auction-market';
import {beginAuction,tickAuction} from '../core/domain/auction-engine';

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
export default function RiftboundAuctionHouse(){
 const {items,status,reload}=useCatalogPage({sources,parse:parseCards,keyOf:holdingKey});
 const catalog=useMemo(()=>auctionCatalog(items),[items]),{save,error,transact,reset}=useAuctionSave();
 const [now,setNow]=useState(()=>Date.now()),arena=useRef<HTMLDivElement>(null);
 useEffect(()=>{const tick=()=>{const time=Date.now();setNow(time);transact(current=>tickAuction(current,time))};const interval=window.setInterval(tick,250);window.addEventListener('visibilitychange',tick);return()=>{clearInterval(interval);window.removeEventListener('visibilitychange',tick)}},[transact]);
 useEffect(()=>{arena.current?.scrollIntoView({behavior:'instant',block:'start'})},[save?.auction?.seed,save?.auction?.round]);
 const ready=status==='success',available=ready&&prototypeLot(catalog).length>0;
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Riftbound · single-auction prototype</span><h1>Riftbound Auction House</h1><p>Buy clues. Lock your bid. Discover the collection—and whether your instincts paid off.</p></header>
  <p className="games-note">All cash and trading are virtual, nonredeemable, and saved only in this browser. No real purchases. This prototype repeats one small-binder template; procedural lots and five-auction sessions come later.</p>
  {error&&<p className="auction-warning" role="alert">{error} {!save&&<button className="game-control" type="button" onClick={()=>{if(window.confirm('Reset this game to $2,500 cash and no inventory?'))reset()}}>Reset saved game</button>}</p>}
  {!save&&!error&&<p role="status">Loading saved game…</p>}
  {save&&<AuctionWallet save={save} catalog={catalog} cards={items} transact={transact} reset={reset} refresh={reload} loading={!ready}/>}
  {status==='loading'&&<div aria-busy="true"><p role="status">Loading current market…</p><div className="auction-loading detail-skeleton" aria-hidden="true"/></div>}
  {(status==='error'||status==='empty')&&<p role="status">Current market prices are unavailable. <button className="game-control" type="button" onClick={reload}>Retry market</button></p>}
  {save&&!save.auction&&<section className="detail-section auction-lobby"><h2>Your next mystery binder</h2><p>Free entry · approximately 25–50 copies · three rivals · up to four timed rounds.</p><p className="games-note">Unsubmitted bids become $0 at the deadline. Background tabs and reloads do not pause an active round. Review inventory or sell it before entering.</p><button className="game-control" type="button" disabled={!available} onClick={()=>transact(current=>beginAuction(current,catalog,Date.now()))}>Enter free auction</button>{ready&&!available&&<p>Not enough priced Riftbound cards are available.</p>}</section>}
  {save?.auction&&<div ref={arena} className="auction-arena"><AuctionRoundHeader auction={save.auction} now={now}/><div className="auction-layout"><AuctionCollection auction={save.auction}/><AuctionRound save={save} now={now} transact={transact}/></div></div>}
  <p className="games-note">TCGCSV / TCGplayer Near Mint market pricing. Auction contents/prices freeze on entry; owned inventory is repriced from the current loaded catalog. Price refreshes use existing cached feeds, not real-time sale quotes. Missing prices remain unavailable. Clearing browser storage removes progress. Casual single-player only; local saves are not tamper-proof.</p>
 </GamesShell>;
}
