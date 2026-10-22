"use client";
import {useEffect,useState} from 'react';
import AuctionHub from './games/AuctionHub';
import AuctionLink from './games/AuctionLink';
import AuctionBackdropOverride from './games/AuctionBackdropOverride';
import AuctionPagination from './games/AuctionPagination';
import {useAuctionShell} from './games/auction-shell-context';
import MarketTabs from './MarketTabs';
import {GamesShell} from './GamesView';
import {auctionUsd} from './games/AuctionWallet';
import {publicProfilePath,type AuctionCommunityPage,type AuctionCommunityRow,type PublicAuctionProfile} from '../core/domain/auction-community';
import {initialAuctionSave,type AuctionCard} from '../core/domain/auction-types';
import AuctionStatistics from './games/AuctionStatistics';
import AuctionShowcaseGallery from './games/AuctionShowcaseGallery';
import AuctionProfileSkeleton from './games/AuctionProfileSkeleton';
import AuctionCardInspection from './games/AuctionCardInspection';
import {useAccount} from './account/context';
import AuctionMarketStatus from './games/AuctionMarketStatus';

type Mode='leaderboard'|'showcases'|'profile';
type Props={mode:Mode;id?:string};
const communityTitle={leaderboard:'Auction Leaderboard',showcases:'Public Showcases',profile:'Auction Profile'};
const defaultBackdrop:NonNullable<PublicAuctionProfile['backdrop']>=[];
const communityOptions=[{key:'leaderboard',label:'Leaderboard'},{key:'showcases',label:'Public Showcases'}];

function CommunitySelector({mode}:{mode:Mode}){
 const shell=useAuctionShell();
 const navigate=(view:string)=>{if(view===mode)return;const href='/games/riftbound-auction/'+view;if(!shell.allowNavigation())return;if(shell.active)shell.navigate(href);else location.assign(href)};
 return <div className="auction-community-selector"><MarketTabs options={communityOptions} value={mode} onChange={navigate} label="Auction Community"/></div>;
}
function CommunityRow({row,rank,showcases}:{row:AuctionCommunityRow;rank:number;showcases:boolean}){
 return <tr><td>{rank}</td><th scope="row"><AuctionLink href={publicProfilePath(row.id)}>{row.displayName}</AuctionLink>{!row.showcasePublic&&<small>Cards Private</small>}</th>{showcases?<><td>{row.showcaseValue==null?'N/A':auctionUsd(row.showcaseValue)}{!!row.unpriced&&<small>{row.unpriced} Unpriced · {auctionUsd(row.knownValue??0)} Known</small>}</td><td>{row.cardCount??'—'}</td></>:<><td data-tone={row.profit<0?'loss':'gain'}>{auctionUsd(row.profit)}</td><td>{row.settled}</td><td>{row.settled?`${(100*row.won/row.settled).toFixed(1)}%`:'—'}</td></>}</tr>;
}
function CommunityTable({page,mode}:{page:AuctionCommunityPage;mode:Mode}){
 return <div className="game-result-table"><table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th>{mode==='showcases'?<><th scope="col">Showcase Value</th><th scope="col">Cards</th></>:<><th scope="col">Net Auction P/L</th><th scope="col">Settled</th><th scope="col">Win Rate</th></>}</tr></thead><tbody>{page.rows.map((row,index)=><CommunityRow key={row.id} row={row} rank={page.offset+index+1} showcases={mode==='showcases'}/>)}</tbody></table></div>;
}
function PublicProfile({profile,inspect}:{profile:PublicAuctionProfile;inspect:(card:AuctionCard)=>void}){
 return <><AuctionStatistics shared live save={{...initialAuctionSave(),statistics:profile.stats}}/>{profile.showcasePublic?<AuctionShowcaseGallery cards={profile.cards} shared live inspect={inspect}/>:<section className="detail-section"><p>This player’s cards are private. Only their opted-in leaderboard statistics are public.</p></section>}<p className="games-note">Account save updated {new Date(profile.updatedAt).toLocaleString()}. {profile.priceSource?`Catalog source: ${new Date(profile.priceSource).toLocaleDateString()}.`:'Catalog prices unavailable.'} Only exact available printings receive a current price.</p></>;
}

