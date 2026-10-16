/* eslint-disable @next/next/no-img-element -- static generated entry artwork; no loading overlay */
import InfoHint from '../InfoHint';
import {AUCTION_PAID_ENTRY,type AuctionKind} from '../../core/domain/auction-types';
import {AUCTION_LOT_SIZES} from '../../core/domain/auction-lots';

export default function AuctionLobby({available,preparing,imageError,enter,cash}:{available:boolean;preparing:boolean;imageError:string;enter:(kind:AuctionKind)=>Promise<void>;cash:number}){
 return <section className="detail-section auction-lobby"><h2>Your Next Collection <InfoHint label="Auction timing and preparation">Background tabs and reloads do not pause an active round. Review inventory or sell it before entering.</InfoHint></h2><p className="auction-lobby-intro">Bid on a themed collection against three rivals with different investigation strategies.</p><div className="auction-lobby-facts"><span>Up to 4 Rounds</span><span>1 Minute per Round</span></div>
  <div className="auction-entry-options">
   <button className="game-control auction-entry auction-entry-card" type="button" aria-label="Enter Free Auction" disabled={!available||preparing} onClick={()=>void enter('free')}><img src="/images/games/auction-entry-free.webp" alt="" width="960" height="640" decoding="async"/><span><strong>Enter Free Auction</strong><small>{AUCTION_LOT_SIZES.free.min}–{AUCTION_LOT_SIZES.free.max} cards · No entry fee</small></span></button>
   <button className="game-control auction-entry auction-entry-card is-premium" type="button" aria-label="Enter Paid Auction · $50" disabled={!available||preparing||cash<AUCTION_PAID_ENTRY} onClick={()=>void enter('paid')}><img src="/images/games/auction-entry-paid.webp" alt="" width="960" height="640" decoding="async"/><span><strong>Enter Paid Auction · $50</strong><small>{AUCTION_LOT_SIZES.paid.min}–{AUCTION_LOT_SIZES.paid.max} cards · Higher-quality collection</small></span></button>
  </div>
  <p className="games-note">Paid Auction <InfoHint label="Paid auction rules">$50 virtual entry, charged only when the collection is ready. Random collections of {AUCTION_LOT_SIZES.paid.min}–{AUCTION_LOT_SIZES.paid.max} cards with more rare/premium cards and slightly more competitive NPCs using their own clues. Entry is not refunded; a better result is not guaranteed.</InfoHint></p>
  <p><a className="game-control auction-guide-link" href="/games/riftbound-auction/guide">Auction Guide <span aria-hidden="true">→</span></a></p>
  {preparing&&<p className="games-note" role="status">Starting Auction…</p>}{imageError&&<p role="alert">{imageError}</p>}
 </section>;
}
