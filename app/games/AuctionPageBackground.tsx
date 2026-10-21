"use client";
import art from '../data/auction-backdrop.json';
import AuctionBackdrop from './AuctionBackdrop';
import {memo} from 'react';
import {useAccount} from '../account/context';
import type {AuctionBackdropCard} from './auction-shell-context';
function AuctionPageBackground({cards}:{cards?:AuctionBackdropCard[]}){const account=useAccount();return account.loading||account.error?null:<div className="auction-page-art" aria-hidden="true"><AuctionBackdrop catalog={cards?.length?cards:art.cards} lobby fill={Boolean(cards?.length)}/></div>}
export default memo(AuctionPageBackground);
