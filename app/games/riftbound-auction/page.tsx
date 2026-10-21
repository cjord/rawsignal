import type {Metadata} from 'next';
import RiftboundAuctionHouse from '../../RiftboundAuctionHouse';
import {auctionCatalogFeature} from '../../data/auction-features';
export const metadata:Metadata={title:'Riftbound Auction House | Raw Signal',description:'Bid on mystery Riftbound card collections, buy clues and build a virtual inventory.'};
export default async function AuctionPage(){return <RiftboundAuctionHouse catalogCache={await auctionCatalogFeature()}/>}
