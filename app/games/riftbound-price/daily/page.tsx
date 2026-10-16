import type {Metadata} from 'next';
import DailyPriceShowdown from '../../DailyPriceShowdown';
export const metadata:Metadata={title:'Daily Riftbound Price Showdown | Raw Signal',description:'Ten daily price comparisons. Normal and Hard modes, with shareable results.'};
export default function DailyShowdownPage(){return <DailyPriceShowdown/>}
