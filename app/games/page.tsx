import type {Metadata} from "next";
import GamesView from "../GamesView";
export const metadata:Metadata={title:"Games | Raw Signal",description:"Test your trading-card market knowledge with Raw Signal price games."};
export default function GamesPage(){return <GamesView/>}
