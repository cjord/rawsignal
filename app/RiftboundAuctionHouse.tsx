"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type ComponentProps} from 'react';
import {GamesShell} from './GamesView';
import {useAuctionCatalog} from './data/useAuctionCatalog';
import {useAuctionSave} from './games/useAuctionSave';
import AuctionWallet from './games/AuctionWallet';
import AuctionCollection from './games/AuctionCollection';
import AuctionRound,{AuctionRoundHeader} from './games/AuctionRound';
import {type AuctionSave} from '../core/domain/auction-types';
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
import {useAccount} from './account/context';
import AuctionMarketStatus from './games/AuctionMarketStatus';
import AuctionLobbySkeleton from './games/AuctionLobbySkeleton';

function AuctionSaveFeedback({save,error,reset}:{save:AuctionSave|null;error:string|null;reset:()=>void}){
 return <>{error&&<p className="auction-warning" role="alert">{error} {!save&&<button className="game-control" type="button" onClick={()=>{if(window.confirm('Reset this game to $2,500 cash and no inventory?'))reset()}}>Reset saved game</button>}</p>}{!save&&!error&&<p className="auction-loading-announcement" role="status">Loading saved game…</p>}</>;
}
function AuctionPageHeader({save,error,audio,auto,transact}:{save:AuctionSave|null;error:string|null;audio:ReturnType<typeof useAuctionSound>;auto:ReturnType<typeof useAuctionAutoAdvance>;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const auction=save?.auction??null;
 return <AuctionHeader kind={auction?.kind} sound={audio.sound} mute={audio.toggle} disabled={!save&&!error} autoAdvance={auto.enabled} toggleAuto={auto.toggle} leave={<AuctionLeave key={auction?.seed} auction={auction} transact={transact}/>}/>;
}
function NormalAuctionLobby({save,saveError,dailyMode,entry,available,...wallet}:{save:AuctionSave|null;saveError:string|null;dailyMode:boolean;entry:ReturnType<typeof useAuctionEntry>;available:boolean}&Omit<ComponentProps<typeof AuctionWallet>,'save'>){
 if(!save)return dailyMode||saveError?null:<AuctionLobbySkeleton/>;
 if(save.auction||dailyMode)return null;
 return <div className="auction-lobby-scene"><AuctionWallet save={save} {...wallet}/>{entry.checking&&<p role="status">Checking Latest Available Prices…</p>}<AuctionLobby available={available} preparing={Boolean(entry.entry)||entry.checking} imageError={entry.imageError} enter={entry.enter} cash={save.wallet.cash} feeBps={1000}/><AuctionStatistics save={save}/></div>;
}
function AuctionDataNote({dailyMode}:{dailyMode:boolean}){
 return <p className="games-note">{dailyMode?'TCGCSV / TCGplayer Near Mint prices frozen in the shared UTC-day snapshot. Challenge wins auto-sell at those prices less a fixed 10% fee.':'TCGCSV / TCGplayer Near Mint market pricing. Auction contents/prices freeze on entry; owned inventory is repriced from the current loaded catalog. Price refreshes use existing cached feeds, not real-time sale quotes.'} Missing prices remain unavailable. Clearing browser storage removes progress. Casual single-player only; local saves and daily limits are not tamper-proof.</p>;
}
export default function RiftboundAuctionHouse({dailyMode=false,catalogCache=false}:{dailyMode?:boolean;catalogCache?:boolean}){
 const account=useAccount();
 const {items,status,reload,error:catalogError,manifest,checking,checkLatest}=useAuctionCatalog(!account.loading&&!account.error,catalogCache);
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
 const entry=useAuctionEntry(catalog,transact,audio.unlock,dailyMode?undefined:checkLatest);
 useEffect(()=>{const tick=()=>{const time=Date.now();setNow(time);transact(current=>tickAuction(current,time))};const interval=window.setInterval(tick,250);window.addEventListener('visibilitychange',tick);return()=>{clearInterval(interval);window.removeEventListener('visibilitychange',tick)}},[transact]);
 useAuctionNavigation(arena,auction,celebrating);
 const ready=status==='success',available=ready&&!checking&&catalog.filter(card=>card.image.trim()).length>=6;
 return <GamesShell auction wide={Boolean(auction)}><a className="games-back" href="/games">← Games</a><AuctionPageHeader save={save} error={error} audio={audio} auto={auto} transact={transact}/>
  <AuctionSaveFeedback save={root} error={error} reset={reset}/>
  {dailyMode&&root&&<AuctionDaily root={root} now={now} transact={saveRoot} enter={entry.enter} preparing={Boolean(entry.entry)}/>}
  <NormalAuctionLobby save={save} saveError={error} dailyMode={dailyMode} entry={entry} available={available} catalog={catalog} reset={reset} loading={status==='loading'||status==='idle'}/>
  <AuctionMarketStatus status={status} error={catalogError} manifest={manifest} reload={reload} checking={checking}/>
  {dailyMode&&entry.imageError&&<p role="alert">{entry.imageError}</p>}
  {entry.entry&&<AuctionEntryReveal key={entry.entry.seed} entry={entry.entry} catalog={catalog} cancel={entry.cancel} skip={entry.skip} cue={audio.cue}/>}
  {save?.auction&&<div ref={arena} className="auction-arena" onPointerDownCapture={audio.unlock} onKeyDownCapture={audio.unlock}><AuctionRoundHeader auction={save.auction} now={now}/>{celebrating?<AuctionWinner auction={save.auction}/>:<AuctionRound save={save} now={now} transact={transact} dailyMode={dailyMode} autoSeconds={auto.seconds} revealDone={reveal.done} visible={reveal.visible}/>} {!celebrating&&<AuctionCollection auction={save.auction} visible={reveal.visible} done={reveal.done} skip={reveal.skip} choose={slot=>transact(current=>selectFollowUp(current,slot,Date.now()))}/>} <AuctionBiddingHistory auction={save.auction}/></div>}
  <AuctionDataNote dailyMode={dailyMode}/>
 </GamesShell>;
}
