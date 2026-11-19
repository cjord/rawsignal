"use client";
/* eslint-disable @next/next/no-img-element -- local game covers with reserved dimensions */
import type {AuctionKind} from '../../core/domain/auction-types';
import {pokemonAuctionCategory,POKEMON_VINTAGE_SIZE} from '../../core/domain/pokemon-auction-houses';
import {useAuctionPool} from './AuctionGameContext';
import InfoHint from '../InfoHint';
import AuctionLink from './AuctionLink';
import AuctionDailyArtwork from './AuctionDailyArtwork';
export type PokemonLobbyProps={available:boolean;preparing:boolean;imageError:string;enter:(kind:AuctionKind)=>Promise<void>;cash:number;vintageUnlocked?:boolean};
export default function PokemonAuctionLobby({available,preparing,imageError,enter,cash,vintageUnlocked=false}:PokemonLobbyProps){
 const pool=useAuctionPool(),category=pool?pokemonAuctionCategory(pool.scope):null,vintage=category==='vintage';
 return <section className="detail-section auction-lobby"><h2>Your Next Collection</h2><p className="auction-lobby-intro">{category==='legacy'?'Legacy':vintage?'Vintage':'Modern'} Pokémon collections · Three rivals · Four rounds at most</p><div className="auction-lobby-facts"><span>1 Minute per Round</span><span>10% Selling Fee</span><span>Selected Eras &amp; Sets Only</span></div><div className="auction-entry-options">
 {!vintage&&<button className="game-control auction-entry auction-entry-card" type="button" disabled={!available||preparing} onClick={()=>void enter('free')} aria-label="Enter Pewter Auction House"><img src="/images/games/pokemon-auction-house-v1.webp" alt="" width="1200" height="800"/><span><strong>Pewter Auction House · <em className="auction-entry-free">Free Entry</em></strong><small>25–90 Cards · Everyday Stock &amp; Premium Finds</small></span></button>}
 <button className="game-control auction-entry auction-entry-card is-premium" type="button" disabled={!available||preparing||cash<(vintage?20000:5000)||vintage&&!vintageUnlocked} onClick={()=>void enter('paid')} aria-label={vintage?'Enter Cinnabar Auction House · $200 Fee':'Enter Celadon Auction House · $50 Fee'}><img src="/images/games/pokemon-auction-house-v1.webp" alt="" width="1200" height="800"/><span><strong>{vintage?'Cinnabar':'Celadon'} Auction House · <em className="auction-entry-fee">${vintage?'200':'50'} Fee</em></strong><small>{vintage?`${POKEMON_VINTAGE_SIZE.min}–${POKEMON_VINTAGE_SIZE.max} Cards · Vintage Finds`:'50–130 Cards · More Premium Cards'}</small></span></button>
 <AuctionLink className="game-control auction-entry-card auction-daily-entry" href="/games/pokemon-auction/daily" aria-label="Daily Challenge"><AuctionDailyArtwork description="Five Modern & Legacy auctions · Shared daily lineup"/></AuctionLink>
 </div><p className="games-note">About Entry Fees <InfoHint label="Entry fee rules">Entry is charged only after preparation, when bidding begins. It is not refunded if you lose or leave. Winning bids and optional investigations cost extra; profit is never guaranteed. Cinnabar is a separate Vintage house with a $200 entry fee and a permanent $10,000 net-worth unlock.</InfoHint></p>{vintage&&!vintageUnlocked&&<p className="games-note">Cinnabar unlocks after your Pokémon net worth reaches $10,000.</p>}{imageError&&<p role="alert">{imageError}</p>}</section>;
}
