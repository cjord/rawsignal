"use client";
import {useEffect,useState} from 'react';
import {GamesShell} from '../GamesView';
import DeferredImage from '../DeferredImage';
import {decodeGameShare,type GameShare} from '../../core/domain/game-sharing';
import {validDailyManifest} from '../../core/domain/auction-save';
import {validDailyShowdownManifest,dailyShowdownHistory,showdownScore,type DailyShowdownManifest} from '../../core/domain/showdown-daily';
import type {DailyAuctionManifest} from '../../core/domain/auction-types';
import {dailyAuctionResults} from '../../core/domain/auction-daily-results';
import PriceShowdownHistory from './PriceShowdownHistory';
import ShareGameResults from './ShareGameResults';
import {auctionShareText,showdownShareText} from '../../core/domain/game-sharing';
import {auctionUsd} from './AuctionWallet';

type Loaded={kind:'auction';share:Extract<GameShare,{g:'auction'}>;manifest:DailyAuctionManifest}|{kind:'showdown';share:Extract<GameShare,{g:'showdown'}>;manifest:DailyShowdownManifest};
function AuctionResults({share,manifest}:Extract<Loaded,{kind:'auction'}>){
 const results=dailyAuctionResults(manifest,share.r);
 const metrics=[['Auctions Won',`${results.won} / 5`],['Net Profit / Loss',auctionUsd(results.profit)],['Ending Challenge Cash',auctionUsd(results.cash)],['Normal Wallet Bonus',auctionUsd(results.reward)],['Investigation Spend',auctionUsd(results.investigations)],['Entry Fees',auctionUsd(results.entries)],['Cards Won & Auto-Sold',String(results.copies)]];
 return <><section className="detail-section"><h2>Daily Auction Results · {manifest.date}</h2><dl className="auction-statistics-grid">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="game-share-actions"><ShareGameResults share={share} text={url=>auctionShareText(manifest,share.r,url)}/></div></section>
  <section className="detail-section game-result-breakdown"><h2>The Five Auctions</h2><div className="game-result-table"><table><thead><tr><th>Auction</th><th>Winner</th><th>Winning Bid</th><th>Investigations</th><th>Your P/L</th></tr></thead><tbody>{results.rows.map(row=><tr key={row.index}><th>{row.index+1} · {row.index<3?'Free':'Paid'}<small>Round {row.round}{row.buyout?' · Buyout':''}</small></th><td>{row.winnerName}</td><td>{auctionUsd(row.bid)}</td><td>{auctionUsd(row.investigations)}</td><td data-tone={row.profit<0?'loss':row.profit>0?'gain':undefined}>{auctionUsd(row.profit)}</td></tr>)}</tbody></table></div></section>
  <section className="detail-section"><h2>Most Valuable Cards Won</h2><p className="games-note">Automatically sold after each auction. Prices below are the frozen daily market values before the 10% selling fee, not current inventory or sale quotes.</p>{!results.top.length?<p>No collections won on this run.</p>:<div className="game-result-cards">{results.top.map(({card,quantity})=><a className="game-result-card" href={`/cards/${card.productId}`} key={`${card.productId}:${card.printing}`}><DeferredImage src={card.image} alt=""/><div><b>{card.name}</b><small>{card.printing} · {card.rarity} · ×{quantity}</small><strong>{auctionUsd(card.cents)}</strong></div></a>)}</div>}</section>
 </>;
}
function ShowdownResults({share,manifest}:Extract<Loaded,{kind:'showdown'}>){
 const history=dailyShowdownHistory(manifest,share.m,share.p),score=showdownScore(history);
 return <><section className="detail-section"><h2>Daily Showdown · {manifest.date}</h2><p>{share.m==='hard'?'Hard':'Normal'} · {score.correct}/10 correct · Best streak {score.best}</p><div className="game-result-emoji" aria-label="All ten round results">{history.map(row=><span key={row.roundNumber} aria-label={`Round ${row.roundNumber}: ${row.correct?'correct':'wrong'}`}>{row.correct?'🟩':'🟥'}</span>)}</div><ShareGameResults share={share} text={url=>showdownShareText(manifest,share.m,share.p,url)}/></section><PriceShowdownHistory history={[...history].reverse()} daily/></>;
}
export default function GameResults(){
 const [loaded,setLoaded]=useState<Loaded|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let controller:AbortController|null=null;
  const load=async()=>{
   controller?.abort();const request=new AbortController();controller=request;setLoaded(null);setError('');
   try{
    const share=decodeGameShare(window.location.hash.slice(1)),response=await fetch(`/api/${share.g==='auction'?'auction':'showdown'}/daily?date=${share.d}`,{signal:request.signal});
    if(!response.ok)throw new Error('The saved daily snapshot is unavailable. Results cannot be reconstructed.');
    const manifest:unknown=await response.json();if(request.signal.aborted)return;
    if(share.g==='auction'&&validDailyManifest(manifest)&&manifest.date===share.d)setLoaded({kind:'auction',share,manifest});
    else if(share.g==='showdown'&&validDailyShowdownManifest(manifest)&&manifest.date===share.d)setLoaded({kind:'showdown',share,manifest});
    else throw new Error('This results link does not match a supported daily snapshot.');
   }catch(error){if(!request.signal.aborted)setError(error instanceof Error?error.message:'Results could not be loaded.')}
  };
  void load();window.addEventListener('hashchange',load);return()=>{controller?.abort();window.removeEventListener('hashchange',load)};
 },[]);
 return <GamesShell auction={loaded?.kind==='auction'}><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Daily Challenge · Shared Results</span><h1>Challenge Results</h1><p>Self-reported browser results, not verified scores. Detailed results may contain card and price spoilers.</p></header>{error?<p role="alert">{error} No game progress has been changed.</p>:loaded?loaded.kind==='auction'?<AuctionResults {...loaded}/>:<ShowdownResults {...loaded}/>:<p role="status">Loading daily results…</p>}<p className="games-note">The link contains only this run’s compact results—not your wallet, inventory, profile or browser save. No share record is stored on the server. Results require the original daily snapshot to remain available.</p></GamesShell>;
}
