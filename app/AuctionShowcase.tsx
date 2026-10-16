"use client";
import {useEffect,useMemo,useState} from 'react';
import {GamesShell} from './GamesView';
import {useCatalogPage} from './data/useCatalogPage';
import {useAuctionSave} from './games/useAuctionSave';
import {allowedRarities} from '../core/market-state';
import {parseCards} from '../core/domain/contracts';
import {auctionCatalog} from '../core/domain/auction-market';
import {holdingKey,initialAuctionSave,type AuctionCard} from '../core/domain/auction-types';
import {auctionProfileSnapshot,decodeProfileSnapshot,type AuctionProfileShare} from '../core/domain/auction-profile-share';
import AuctionStatistics from './games/AuctionStatistics';
import AuctionBackdrop from './games/AuctionBackdrop';
import AuctionShowcaseEditor from './games/AuctionShowcaseEditor';
import AuctionShowcaseShare from './games/AuctionShowcaseShare';
import AuctionDialog from './games/AuctionDialog';
import DeferredImage from './DeferredImage';
import {auctionRarity} from '../core/domain/auction-display';
import AuctionShowcaseGallery from './games/AuctionShowcaseGallery';
import AuctionShowcaseControls from './games/AuctionShowcaseControls';
import {auctionUsd} from './games/AuctionWallet';

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
function ShowcasePending({error}:{error:string|null}){return error?<p role="alert">{error} Return to Auction House to review your saved game. Nothing has been overwritten.</p>:<p role="status">Loading Showcase…</p>;}
export default function AuctionShowcase(){
 const {items,status}=useCatalogPage({sources,parse:parseCards,keyOf:holdingKey}),catalog=useMemo(()=>auctionCatalog(items),[items]);
 const {save,error,transact}=useAuctionSave(),[shared,setShared]=useState<AuctionProfileShare|null|undefined>(undefined),[invalid,setInvalid]=useState(false),[editing,setEditing]=useState(false),[sharing,setSharing]=useState<AuctionProfileShare|null>(null),[inspect,setInspect]=useState<AuctionCard|null>(null);
 useEffect(()=>{const read=()=>{try{setShared(window.location.hash?decodeProfileSnapshot(window.location.hash.slice(1)):null);setInvalid(false)}catch{setInvalid(true);setShared(null)}};read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read)},[]);
 const snapshot=shared??(save?auctionProfileSnapshot(save,catalog):null),metadata=new Map(catalog.map(card=>[holdingKey(card),card]));
 const cards=snapshot?.cards.map(([productId,printing,name,set,rarity,section,cents])=>({productId,printing,name,set,rarity,section,cents,image:metadata.get(`${productId}:${printing}`)?.image??''}))??[];
 const canEdit=!shared&&!save?.auction,ready=shared!==undefined&&Boolean(snapshot)&&!invalid;
 return <GamesShell><div className="auction-showcase-scene"><AuctionBackdrop catalog={catalog} lobby/><a className="games-back" href="/games/riftbound-auction">← Auction House</a><header className="games-heading"><span className="games-eyebrow">Riftbound Auction House</span><h1>{snapshot?.name?`${snapshot.name}’s Showcase`:'Auction Showcase'}</h1><p>{shared?`Shared snapshot · ${new Date(shared.at).toLocaleString()} · Self-reported virtual cards and statistics.`:'Your auction record and a hand-picked display of cards you own. Showcase cards stay protected from inventory sales.'}</p></header>
  {invalid?<p role="alert">This showcase link is invalid or too large. Your saved game has not been changed.</p>:!ready?<ShowcasePending error={error}/>:<>
   {!shared&&save&&<AuctionShowcaseControls save={save} error={error} editing={editing} loaded={status==='success'} toggle={()=>setEditing(value=>!value)} share={()=>setSharing(auctionProfileSnapshot(save,catalog))}/>}
   <AuctionStatistics shared={Boolean(shared)} save={shared?{...initialAuctionSave(),statistics:shared.stats}:save!}/>
   {editing&&canEdit&&save?<><section className="detail-section"><label className="auction-profile-name">Display Name (optional)<input maxLength={40} value={save.profileName??''} onChange={event=>{const name=event.target.value;transact(current=>({...current,profileName:name}))}}/></label><p className="games-note">Public only when you share a snapshot. No accounts or verified identities yet.</p></section><AuctionShowcaseEditor save={save} catalog={catalog} transact={transact}/></>:<AuctionShowcaseGallery cards={cards} shared={Boolean(shared)} inspect={setInspect}/>}
  </>}{status==='error'&&<p role="status">Current catalog unavailable. Card artwork and current prices may be unavailable.</p>}{sharing&&<AuctionShowcaseShare snapshot={sharing} close={()=>setSharing(null)}/>} {inspect&&<AuctionDialog title={inspect.name} onClose={()=>setInspect(null)} dismissOnOutside><div className="auction-inspection" data-rarity={auctionRarity(inspect)}><DeferredImage src={inspect.image} alt={inspect.name}/><p>{inspect.printing} · {inspect.set}</p><strong>{inspect.cents?auctionUsd(inspect.cents):'Price Unavailable'}</strong></div></AuctionDialog>}
 </div></GamesShell>;
}
