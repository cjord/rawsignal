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
import {holdingKey,type AuctionSave} from '../core/domain/auction-types';
import {auctionCatalog} from '../core/domain/auction-market';
import {beginAuction,tickAuction} from '../core/domain/auction-engine';
import {prepareAuctionLot} from './data/auction-images';
import {createPriceGameImageLoader} from './data/price-game-images';
import {useAuctionReveal,useAuctionSound} from './games/useAuctionPresentation';
import AuctionBidHistory from './games/AuctionBidHistory';
import AuctionWinner,{useAuctionWinner} from './games/AuctionWinner';
import InfoHint from './InfoHint';

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
function AuctionSaveFeedback({save,error,reset}:{save:AuctionSave|null;error:string|null;reset:()=>void}){
 return <>{error&&<p className="auction-warning" role="alert">{error} {!save&&<button className="game-control" type="button" onClick={()=>{if(window.confirm('Reset this game to $2,500 cash and no inventory?'))reset()}}>Reset saved game</button>}</p>}{!save&&!error&&<p role="status">Loading saved game…</p>}</>;
}
function AuctionLobby({available,preparing,imageError,enter}:{available:boolean;preparing:boolean;imageError:string;enter:()=>Promise<void>}){
 return <section className="detail-section auction-lobby"><h2>Your Next Collection <InfoHint label="Auction timing and preparation">Background tabs and reloads do not pause an active round. Review inventory or sell it before entering.</InfoHint></h2><p className="auction-lobby-intro">Bid on a new collection against three NPC bidders.</p><div className="auction-lobby-facts"><span>Free Entry</span><span>Up to 4 Rounds</span><span>1 Minute per Round</span></div><button className="game-control" type="button" disabled={!available||preparing} onClick={()=>void enter()}>Enter free auction</button>{preparing&&<div aria-busy="true"><p role="status">Checking card artwork…</p><div className="auction-loading detail-skeleton" aria-hidden="true"/></div>}{imageError&&<p role="alert">{imageError}</p>}</section>;
}
export default function RiftboundAuctionHouse(){
 const {items,status,reload}=useCatalogPage({sources,parse:parseCards,keyOf:holdingKey});
 const catalog=useMemo(()=>auctionCatalog(items),[items]),{save,error,transact,reset}=useAuctionSave();
 const [now,setNow]=useState(()=>Date.now()),arena=useRef<HTMLDivElement>(null);
 const [preparing,setPreparing]=useState(false),[imageError,setImageError]=useState('');
 const loader=useRef(createPriceGameImageLoader()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const celebrating=useAuctionWinner(save?.auction??null);
 const reveal=useAuctionReveal(save?.auction??null,!celebrating),audio=useAuctionSound(save?.auction??null,now);
 const enter=async()=>{
  if(preparing)return;audio.unlock();setPreparing(true);setImageError('');
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  const lot=await prepareAuctionLot(catalog,loader.current,seed);
  if(!mounted.current)return;
  setPreparing(false);
  if(lot.length)transact(current=>beginAuction(current,catalog,Date.now(),lot,seed));
  else setImageError('Not enough cards with working artwork are available. Please retry.');
 };
 useEffect(()=>{const tick=()=>{const time=Date.now();setNow(time);transact(current=>tickAuction(current,time))};const interval=window.setInterval(tick,250);window.addEventListener('visibilitychange',tick);return()=>{clearInterval(interval);window.removeEventListener('visibilitychange',tick)}},[transact]);
 useEffect(()=>{arena.current?.scrollIntoView({behavior:'instant',block:'start'})},[save?.auction?.seed,save?.auction?.round]);
 const ready=status==='success',available=ready&&catalog.filter(card=>card.image.trim()).length>=6;
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Riftbound · single-auction prototype</span><div className="auction-title-row"><h1>Riftbound Auction House</h1><button type="button" className="game-control auction-mute" disabled={!save&&!error} aria-pressed={audio.sound==='muted'} onClick={audio.toggle}>{audio.sound==='muted'?'Enable Sound':'Mute Sound'}</button></div><p>Buy clues. Lock your bid. Discover the collection—and whether your instincts paid off.</p></header>
  <AuctionSaveFeedback save={save} error={error} reset={reset}/>
  {save&&!save.auction&&<AuctionWallet save={save} catalog={catalog} cards={items} transact={transact} reset={reset} refresh={reload} loading={!ready}/>}
  {status==='loading'&&<div aria-busy="true"><p role="status">Loading current market…</p><div className="auction-loading detail-skeleton" aria-hidden="true"/></div>}
  {(status==='error'||status==='empty')&&<p role="status">Current market prices are unavailable. <button className="game-control" type="button" onClick={reload}>Retry market</button></p>}
  {save&&!save.auction&&<AuctionLobby available={available} preparing={preparing} imageError={imageError} enter={enter}/>}
  {save?.auction&&<div ref={arena} className="auction-arena" onPointerDownCapture={audio.unlock} onKeyDownCapture={audio.unlock}><AuctionRoundHeader auction={save.auction} now={now}/>{celebrating?<AuctionWinner auction={save.auction}/>:<AuctionRound save={save} now={now} transact={transact} revealDone={reveal.done} visible={reveal.visible}/>} {!celebrating&&<AuctionCollection auction={save.auction} visible={reveal.visible} done={reveal.done} skip={reveal.skip}/>}<AuctionBidHistory auction={save.auction}/></div>}
  <p className="games-note">TCGCSV / TCGplayer Near Mint market pricing. Auction contents/prices freeze on entry; owned inventory is repriced from the current loaded catalog. Price refreshes use existing cached feeds, not real-time sale quotes. Missing prices remain unavailable. Clearing browser storage removes progress. Casual single-player only; local saves are not tamper-proof.</p>
 </GamesShell>;
}
