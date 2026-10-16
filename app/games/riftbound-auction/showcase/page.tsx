import type {Metadata} from 'next';
import AuctionShowcase from '../../../AuctionShowcase';
export const metadata:Metadata={title:'Auction Showcase | Raw Signal',description:'Your Riftbound auction statistics and hand-picked virtual card showcase.',robots:{index:false,follow:false}};
export default function ShowcasePage(){return <AuctionShowcase/>}
