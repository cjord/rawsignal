import type {AuctionCatalogManifest} from '../../core/domain/auction-catalog-snapshot';
type Props={status:string;error:string|null;manifest:AuctionCatalogManifest|null;reload:()=>void;checking?:boolean};
export default function AuctionMarketStatus({status,error,manifest,reload,checking=false}:Props){
 const unavailable=status==='error'||status==='empty',waiting=status==='loading'||status==='idle',state=unavailable?'error':waiting?'loading':'ready';
 const source=manifest?`${manifest.source==='database'?'Published Catalog':'Bundled Fallback'} · ${manifest.asOf?new Date(manifest.asOf).toLocaleDateString():'Source Date Unavailable'}`:'Latest Available Section Feeds · Source Date Unavailable';
 return <div className="auction-market-status" data-state={state} aria-label="Market Snapshot Status" role="region"><p className="games-note" role="status">{waiting?'Loading Market…':unavailable?'Market data is unavailable. Your saved holdings have not changed.':`Market Snapshot · ${source}`}{checking&&!waiting?' · Checking Prices…':''}</p>{(error||unavailable)&&<p className="games-note" role="alert">{error??'Prices could not be loaded.'} <button className="game-control" type="button" onClick={reload}>{manifest?'Retry Price Check':'Retry Catalog'}</button></p>}</div>;
}
