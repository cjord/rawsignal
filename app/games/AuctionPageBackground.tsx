"use client";
import art from '../data/auction-backdrop.json';
import pokemonArt from '../data/pokemon-auction-backdrop.json';
import {useAuctionGame} from './AuctionGameContext';
import AuctionBackdrop from './AuctionBackdrop';
import {memo} from 'react';
import {useAccount} from '../account/context';
import type {AuctionBackdropCard} from './auction-shell-context';
function AuctionPageBackground({cards}:{cards?:AuctionBackdropCard[]}){const account=useAccount(),game=useAuctionGame();return account.loading||account.error?null:<div className="auction-page-art" aria-hidden="true"><AuctionBackdrop catalog={cards?.length?cards:game.market==='pokemon'?pokemonArt.cards:art.cards} lobby fill={Boolean(cards?.length)}/></div>}
export default memo(AuctionPageBackground);
