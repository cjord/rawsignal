"use client";
import AuctionHub from './AuctionHub';
import {useAuctionGame,useAuctionPool} from './AuctionGameContext';
import {pokemonHouse} from './pokemon-auction-presentation';
import {pokemonAuctionCategory,POKEMON_AUCTION_CATEGORIES} from '../../core/domain/pokemon-auction-houses';
import type {MouseEventHandler,ReactNode} from 'react';
import type {AuctionKind,Auction} from '../../core/domain/auction-types';
import {auctionHouseName} from '../../core/domain/auction-houses';

export default function AuctionHeader({sound,mute,disabled,autoAdvance,toggleAuto,leave,kind,category}:{sound:'on'|'muted';mute:MouseEventHandler<HTMLButtonElement>;disabled:boolean;autoAdvance:boolean;toggleAuto:MouseEventHandler<HTMLButtonElement>;leave?:ReactNode;kind?:AuctionKind;category?:Auction['category']}){
 const label=sound==='muted'?'Enable Sound':'Mute Sound';
 const game=useAuctionGame(),pool=useAuctionPool(),title=game.market==='pokemon'?(kind?pokemonHouse(kind,category??(pool?pokemonAuctionCategory(pool.scope)??undefined:undefined)):'Pokémon Auction House'):(kind?auctionHouseName(kind):'Riftbound Auction House');
 return <header className="games-heading"><span className="games-eyebrow">{game.market==='pokemon'?(category?`Pokémon · ${POKEMON_AUCTION_CATEGORIES[category].label} Auctions`:'Pokémon · Virtual Auctions'):'Riftbound · single-auction prototype'}</span><div className="auction-title-row"><h1>{title}</h1><div className="auction-header-controls"><button type="button" className="game-control auction-auto-advance" disabled={disabled} aria-pressed={autoAdvance} onClick={toggleAuto} title="Automatically start the next bidding round after a 20-second review">Auto Advance: {autoAdvance?'On':'Off'}</button><button type="button" className="game-control auction-mute" disabled={disabled} aria-pressed={sound==='muted'} aria-label={label} title={label} onClick={mute}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4 5 9H2v6h3l6 5Z"/>{sound==='muted'?<path d="m16 9 6 6m0-6-6 6"/>:<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg></button>{leave}</div></div><p>Buy clues. Lock your bid. Discover the collection—and whether your instincts paid off.</p><AuctionHub/></header>;
}
