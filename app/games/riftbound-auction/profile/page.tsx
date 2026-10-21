import type {Metadata} from 'next';
import AuctionProfileStudio from '../../../AuctionProfileStudio';
import {auctionCatalogFeature} from '../../../data/auction-features';
export const metadata:Metadata={title:'Auction Profile Preview | Raw Signal',robots:{index:false,follow:false}};
export default async function ProfilePage(){return <AuctionProfileStudio catalogCache={await auctionCatalogFeature()}/>}
