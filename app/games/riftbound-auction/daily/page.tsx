import type {Metadata} from 'next';
import RiftboundAuctionHouse from '../../../RiftboundAuctionHouse';
import {auctionCatalogFeature} from '../../../data/auction-features';
export const metadata:Metadata={title:'Daily Auction Challenge | Raw Signal'};
export default async function DailyAuctionPage(){return <RiftboundAuctionHouse dailyMode catalogCache={await auctionCatalogFeature()}/>}
