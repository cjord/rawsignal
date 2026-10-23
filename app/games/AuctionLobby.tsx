"use client";
import {useAuctionShell} from './auction-shell-context';
/* eslint-disable @next/next/no-img-element -- static generated entry artwork; no loading overlay */
import InfoHint from '../InfoHint';
import {AUCTION_PAID_ENTRY,type AuctionKind} from '../../core/domain/auction-types';
import {AUCTION_LOT_SIZES} from '../../core/domain/auction-lots';
import AuctionLink from './AuctionLink';
import AuctionDailyArtwork from './AuctionDailyArtwork';

export default function AuctionLobby({available,preparing,imageError,enter,cash,feeBps,pending=false}:{available:boolean;preparing:boolean;imageError:string;enter:(kind:AuctionKind)=>Promise<void>;cash:number;feeBps:number;pending?:boolean}){
 const shell=useAuctionShell();
 return <section className="detail-section auction-lobby"><h2>Your Next Collection {!pending&&<InfoHint label="Auction timing and preparation">Background tabs and reloads do not pause an active round. Review inventory or sell it before entering.</InfoHint>}</h2><p className="auction-lobby-intro">Bid on a themed collection against three rivals with different investigation strategies.</p><div className="auction-lobby-facts"><span>Up to 4 Rounds</span><span>1 Minute per Round</span><span>{feeBps/100}% Selling Fee</span><span>3 Rival Bidders</span></div>
  <div className="auction-entry-options">
   <button className="game-control auction-entry auction-entry-card" type="button" aria-label="Enter Bilgewater Auction House" disabled={!available||preparing} onClick={()=>void enter('free')}><img src="/images/games/auction-entry-free.webp" alt="" width="960" height="640" decoding="async"/><span><strong>Bilgewater Auction House - <em className="auction-entry-free">Free Entry</em></strong><small>{AUCTION_LOT_SIZES.free.min}–{AUCTION_LOT_SIZES.free.max} cards - Premium Cards</small></span></button>
   <button className="game-control auction-entry auction-entry-card is-premium" type="button" aria-label="Enter Piltover Auction House · $50 Fee" disabled={!available||preparing||cash<AUCTION_PAID_ENTRY} onClick={()=>void enter('paid')}><img src="/images/games/auction-entry-paid.webp" alt="" width="960" height="640" decoding="async"/><span><strong>Piltover Auction House · <em className="auction-entry-fee">$50 Fee</em></strong><small>{AUCTION_LOT_SIZES.paid.min}–{AUCTION_LOT_SIZES.paid.max} cards · More premium cards</small></span></button>
   {pending?<button className="game-control auction-entry-card auction-daily-entry" type="button" disabled aria-label="Daily Challenge"><AuctionDailyArtwork/></button>:<AuctionLink className="game-control auction-entry-card auction-daily-entry" href="/games/riftbound-auction/daily" aria-label="Daily Challenge"><AuctionDailyArtwork/></AuctionLink>}
  </div>
  <p className="games-note">About Entry Fees {!pending&&<InfoHint label="Entry fee rules">Bilgewater entry is free. Piltover charges a $50 fee. The $50 virtual fee buys entry—not the cards. It is charged when bidding begins, after preparation, and is not refunded if you lose or leave. Paid collections contain {AUCTION_LOT_SIZES.paid.min}–{AUCTION_LOT_SIZES.paid.max} cards with more premium cards; rivals bid from their own clues. Winning bids and optional investigations cost extra. Better value or profit is not guaranteed.</InfoHint>}</p>
  {!shell.active&&<p className="auction-actions"><a className="game-control auction-guide-link" href="/games/riftbound-auction/guide">Auction Guide <span aria-hidden="true">→</span></a><a className="game-control auction-guide-link" href="/games/riftbound-auction/showcase">My Showcase <span aria-hidden="true">→</span></a><a className="game-control auction-guide-link" href="/games/riftbound-auction/leaderboard">Leaderboard <span aria-hidden="true">→</span></a><a className="game-control auction-guide-link" href="/games/riftbound-auction/showcases">Public Showcases <span aria-hidden="true">→</span></a></p>}
  {imageError&&<p role="alert">{imageError}</p>}
 </section>;
}