function CommunityView({mode,id}:Props){
 const account=useAccount();
 const [data,setData]=useState<AuctionCommunityPage|PublicAuctionProfile|null>(null),[error,setError]=useState(''),[cursor,setCursor]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[inspect,setInspect]=useState<AuctionCard|null>(null);
 useEffect(()=>{
  if(account.loading)return;
  const controller=new AbortController();let current=true;
  const query=new URLSearchParams({view:mode});if(cursor)query.set('cursor',cursor);
  const path=mode==='profile'?`/${encodeURIComponent(id??'')}`:`?${query}`;
  void fetch('/api/games/auction-community'+path,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error(response.status===404?'This profile is private or unavailable.':'Auction community data is unavailable in this environment.');
   const value=await response.json();if(current){setData(value);setError('')}
  }).catch(cause=>{if(current){setData(null);setInspect(null);setError(cause instanceof Error?cause.message:'Could not load community data.')}}).finally(()=>{if(current)setLoading(false)});
  return()=>{current=false;controller.abort()};
 },[mode,id,cursor,refresh,account.loading]);
 const profile=mode==='profile'?data as PublicAuctionProfile|null:null,page=mode!=='profile'?data as AuctionCommunityPage|null:null;
 const reload=()=>{setLoading(true);setRefresh(value=>value+1)};
 const back=()=>{if(!previous.length)return;setLoading(true);setCursor(previous.at(-1)??null);setPrevious(values=>values.slice(0,-1))};
 const next=()=>{if(!page?.nextCursor)return;setLoading(true);setPrevious(values=>[...values,cursor]);setCursor(page.nextCursor)};
 const content=loading?<AuctionProfileSkeleton/>:error?<p role="alert">{error}</p>:profile?<PublicProfile profile={profile} inspect={setInspect}/>:page?<><CommunityTable page={page} mode={mode}/>{!page.rows.length&&<p>No public {mode==='leaderboard'?'leaderboard entries':'showcases'} yet. You can opt in from My Showcase.</p>}<AuctionPagination label="Community Pages" page={previous.length+1} previous={back} next={next} canPrevious={previous.length>0} canNext={Boolean(page.nextCursor)}/></>:null;
 return <GamesShell auction>
  <AuctionBackdropOverride cards={profile?.backdrop??defaultBackdrop}/>
  <AuctionLink className="games-back" href="/games/riftbound-auction">← Auction House</AuctionLink>
  <header className="games-heading"><span className="games-eyebrow">Riftbound · Community</span><h1>{profile?`${profile.displayName}’s Auction Profile`:communityTitle[mode]}</h1><p>Account-linked, browser-reported virtual cards and statistics. Unverified results—no prizes, real-money value or competitive verification.</p></header>
  <AuctionHub/><CommunitySelector mode={mode}/>
  <section className="detail-section auction-community-directory" aria-label={communityTitle[mode]}>
   <header className="auction-community-header"><h2>{communityTitle[mode]}</h2><button className="game-control" type="button" disabled={loading} onClick={reload}>Refresh</button></header>
   {mode!=='profile'&&<p className="games-note">{mode==='leaderboard'?'Lifetime net auction P/L, highest first; ties use settled auctions then profile ID. At least one settled normal auction is required. Resets update this board; daily-challenge results are not included.':'Ranked by current showcase market value, highest first. Incomplete valuations appear last as N/A; duplicate cards count separately. Public viewing and leaderboard participation are separate choices.'} Pages are a live view; scores can change between pages.</p>}
   <div className="auction-community-body" aria-busy={loading}>{content}</div>
  </section>
  {mode!=='profile'&&<AuctionMarketStatus status={loading?'loading':page?.marketSnapshot?'success':'error'} error={null} manifest={page?.marketSnapshot??null} reload={reload} unavailableMessage="Market snapshot is unavailable." retryLabel="Retry Snapshot"/>}
  {inspect&&<AuctionCardInspection card={inspect} close={()=>setInspect(null)}/>}
 </GamesShell>;
}

// Route mode/profile changes must not reuse another directory's cursor/results.
export default function AuctionCommunity(props:Props){return <CommunityView key={`${props.mode}:${props.id??''}`} {...props}/>}
