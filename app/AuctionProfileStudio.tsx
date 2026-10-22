"use client";
import {useEffect,useMemo,useState} from 'react';
import {GamesShell} from './GamesView';
import {useAccount} from './account/context';
import {useAuctionCatalog} from './data/useAuctionCatalog';
import {useAuctionSave} from './games/useAuctionSave';
import {useAuctionAppearance} from './games/useAuctionAppearance';
import {useAuctionShell} from './games/auction-shell-context';
import {appearanceArtwork,AUCTION_BACKDROP_LIMIT,type AuctionAppearance} from '../core/domain/auction-appearance';
import {auctionCatalog} from '../core/domain/auction-market';
import {auctionProfileSnapshot} from '../core/domain/auction-profile-share';
import {holdingKey,type AuctionCard} from '../core/domain/auction-types';
import type {Card} from '../core/domain/types';
import AuctionHub from './games/AuctionHub';
import AuctionLink from './games/AuctionLink';
import AuctionBackdropOverride from './games/AuctionBackdropOverride';
import AuctionStatistics from './games/AuctionStatistics';
import AuctionShowcaseGallery from './games/AuctionShowcaseGallery';
import AuctionCardInspection from './games/AuctionCardInspection';
import AuctionPublicSettings from './games/AuctionPublicSettings';
import AuctionProfileSkeleton from './games/AuctionProfileSkeleton';
import AuctionMarketStatus from './games/AuctionMarketStatus';
import DeferredImage from './DeferredImage';
import AuctionPagination from './games/AuctionPagination';

