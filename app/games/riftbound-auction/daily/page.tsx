import type {Metadata} from 'next';
import RiftboundAuctionHouse from '../../../RiftboundAuctionHouse';
export const metadata:Metadata={title:'Daily Auction Challenge | Raw Signal'};
export default function DailyAuctionPage(){return <RiftboundAuctionHouse dailyMode/>}
