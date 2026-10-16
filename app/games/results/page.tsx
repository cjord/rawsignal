import type {Metadata} from 'next';
import GameResults from '../GameResults';
export const metadata:Metadata={title:'Daily Challenge Results | Raw Signal',description:'View shared Riftbound daily challenge results. Self-reported, with optional card and price spoilers.',robots:{index:false,follow:false}};
export default function ResultsPage(){return <GameResults/>}
