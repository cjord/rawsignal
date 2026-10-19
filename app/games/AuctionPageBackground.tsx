"use client";
import art from '../data/auction-backdrop.json';
import AuctionBackdrop from './AuctionBackdrop';
import {memo} from 'react';
import {useAccount} from '../account/context';
function AuctionPageBackground(){const account=useAccount();return account.loading||account.error?null:<div className="auction-page-art" aria-hidden="true"><AuctionBackdrop catalog={art.cards} lobby/></div>}
export default memo(AuctionPageBackground);
