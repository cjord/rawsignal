"use client";
import {GamesShell} from '../GamesView';
import {AuctionHouseSession} from '../RiftboundAuctionHouse';
import PokemonPoolSelector,{pokemonSelectionSummary} from './PokemonPoolSelector';
import {useAccount} from '../account/context';
import {useAuctionSave} from './useAuctionSave';
import {usePokemonAuctionSetup} from './usePokemonAuctionSetup';
import {AuctionPoolContext} from './AuctionGameContext';
import SlidingTabs from '../SlidingTabs';
import {POKEMON_AUCTION_CATEGORIES,pokemonAuctionCategory,type PokemonAuctionCategory} from '../../core/domain/pokemon-auction-houses';

type Session=ReturnType<typeof useAuctionSave>;
function PokemonAuctionIntro(){return <header className="games-heading"><span className="games-eyebrow">Pokémon · Virtual Auctions</span><h1>Pokémon Auction House</h1><p>Choose your eras and sets, investigate a mystery collection, then bid against three collectors. Pokémon cash and cards stay separate from Riftbound.</p></header>}
function PokemonAuctionSetup({session,setup}:{session:Session;setup:ReturnType<typeof usePokemonAuctionSetup>}){
 const {save}=session,{scope,metadata,loading,pending,error}=setup,category=pokemonAuctionCategory(scope)??'modern';
 const summary=metadata?pokemonSelectionSummary(metadata,scope):null;
 const locked=category==='vintage'&&!save?.vintageUnlocked&&(save?.wallet.cash??0)<1000000;
 const disabled=locked||loading||!save||!metadata||Boolean(summary?.unavailable.length)||(summary?.count??0)<25;
 const selectCategory=(key:string)=>{if(!pending)setup.setScope({market:'pokemon',eras:[...POKEMON_AUCTION_CATEGORIES[key as PokemonAuctionCategory].eras],sets:[]})};
 return <GamesShell auction><a className="games-back" href="/games">← Games</a><PokemonAuctionIntro/>
  <SlidingTabs label="Auction Era Category" className="market-tabs" options={Object.entries(POKEMON_AUCTION_CATEGORIES).map(([key,value])=>({key,label:value.label}))} selectedKey={category} onSelect={selectCategory}/>
  <PokemonPoolSelector allowedEras={POKEMON_AUCTION_CATEGORIES[category].eras} metadata={metadata} scope={scope} onChange={setup.setScope} loading={!metadata||loading||pending}/>
  {pending?<p role="status">Restoring Your Auction…</p>:<button type="button" className="game-control auction-step-next" disabled={disabled} onClick={()=>void setup.start()}>{loading?'Preparing Card Pool…':'Use This Card Pool'}</button>}
  {locked&&<p className="games-note">Cinnabar Auction House · $200 Entry · Unlocks at $10,000 Pokémon Net Worth. View Inventory to refresh the value of cards from other pools.</p>}
  {(error||session.error)&&<p role="alert">{error||session.error} <button type="button" className="game-control" onClick={setup.retry}>Retry</button></p>}
 </GamesShell>;
}
function PokemonAuctionSession(){
 const session=useAuctionSave();
 if(!session.save)return <GamesShell auction><PokemonAuctionIntro/><p role="status">Loading Your Pokémon Auction Profile…</p>{session.error&&<p role="alert">{session.error}</p>}</GamesShell>;
 return <PokemonAuctionLoaded session={session} save={session.save}/>;
}
function PokemonAuctionLoaded({session,save:loaded}:{session:Session;save:NonNullable<Session['save']>}){
 const setup=usePokemonAuctionSetup(loaded);
 const changePool=()=>{
  const save=session.save;if(!save||save.auction)return;
  if(Object.keys(save.drafts??{}).length&&!window.confirm('Abandon this prepared auction and choose a new pool? No entry fee has been charged.'))return;
  if(session.transact(current=>({...current,drafts:{}})))setup.clear();
 };
 if(!setup.snapshot)return <PokemonAuctionSetup session={session} setup={setup}/>;
 const snapshot=setup.snapshot,category=pokemonAuctionCategory(snapshot.scope)??'modern';
 return <AuctionPoolContext.Provider value={snapshot}><AuctionHouseSession session={session} poolControls={<div className="auction-actions"><span>{POKEMON_AUCTION_CATEGORIES[category].label} · {snapshot.count.toLocaleString()} Eligible Cards</span><button type="button" className="game-control" onClick={changePool}>Change Card Pool</button></div>}/></AuctionPoolContext.Provider>;
}
export default function PokemonAuctionHouse(){
 const account=useAccount();
 if(account.loading||account.error)return <GamesShell auction><PokemonAuctionIntro/><p role={account.error?'alert':'status'}>{account.error?'Your account could not be checked. Use Retry Account before playing.':'Loading Your Pokémon Auction Profile…'}</p></GamesShell>;
 return <PokemonAuctionSession key={account.user?.id??'guest'}/>;
}
