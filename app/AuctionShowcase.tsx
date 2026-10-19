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
import AuctionShowcaseEditor from './games/AuctionShowcaseEditor';
import AuctionShowcaseShare from './games/AuctionShowcaseShare';
import AuctionCardInspection from './games/AuctionCardInspection';
import AuctionShowcaseGallery from './games/AuctionShowcaseGallery';
import AuctionShowcaseControls from './games/AuctionShowcaseControls';
import AuctionPublicSettings from './games/AuctionPublicSettings';
import AuctionProfileSkeleton from './games/AuctionProfileSkeleton';
import {useAccount} from './account/context';

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
function ShowcasePending({error}:{error:string|null}){return error?<p role="alert">{error} Return to Auction House to review your saved game. Nothing has been overwritten.</p>:<AuctionProfileSkeleton/>;}
function ShowcaseBody({shared,save,error,editing,status,catalog,cards,transact,toggle,share,inspect}:{shared:AuctionProfileShare|null|undefined;save:ReturnType<typeof useAuctionSave>['save'];error:string|null;editing:boolean;status:string;catalog:AuctionCard[];cards:Parameters<typeof AuctionShowcaseGallery>[0]['cards'];transact:ReturnType<typeof useAuctionSave>['transact'];toggle:()=>void;share:(snapshot:AuctionProfileShare)=>void;inspect:(card:AuctionCard)=>void}){
 const account=useAccount(),canEdit=!shared&&!save?.auction;
 return <>   {!shared&&save&&<AuctionShowcaseControls save={save} error={error} editing={editing} loaded={status==='success'&&(!account.user||Boolean(account.user.publicUsername))} toggle={toggle} share={()=>share({...auctionProfileSnapshot(save,catalog),...(account.user?{name:account.user.publicUsername??''}:{})})}/>}
   {!shared&&account.user&&!account.user.publicUsername&&<p className="games-note">Choose a <a href="/account#account-name">public username in Profile</a> before sharing.</p>}
   <AuctionStatistics shared={Boolean(shared)} save={shared?{...initialAuctionSave(),statistics:shared.stats}:save!}/>
   {editing&&canEdit&&save?<>{!account.user&&<section className="detail-section"><label className="auction-profile-name">Snapshot Display Name (optional)<input maxLength={40} value={save.profileName??''} onChange={event=>{const name=event.target.value;transact(current=>({...current,profileName:name}))}}/></label><p className="games-note">Used in frozen snapshot links. Account showcase visibility and its public display name are controlled in Profile and visibility settings.</p></section>}<AuctionShowcaseEditor save={save} catalog={catalog} transact={transact}/></>:<AuctionShowcaseGallery cards={cards} shared={Boolean(shared)} inspect={inspect}/>}
   {!shared&&<details className="auction-sharing-settings"><summary>Sharing &amp; Visibility</summary><AuctionPublicSettings/></details>}
</>;
}

export default function AuctionShowcase(){
 const account=useAccount();
 const {items,status,reload}=useCatalogPage({enabled:!account.loading,sources,parse:parseCards,keyOf:holdingKey}),catalog=useMemo(()=>auctionCatalog(items),[items]);
 const {save,error,transact}=useAuctionSave(),[shared,setShared]=useState<AuctionProfileShare|null|undefined>(undefined),[invalid,setInvalid]=useState(false),[editing,setEditing]=useState(false),[sharing,setSharing]=useState<AuctionProfileShare|null>(null),[inspect,setInspect]=useState<AuctionCard|null>(null);
 useEffect(()=>{const read=()=>{try{setShared(window.location.hash?decodeProfileSnapshot(window.location.hash.slice(1)):null);setInvalid(false)}catch{setInvalid(true);setShared(null)}};read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read)},[]);
 const snapshot=shared??(save?auctionProfileSnapshot(save,catalog):null),metadata=new Map(catalog.map(card=>[holdingKey(card),card]));
 const cards=snapshot?.cards.map(([productId,printing,name,set,rarity,section,cents])=>({productId,printing,name,set,rarity,section,cents,image:metadata.get(`${productId}:${printing}`)?.image??''}))??[];
 const ready=!account.loading&&shared!==undefined&&Boolean(snapshot)&&!invalid&&["success","empty","error"].includes(status);
 return <GamesShell auction><div className="auction-showcase-scene"><a className="games-back" href="/games/riftbound-auction">← Auction House</a><header className="games-heading"><span className="games-eyebrow">Riftbound Auction House</span><h1>{shared?.name?`${shared.name}’s Showcase`:'Auction Showcase'}</h1><p>{shared?`Shared snapshot · ${new Date(shared.at).toLocaleString()} · Self-reported virtual cards and statistics.`:'Your auction record and a hand-picked display of cards you own. Showcase cards stay protected from inventory sales.'}</p></header>
  {invalid?<p role="alert">This showcase link is invalid or too large. Your saved game has not been changed.</p>:!ready?<ShowcasePending error={error}/>:<>
   <ShowcaseBody shared={shared} save={save} error={error} editing={editing} status={status} catalog={catalog} cards={cards} transact={transact} toggle={()=>setEditing(value=>!value)} share={setSharing} inspect={setInspect}/>
  </>}{status==='error'&&<p role="status">Current catalog unavailable. Card artwork and current prices may be unavailable. <button className="game-control" type="button" onClick={reload}>Retry Catalog</button></p>}{sharing&&<AuctionShowcaseShare snapshot={sharing} close={()=>setSharing(null)}/>} {inspect&&<AuctionCardInspection card={inspect} close={()=>setInspect(null)}/>}
 </div></GamesShell>;
}
