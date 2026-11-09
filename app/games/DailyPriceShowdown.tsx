"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {GamesShell} from '../GamesView';
import SlidingTabs from '../SlidingTabs';
import {CheckboxGrid} from '../filters/CheckboxGrid';
import {RoundChoices} from './PriceShowdownSession';
import PriceShowdownHistory from './PriceShowdownHistory';
import PriceShowdownSkeleton from './PriceShowdownSkeleton';
import {useDailyShowdown} from './useDailyShowdown';
import {advanceDailyShowdown,answerDailyShowdown,dailyShowdownHistory,showdownScore} from '../../core/domain/showdown-daily';
import {priceGameWinner,type PriceGameDifficulty} from '../../core/domain/price-game';
import {utcGameDate} from '../../core/domain/daily-game';
import ShareGameResults from './ShareGameResults';
import {showdownShareText} from '../../core/domain/game-sharing';
import type {MarketDailySave} from '../../core/domain/showdown-market';
import {GAME_PROFILES,type GameMarket} from '../../core/domain/game-profile';
import {useAccount} from '../account/AccountProvider';
const subscribeClient=()=>()=>{};
const clientReady=()=>true,serverReady=()=>false;

type SessionProps={save:MarketDailySave;mode:PriceGameDifficulty;auto:boolean;expired:boolean;transact:(update:(save:MarketDailySave)=>MarketDailySave)=>void};
function DailyShowdownSession({save,mode,auto,expired,transact}:SessionProps){
 const {user}=useAccount();
 const run=save[mode],round=save.manifest[mode][run.cursor],history=dailyShowdownHistory(save.manifest,mode,run.picks),score=showdownScore(history),complete=run.picks.length===10;
 const selected=run.picks.length>run.cursor?round[run.picks[run.cursor]].productId:null,winner=priceGameWinner(round),firstButton=useRef<HTMLButtonElement|null>(null);
 const [artError,setArtError]=useState(false),revealed=selected!==null;
 useEffect(()=>{
  if(!auto||!revealed||complete||expired)return;
  let timer:number|undefined;const schedule=()=>{clearTimeout(timer);if(!document.hidden)timer=window.setTimeout(()=>transact(current=>advanceDailyShowdown(current,mode,Date.now())),1000)};
  schedule();document.addEventListener('visibilitychange',schedule);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',schedule)};
 },[auto,revealed,complete,expired,transact,mode]);
 const next=()=>{setArtError(false);transact(current=>advanceDailyShowdown(current,mode,Date.now()))};
 return <section aria-label="Daily price comparison game"><dl className="price-game-score"><div className="detail-metric price-game-stat stat-correct"><dt>Total Correct</dt><dd>{score.correct} / 10</dd></div><div className="detail-metric price-game-stat stat-streak"><dt>Best Streak</dt><dd>{score.best}</dd></div><div className="detail-metric price-game-stat stat-round"><dt>Round</dt><dd>{run.cursor+1} / 10</dd></div></dl>
  {complete&&<section className="detail-section daily-game-complete"><h2>Daily Challenge Complete</h2><p>{score.correct}/10 correct · Best streak {score.best}. Try the other difficulty or return tomorrow.</p><ShareGameResults share={save.manifest.version===2?{v:2,g:'showdown',market:'pokemon',d:save.manifest.date,m:mode,p:run.picks,c:save.manifest.catalogVersion}:{v:1,g:'showdown',d:save.manifest.date,m:mode,p:run.picks}} text={url=>showdownShareText(save.manifest,mode,run.picks,url)}/></section>}
  <p className="price-game-result" role="status">{revealed?`${selected===winner!.productId?'Correct!':'Not quite.'} ${winner!.name} has the highest market price.`:expired?'This challenge has expired. Load today’s lineup to play.':'Pick the most valuable card.'}</p>
  {artError?<p role="alert">One image could not load. The daily cards won’t be rerolled. <button className="game-control" type="button" onClick={()=>setArtError(false)}>Retry Artwork</button></p>:<RoundChoices showPrinting={save.manifest.version===2} key={`${mode}:${run.cursor}`} round={round} difficulty={mode} selected={selected} preparing={expired} firstButton={firstButton} onChoose={card=>transact(current=>answerDailyShowdown(current,mode,round.findIndex(choice=>choice.productId===card.productId),Date.now()))} onFailed={()=>setArtError(true)}/>}
  {!complete&&<div className="price-game-next"><button className="game-control" type="button" disabled={!revealed||expired} onClick={next}>Next Round →</button><span className="games-note">Answers save {user?'to your account':'in this browser'}. No restarts today.</span></div>}
  <PriceShowdownHistory history={[...history].reverse()} daily/>
 </section>;
}
function DailyContent({market,mode,auto,date}:{market:GameMarket;mode:PriceGameDifficulty;auto:boolean;date:string}){
 const {save,error,loading,reload,transact}=useDailyShowdown(market),expired=!!save&&save.manifest.date!==date;
 return <>{loading&&<PriceShowdownSkeleton difficulty={mode}/>}{error&&<p role="alert">{error} <button className="game-control" type="button" onClick={reload}>Retry Daily Lineup</button></p>}
  {expired&&<button className="game-control" type="button" onClick={reload}>Load Today’s Challenge</button>}
  {save&&<>{save.manifest.version===2&&<p className="game-pool-count">Today’s Theme: {save.manifest.theme.label}</p>}<p className="games-note">{save.manifest.date} · TCGCSV / TCGplayer Near Mint market prices, frozen for this daily lineup.{save.manifest.version===2?` Source date: ${save.manifest.sourceAsOf??'unavailable'}.`:''}</p><DailyShowdownSession key={`${save.manifest.date}:${mode}`} save={save} mode={mode} auto={auto} expired={expired} transact={transact}/></>}
 </>;
}
export default function DailyPriceShowdown({market='riftbound'}:{market?:GameMarket}){
 const account=useAccount(),[mode,setMode]=useState<PriceGameDifficulty>('normal'),[auto,setAuto]=useState(true),[date,setDate]=useState(()=>utcGameDate(Date.now()));
 const ready=useSyncExternalStore(subscribeClient,clientReady,serverReady),disabled=!ready||account.loading||!!account.error;
 useEffect(()=>{const timer=window.setInterval(()=>setDate(utcGameDate(Date.now())),1000);return()=>clearInterval(timer)},[]);
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">{GAME_PROFILES[market].label} · Daily Challenge</span><h1>{market==='pokemon'?'Pokémon Daily Price Showdown':'Daily Price Showdown'}</h1><p>Ten rounds. The same cards and frozen prices for everyone. How well do you know the market?</p></header>
  <fieldset disabled={disabled} aria-busy={disabled} className={`price-game-controls${market==='pokemon'?' pokemon-price-controls':''}`}><legend className="sr-only">Daily Challenge Controls</legend><SlidingTabs label="Daily Difficulty" className="price-game-difficulty market-tabs" options={[{key:'normal',label:'Normal · 2 Cards'},{key:'hard',label:'Hard · 3 Cards'}]} selectedKey={mode} onSelect={key=>setMode(key as PriceGameDifficulty)}/><CheckboxGrid className="set-option-grid price-game-auto" options={[{key:'auto',label:'Auto Next Round (1s)'}]} selected={auto?['auto']:[]} onToggle={()=>setAuto(value=>!value)}/></fieldset>
  <p className="games-note">One 10-round attempt per mode, {account.user?'saved to your account':'in this browser'}. Switching modes keeps both runs. Reload to resume. Resets at midnight UTC; unfinished runs expire. Scores are self-reported.</p>
  {account.loading?<PriceShowdownSkeleton difficulty={mode}/>:account.error?<p role="alert">Your account could not be checked. Use Retry Account before starting a challenge.</p>:<DailyContent key={`${market}:${account.user?.id??'guest'}`} market={market} mode={mode} auto={auto} date={date}/>}
  <p><a className="games-back" href={GAME_PROFILES[market].pricePath}>Unlimited Practice →</a></p>
 </GamesShell>;
}