function AppearanceEditor({initial,cards,onSave,cancel}:{initial:AuctionAppearance;cards:Card[];onSave:(value:AuctionAppearance)=>boolean;cancel:()=>void}){
 const [draft,setDraft]=useState(initial),[search,setSearch]=useState(''),[page,setPage]=useState(0),{addGuard}=useAuctionShell();
 const dirty=JSON.stringify(draft)!==JSON.stringify(initial),art=useMemo(()=>appearanceArtwork(draft,cards),[draft,cards]);
 useEffect(()=>{if(!dirty)return;const remove=addGuard(()=>window.confirm('Discard unsaved Profile Card Backdrop changes?'));const leave=(event:BeforeUnloadEvent)=>{event.preventDefault()};window.addEventListener('beforeunload',leave);return()=>{remove();window.removeEventListener('beforeunload',leave)}},[dirty,addGuard]);
 const candidates=cards.filter(card=>card.game==='riftbound'&&/^https?:\/\//.test(card.image)&&`${card.name} ${card.set} ${card.rarity}`.toLowerCase().includes(search.toLowerCase())),pages=Math.max(1,Math.ceil(candidates.length/24)),current=Math.min(page,pages-1),keys=new Set(draft.cards.map(holdingKey));
 const toggle=(card:Card)=>setDraft(value=>({...value,cards:keys.has(holdingKey(card))?value.cards.filter(row=>holdingKey(row)!==holdingKey(card)):[...value.cards,{productId:card.productId,printing:card.printing}]}));
 return <><AuctionBackdropOverride cards={art}/><section className="detail-section auction-profile-editor"><h2>Edit Profile Card Backdrop</h2><p className="games-note">Choose up to {AUCTION_BACKDROP_LIMIT} Riftbound catalog cards as decorative artwork. You do not need to own them. This does not add cards to your showcase. Save to sync with your signed-in account; Cancel discards this preview. Saved artwork also updates an already-public showcase. Saving never enables public visibility.</p><div className="auction-actions"><button className="game-control game-control-primary" type="button" onClick={()=>onSave(draft)}>Save Profile Appearance</button><button className="game-control" type="button" onClick={cancel}>Cancel Changes</button><button className="game-control" type="button" onClick={()=>setDraft({version:1,cards:[]})}>Use Default Backdrop</button></div><p role="status">{draft.cards.length} / {AUCTION_BACKDROP_LIMIT} Selected · {dirty?'Unsaved Preview':'Saved Appearance'}</p><label className="auction-profile-search">Find Backdrop Cards<input type="search" value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}} placeholder="Name, set or rarity"/></label><div className="auction-backdrop-picker">{candidates.slice(current*24,(current+1)*24).map(card=><button className="auction-backdrop-choice" type="button" key={holdingKey(card)} aria-pressed={keys.has(holdingKey(card))} disabled={!keys.has(holdingKey(card))&&draft.cards.length>=AUCTION_BACKDROP_LIMIT} onClick={()=>toggle(card)}><DeferredImage src={card.image} alt=""/><span><b>{card.name}</b><small>{card.printing} · {card.rarity}</small></span></button>)}</div>{!candidates.length&&<p>No available artwork matches your search.</p>}<AuctionPagination label="Backdrop Pages" page={current+1} pages={pages} previous={()=>setPage(current-1)} next={()=>setPage(current+1)} canPrevious={current>0} canNext={current+1<pages} previousLabel="Previous Backdrop Page" nextLabel="Next Backdrop Page"/></section></>;
}
export default function AuctionProfileStudio({catalogCache=false}:{catalogCache?:boolean}){
 const account=useAccount(),market=useAuctionCatalog(!account.loading&&!account.error,catalogCache),{save,error}=useAuctionSave(),appearance=useAuctionAppearance(),[editing,setEditing]=useState(false),[message,setMessage]=useState(''),[inspect,setInspect]=useState<AuctionCard|null>(null);
 const catalog=useMemo(()=>auctionCatalog(market.items),[market.items]),art=useMemo(()=>appearanceArtwork(appearance.appearance,market.items),[appearance.appearance,market.items]);
 const snapshot=save?auctionProfileSnapshot(save,catalog):null,metadata=new Map(catalog.map(card=>[holdingKey(card),card])),cards=snapshot?.cards.map(([productId,printing,name,set,rarity,section,cents])=>({productId,printing,name,set,rarity,section,cents,image:metadata.get(`${productId}:${printing}`)?.image??''}))??[];
 const ready=!account.loading&&!account.error&&Boolean(save)&&appearance.ready&&market.status!=='loading'&&market.status!=='idle';
 return <GamesShell auction><header className="games-heading"><span className="games-eyebrow">Riftbound Auction House</span><h1>{account.user?.publicUsername?`${account.user.publicUsername}’s Profile Preview`:'Auction Profile Preview'}</h1><p>Private owner preview. Viewing does not publish anything. Saved changes update your public profile only if its visibility is already enabled. Cash and sellable inventory stay private.</p></header><AuctionHub/><AuctionMarketStatus {...market}/>{error&&<p role="alert">{error}</p>}{appearance.error&&<p role="alert">{appearance.error}</p>}{!ready?<AuctionProfileSkeleton controls/>:<><div className="auction-actions"><button type="button" className="game-control game-control-primary" disabled={editing||Boolean(appearance.error)} onClick={()=>{setEditing(true);setMessage('')}}>Edit Profile Appearance</button><AuctionLink className="game-control game-control-secondary" href="/games/riftbound-auction/showcase">Edit Showcase Cards</AuctionLink><AuctionLink className="game-control" href="/account#account-name">{account.user?.publicUsername?'Change Public Username':'Set Public Username'}</AuctionLink></div><p className="games-note">{account.user?'Your public name comes from your account Profile. Visibility is controlled separately below.':'Guest preview stays in this browser. Sign in to use account-linked publishing; guest progress does not transfer.'}</p><p role="status">{message}</p>{editing?<AppearanceEditor initial={appearance.appearance} cards={market.items} cancel={()=>setEditing(false)} onSave={value=>{const saved=appearance.save(value);if(saved){setEditing(false);setMessage('Profile appearance saved. Visibility settings were not changed.')}return saved}}/>:<AuctionBackdropOverride cards={art}/>}<AuctionStatistics save={save!}/><AuctionShowcaseGallery cards={cards} shared={false} inspect={setInspect}/><details className="auction-sharing-settings"><summary>Public Profile &amp; Visibility</summary><AuctionPublicSettings/></details></>}{inspect&&<AuctionCardInspection card={inspect} close={()=>setInspect(null)}/>}</GamesShell>;
}
