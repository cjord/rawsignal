import type {Metadata} from 'next';
import AuctionInventory from '../../../AuctionInventory';
import {auctionCatalogFeature} from '../../../data/auction-features';
export const metadata:Metadata={title:'Auction Inventory | Raw Signal',robots:{index:false,follow:false}};
export default async function InventoryPage(){return <AuctionInventory catalogCache={await auctionCatalogFeature()}/>}
