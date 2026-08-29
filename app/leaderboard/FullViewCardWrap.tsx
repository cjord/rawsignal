"use client";
import type {ReactNode} from "react";
import FavoriteStar from "../FavoriteStar";
import {SignalBadge} from "../SignalControls";
import type {FavoriteEntry} from "../state/favorites";
import type {MarketSignal} from "../../core/signal-utils";

// The full-view wrapper both leaderboards share: the signal badge and favorite star
// pinned over a full-card detail link.
export default function FullViewCardWrap({signal,favorite,href,label,children}:{signal:MarketSignal|null;favorite:FavoriteEntry;href:string;label:string;children:ReactNode}){
 return <span className="signal-card-wrap">
  {signal&&<SignalBadge signal={signal}/>}
  <span className="row-star"><FavoriteStar entry={favorite}/></span>
  <a className="detail-link-card" href={href} aria-label={label}>{children}</a>
 </span>;
}
