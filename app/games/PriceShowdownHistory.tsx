"use client";
/* eslint-disable @next/next/no-img-element -- session history reuses verified artwork */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- focusable scroll region allows keyboard scrolling */
import type {PriceGameHistory} from "../../core/domain/price-game";

const usd=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);

export default function PriceShowdownHistory({history}:{history:PriceGameHistory[]}){
 return <details className="detail-section detail-collapsible price-game-history">
  <summary><span className="detail-kicker">Your session</span><h2>Round history <span className="price-game-history-count">({history.length})</span></h2><i className="detail-collapse-mark" aria-hidden="true">▸</i></summary>
  <p className="games-note">Newest first. Your pick is green when correct and red when wrong. Restarting or changing difficulty clears history.</p>
  {!history.length?<p className="games-note">Make a pick to start your history.</p>:<div className="price-game-history-list" role="region" aria-label="Completed rounds" tabIndex={0}>
   {history.map(entry=><article className="price-game-history-row" key={entry.roundNumber} aria-label={`Round ${entry.roundNumber}: ${entry.correct?"correct":"wrong"}`}>
    <header><strong>Round {entry.roundNumber}</strong><span className={entry.correct?"up":"down"}>{entry.correct?"Correct":"Wrong"}</span></header>
    <div className={`price-game-history-cards cards-${entry.cards.length}`}>
     {entry.cards.map(card=>{
      const selected=card.productId===entry.selected,winner=card.productId===entry.winner;
      return <div key={card.productId} className={`price-game-history-card${selected?entry.correct?" is-correct":" is-wrong":""}`}>
       <img src={card.image} alt="" loading="lazy" decoding="async"/>
       <b>{card.name}</b><strong>{usd(card.marketPrice)}</strong>
       <small>{selected?`Your pick · ${entry.correct?"Correct":"Wrong"}`:winner?"Highest price":"Market price"}</small>
      </div>;
     })}
    </div>
   </article>)}
  </div>}
 </details>;
}
