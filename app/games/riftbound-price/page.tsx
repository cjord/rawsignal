import type {Metadata} from "next";
import RiftboundPriceGame from "../../RiftboundPriceGame";
export const metadata:Metadata={title:"Riftbound Price Showdown | Raw Signal",description:"Guess which Riftbound card has the highest TCGplayer market price."};
export default function PriceGamePage(){return <RiftboundPriceGame/>}
