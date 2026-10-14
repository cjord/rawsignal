"use client";
import type {ReactNode} from "react";
import TopBar from "./TopBar";
import SiteFooter from "./SiteFooter";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";

export function GamesShell({children}:{children:ReactNode}){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 return <><TopBar active="games" strictness={strictness} onStrictness={setStrictness}/><main className="games-page">{children}</main><SiteFooter/></>;
}
export default function GamesView(){
 return <GamesShell><header className="games-heading"><span className="games-eyebrow">Play the market</span><h1>Games</h1><p>A little instinct. A little market knowledge. No prices until you choose.</p></header>
  <div className="set-grid games-grid"><a className="set-tile game-tile" href="/games/riftbound-price"><span className="games-eyebrow">Riftbound · Singles</span><h2>Riftbound Price Showdown</h2><p>Which card costs more? Compare two cards in Normal or three in Hard, reveal their market prices, and build your streak.</p><span className="game-tile-foot">Play now <span aria-hidden="true">→</span></span></a></div>
  <p className="games-note">Pokémon is planned next. This first game uses Riftbound singles only—not sealed products.</p>
 </GamesShell>;
}
