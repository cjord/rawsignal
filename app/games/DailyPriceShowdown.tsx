"use client";
import {useEffect,useRef,useState} from 'react';
import {GamesShell} from '../GamesView';
import SlidingTabs from '../SlidingTabs';
import {CheckboxGrid} from '../filters/CheckboxGrid';
import {RoundChoices} from './PriceShowdownSession';
import PriceShowdownHistory from './PriceShowdownHistory';
import PriceShowdownSkeleton from './PriceShowdownSkeleton';
import {useDailyShowdown} from './useDailyShowdown';
import {advanceDailyShowdown,answerDailyShowdown,dailyShowdownHistory,showdownScore,type DailyShowdownSave} from '../../core/domain/showdown-daily';
import {priceGameWinner,type PriceGameDifficulty} from '../../core/domain/price-game';
import {utcGameDate} from '../../core/domain/daily-game';
import ShareGameResults from './ShareGameResults';
import {showdownShareText} from '../../core/domain/game-sharing';

type SessionProps={save:DailyShowdownSave;mode:PriceGameDifficulty;auto:boolean;expired:boolean;transact:(update:(save:DailyShowdownSave)=>DailyShowdownSave)=>void};
function DailyShowdownSession({save,mode,auto,expired,transact}:SessionProps){
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
  {complete&&<section className="detail-section daily-game-complete"><h2>Daily Challenge Complete</h2><p>{score.correct}/10 correct · Best streak {score.best}. Try the other difficulty or return tomorrow.</p><ShareGameResults share={{v:1,g:'showdown',d:save.manifest.date,m:mode,p:run.picks}} text={url=>showdownShareText(save.manifest,mode,run.picks,url)}/></section>}
  <p className="price-game-result" role="status">{revealed?`${selected===winner!.productId?'Correct!':'Not quite.'} ${winner!.name} has the highest market price.`:expired?'This challenge has expired. Load today’s lineup to play.':'Pick the most valuable card.'}</p>
  {artError?<p role="alert">One image could not load. The daily cards won’t be rerolled. <button className="game-control" type="button" onClick={()=>setArtError(false)}>Retry Artwork</button></p>:<RoundChoices key={`${mode}:${run.cursor}`} round={round} difficulty={mode} selected={selected} preparing={expired} firstButton={firstButton} onChoose={card=>transact(current=>answerDailyShowdown(current,mode,round.findIndex(choice=>choice.productId===card.productId),Date.now()))} onFailed={()=>setArtError(true)}/>} 
  {!complete&&<div className="price-game-next"><button className="game-control" type="button" disabled={!revealed||expired} onClick={next}>Next Round →</button><span className="games-note">Answers save in this browser. No restarts today.</span></div>}
  <PriceShowdownHistory history={[...history].reverse()} daily/>
 </section>;
}
export default function DailyPriceShowdown(){
 const {save,error,loading,reload,transact}=useDailyShowdown(),[mode,setMode]=useState<PriceGameDifficulty>('normal'),[auto,setAuto]=useState(true),[date,setDate]=useState(()=>utcGameDate(Date.now()));
 useEffect(()=>{const timer=window.setInterval(()=>setDate(utcGameDate(Date.now())),1000);return()=>clearInterval(timer)},[]);
 const expired=!!save&&save.manifest.date!==date;
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Riftbound · Daily Challenge</span><h1>Daily Price Showdown</h1><p>Ten rounds. The same cards and frozen prices for everyone. How well do you know the market?</p></header>
  <div className="price-game-controls"><SlidingTabs label="Daily Difficulty" className="price-game-difficulty market-tabs" options={[{key:'normal',label:'Normal · 2 Cards'},{key:'hard',label:'Hard · 3 Cards'}]} selectedKey={mode} onSelect={key=>setMode(key as PriceGameDifficulty)}/><CheckboxGrid className="set-option-grid price-game-auto" options={[{key:'auto',label:'Auto Next Round (1s)'}]} selected={auto?['auto']:[]} onToggle={()=>setAuto(value=>!value)}/></div>
  <p className="games-note">One 10-round attempt per mode, per browser. Switching modes keeps both runs. Reload to resume. Resets at midnight UTC; unfinished runs expire. Local scores are not tamper-proof.</p>
  {loading&&<PriceShowdownSkeleton difficulty={mode}/>}{error&&<p role="alert">{error} <button className="game-control" type="button" onClick={reload}>Retry Daily Lineup</button></p>}
  {expired&&<button className="game-control" type="button" onClick={reload}>Load Today’s Challenge</button>}
  {save&&<><p className="games-note">{save.manifest.date} · TCGCSV / TCGplayer Near Mint market prices, frozen for this daily lineup.</p><DailyShowdownSession key={`${save.manifest.date}:${mode}`} save={save} mode={mode} auto={auto} expired={expired} transact={transact}/></>}
  <p><a className="games-back" href="/games/riftbound-price">Unlimited Practice →</a></p>
 </GamesShell>;
}
