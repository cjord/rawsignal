"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type ComponentProps} from 'react';
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
import {tickAuction} from '../core/domain/auction-engine';
import {useAuctionNavigation,useAuctionReveal,useAuctionSound} from './games/useAuctionPresentation';
import AuctionWinner,{useAuctionWinner} from './games/AuctionWinner';
import AuctionLobby from './games/AuctionLobby';
import AuctionHeader from './games/AuctionHeader';
import {useAuctionAutoAdvance} from './games/useAuctionAutoAdvance';
import {AuctionBiddingHistory} from './games/AuctionBidHistory';
import AuctionLeave from './games/AuctionLeave';
import {useAuctionEntry} from './games/useAuctionEntry';
import AuctionEntryReveal from './games/AuctionEntryReveal';
import AuctionStatistics from './games/AuctionStatistics';
import AuctionDaily from './games/AuctionDaily';
import {dailyAuctionDate,updateDailyAuction} from '../core/domain/auction-daily';
import {selectFollowUp} from '../core/domain/auction-follow-up';

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
function AuctionSaveFeedback({save,error,reset}:{save:AuctionSave|null;error:string|null;reset:()=>void}){
 return <>{error&&<p className="auction-warning" role="alert">{error} {!save&&<button className="game-control" type="button" onClick={()=>{if(window.confirm('Reset this game to $2,500 cash and no inventory?'))reset()}}>Reset saved game</button>}</p>}{!save&&!error&&<p role="status">Loading saved game…</p>}</>;
}
function AuctionPageHeader({save,error,audio,auto,transact}:{save:AuctionSave|null;error:string|null;audio:ReturnType<typeof useAuctionSound>;auto:ReturnType<typeof useAuctionAutoAdvance>;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const auction=save?.auction??null;
 return <AuctionHeader kind={auction?.kind} sound={audio.sound} mute={audio.toggle} disabled={!save&&!error} autoAdvance={auto.enabled} toggleAuto={auto.toggle} leave={<AuctionLeave key={auction?.seed} auction={auction} transact={transact}/>}/>;
}
function NormalAuctionLobby({save,dailyMode,entry,available,...wallet}:{save:AuctionSave|null;dailyMode:boolean;entry:ReturnType<typeof useAuctionEntry>;available:boolean}&Omit<ComponentProps<typeof AuctionWallet>,'save'>){
 if(!save||save.auction||dailyMode)return null;
 return <div className="auction-lobby-scene"><AuctionWallet save={save} {...wallet}/><AuctionLobby available={available} preparing={Boolean(entry.entry)} imageError={entry.imageError} enter={entry.enter} cash={save.wallet.cash} feeBps={1000}/><AuctionStatistics save={save}/></div>;
}
function AuctionDataNote({dailyMode}:{dailyMode:boolean}){
 return <p className="games-note">{dailyMode?'TCGCSV / TCGplayer Near Mint prices frozen in the shared UTC-day snapshot. Challenge wins auto-sell at those prices less a fixed 10% fee.':'TCGCSV / TCGplayer Near Mint market pricing. Auction contents/prices freeze on entry; owned inventory is repriced from the current loaded catalog. Price refreshes use existing cached feeds, not real-time sale quotes.'} Missing prices remain unavailable. Clearing browser storage removes progress. Casual single-player only; local saves and daily limits are not tamper-proof.</p>;
}
export default function RiftboundAuctionHouse({dailyMode=false}:{dailyMode?:boolean}){
 const {items,status,reload}=useCatalogPage({sources,parse:parseCards,keyOf:holdingKey});
 const catalog=useMemo(()=>auctionCatalog(items),[items]),{save:root,error,transact:saveRoot,reset}=useAuctionSave();
 const [now,setNow]=useState(()=>Date.now()),arena=useRef<HTMLDivElement>(null);
 const daily=root?.daily?.date===dailyAuctionDate(now)?root.daily:null;
 const save=dailyMode?(daily?.status==='playing'?daily.save:null):root;
 const auction=save?save.auction:null;
 const transact=useCallback((update:(save:AuctionSave)=>AuctionSave)=>{
  if(!dailyMode)return saveRoot(update);
  const next=saveRoot(current=>updateDailyAuction(current,update,Date.now()));
  return next?.daily?.status==='playing'?next.daily.save:null;
 },[dailyMode,saveRoot]);
 const celebrating=useAuctionWinner(auction);
 const reveal=useAuctionReveal(auction,!celebrating),audio=useAuctionSound(auction,now,reveal.visible.length);
 const auto=useAuctionAutoAdvance(auction,now,transact);
 const entry=useAuctionEntry(catalog,transact,audio.unlock);
 useEffect(()=>{const tick=()=>{const time=Date.now();setNow(time);transact(current=>tickAuction(current,time))};const interval=window.setInterval(tick,250);window.addEventListener('visibilitychange',tick);return()=>{clearInterval(interval);window.removeEventListener('visibilitychange',tick)}},[transact]);
 useAuctionNavigation(arena,auction,celebrating);
 const ready=status==='success',available=ready&&catalog.filter(card=>card.image.trim()).length>=6;
 return <GamesShell auction wide={Boolean(auction)}><a className="games-back" href="/games">← Games</a><AuctionPageHeader save={save} error={error} audio={audio} auto={auto} transact={transact}/>
  <AuctionSaveFeedback save={root} error={error} reset={reset}/>
  {dailyMode&&root&&<><a className="games-back" href="/games/riftbound-auction">← Normal Auctions</a><AuctionDaily root={root} now={now} transact={saveRoot} enter={entry.enter} preparing={Boolean(entry.entry)}/></>}
  <NormalAuctionLobby save={save} dailyMode={dailyMode} entry={entry} available={available} catalog={catalog} cards={items} transact={transact} reset={reset} refresh={reload} loading={!ready}/>
  {status==='loading'&&<p role="status">Loading Market…</p>}
  {(status==='error'||status==='empty')&&<p role="status">Current market prices are unavailable. <button className="game-control" type="button" onClick={reload}>Retry market</button></p>}
  {dailyMode&&entry.imageError&&<p role="alert">{entry.imageError}</p>}
  {entry.entry&&<AuctionEntryReveal key={entry.entry.seed} entry={entry.entry} catalog={catalog} cancel={entry.cancel} skip={entry.skip} cue={audio.cue}/>}
  {save?.auction&&<div ref={arena} className="auction-arena" onPointerDownCapture={audio.unlock} onKeyDownCapture={audio.unlock}><AuctionRoundHeader auction={save.auction} now={now}/>{celebrating?<AuctionWinner auction={save.auction}/>:<AuctionRound save={save} now={now} transact={transact} dailyMode={dailyMode} autoSeconds={auto.seconds} revealDone={reveal.done} visible={reveal.visible}/>} {!celebrating&&<AuctionCollection auction={save.auction} visible={reveal.visible} done={reveal.done} skip={reveal.skip} choose={slot=>transact(current=>selectFollowUp(current,slot,Date.now()))}/>} <AuctionBiddingHistory auction={save.auction}/></div>}
  <AuctionDataNote dailyMode={dailyMode}/>
 </GamesShell>;
}
