"use client";
import AuctionLink from './AuctionLink';
import {useAuctionShell} from './auction-shell-context';
const base='/games/riftbound-auction';
const icons={Play:'m9 5 11 7-11 7Z',Inventory:'M3 7h18v14H3ZM3 7l3-4h12l3 4M9 11h6','My Showcase':'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',Community:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8',Guide:'M4 3h7v18H4ZM11 3h9v18h-9M7 7h1M14 7h3M14 11h3'};
function Icon({name}:{name:keyof typeof icons}){return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]}/></svg>}
function ConnectedHub(){
 const {path}=useAuctionShell(),playing=path===base||path===base+'/daily';
 const links=[['Play',base,playing],['Inventory',base+'/inventory',path===base+'/inventory'],['My Showcase',base+'/showcase',path===base+'/showcase'||path===base+'/profile'],['Community',base+'/leaderboard',/\/(leaderboard|showcases|players)(\/|$)/.test(path)]] as const;
 return <div className="auction-hub"><nav aria-label="Auction Hub" className="auction-hub-tabs">{links.map(([name,href,active])=><AuctionLink key={name} className="game-control" href={href} aria-current={active?'page':undefined}><Icon name={name}/>{name}</AuctionLink>)}<AuctionLink className="game-control auction-hub-guide" href={base+'/guide'} aria-label="Auction Guide" aria-current={path===base+'/guide'?'page':undefined}><Icon name="Guide"/>Guide</AuctionLink></nav></div>;
}
export default function AuctionHub(){return useAuctionShell().active?<ConnectedHub/>:null}
