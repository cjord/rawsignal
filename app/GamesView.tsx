"use client";
import type {ReactNode} from "react";
import DeferredImage from "./DeferredImage";
import TopBar from "./TopBar";
import SiteFooter from "./SiteFooter";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import {useAccount} from './account/AccountProvider';
import AuctionPageBackground from './games/AuctionPageBackground';

export function GamesShell({children,wide=false,auction=false}:{children:ReactNode;wide?:boolean;auction?:boolean}){
 const account=useAccount();
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 return <><TopBar active="games" strictness={strictness} onStrictness={setStrictness}/><div className={auction?'auction-page-scene':undefined}>{auction&&<AuctionPageBackground/>}<main className={`games-page${wide?' games-page-wide':''}`}>{account.enabled&&!account.loading&&!account.error&&!account.user&&<p className="account-guest-warning">You’re playing as a guest. Progress won’t transfer to an account or another device. <a href="/account">Log In</a> to start saving.</p>}{children}</main></div><SiteFooter/></>;
}
export default function GamesView(){
 return <GamesShell><header className="games-heading"><span className="games-eyebrow">Play the market</span><h1>Games</h1><p>A little instinct. A little market knowledge. Put yours to the test.</p></header>
  <div className="set-grid games-grid"><a className="set-tile game-tile" href="/games/riftbound-price"><DeferredImage className="game-tile-art" src="/images/games/riftbound-price-showdown-v2.webp" alt=""/><span className="games-eyebrow">Riftbound · Singles</span><h2>Riftbound Price Showdown</h2><p>How well do you know the market? Pick the most valuable card to build your streak. Compare two in Normal or three in Hard.</p><span className="game-tile-foot">Play now <span aria-hidden="true">→</span></span></a>
  <a className="set-tile game-tile" href="/games/riftbound-auction"><DeferredImage className="game-tile-art" src="/images/games/riftbound-auction-house-v2.webp" alt=""/><span className="games-eyebrow">Riftbound · Strategy</span><h2>Riftbound Auction House</h2><p>Bid on mystery Riftbound collections. Buy clues, outsmart rival bidders, and build your virtual inventory.</p><span className="game-tile-foot">Play prototype <span aria-hidden="true">→</span></span></a></div>
  <section className="games-daily-directory" aria-labelledby="daily-games-title"><header className="games-heading"><span className="games-eyebrow">One day · Shared lineups</span><h2 id="daily-games-title">Daily Challenges</h2><p>Fresh at midnight UTC. Play, compare results, and share your run.</p></header><div className="set-grid games-grid">
   <a className="set-tile game-tile game-daily-tile" href="/games/riftbound-price/daily"><DeferredImage className="game-tile-art" src="/images/games/riftbound-price-showdown-v2.webp" alt=""/><span className="games-eyebrow">Daily · Normal + Hard</span><h2>Daily Price Showdown</h2><p>Ten shared rounds per mode. Pick the most valuable cards and share your green-and-red result grid.</p><span className="game-tile-foot">Take the challenge <span aria-hidden="true">→</span></span></a>
   <a className="set-tile game-tile game-daily-tile" href="/games/riftbound-auction/daily"><DeferredImage className="game-tile-art" src="/images/games/riftbound-auction-house-v2.webp" alt=""/><span className="games-eyebrow">Daily · Five Auctions</span><h2>Daily Auction Challenge</h2><p>Turn a separate $2,500 bankroll into a five-auction run. Share your profit, biggest wins and most valuable cards.</p><span className="game-tile-foot">Enter today’s auctions <span aria-hidden="true">→</span></span></a>
  </div></section><p className="games-note">These games use Riftbound singles only—not sealed products. Pokémon games are planned later.</p>
 </GamesShell>;
}
