"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {GamesShell} from '../GamesView';
import {useAccount} from '../account/AccountProvider';
import {CheckboxGrid} from '../filters/CheckboxGrid';
import SlidingTabs from '../SlidingTabs';
import {usePreference} from '../state/usePreference';
import {readGameScopeMetadata,readGamePracticePool} from '../data/game-practice-catalog';
import {createPriceGameImageLoader} from '../data/price-game-images';
import {unpackGameCatalog,type GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
import {gameScopeKey,type GameScope} from '../../core/domain/game-scope';
import type {GameScopeMetadata} from '../../core/domain/game-scope-metadata';
import {priceGamePool,drawPriceRound,type PriceGameDifficulty} from '../../core/domain/price-game';
import {pokemonPriceRoundRules} from '../../core/domain/pokemon-game-rarity';
import GameSession from './PriceShowdownSession';
import PokemonPoolSelector,{pokemonSelectionSummary,POKEMON_INITIAL_SCOPE} from './PokemonPoolSelector';
import {resetPracticeSave,readPracticeScope,type PracticeContext} from './usePracticeSave';

function PokemonPractice(){
 const account=useAccount();
 const [scope,setScope]=useState<GameScope>(()=>account.user?readPracticeScope('pokemon')??POKEMON_INITIAL_SCOPE:POKEMON_INITIAL_SCOPE),[metadata,setMetadata]=useState<GameScopeMetadata|null>(null),[snapshot,setSnapshot]=useState<GameCatalogSnapshot|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0),[session,setSession]=useState(0),request=useRef<AbortController|null>(null);
 const [difficulty,setDifficulty]=usePreference<PriceGameDifficulty>('raw-signal-showdown-difficulty',value=>value==='hard'?'hard':null,'normal',true),[autoMode,setAutoMode]=usePreference('raw-signal-showdown-auto-advance',value=>value==='off'?'off':null,'on',true);
 const images=useMemo(()=>createPriceGameImageLoader(),[]),pool=useMemo(()=>snapshot?priceGamePool(unpackGameCatalog(snapshot),'pokemon'):[],[snapshot]);
 const context=useMemo<PracticeContext>(()=>({market:'pokemon',scope:snapshot?.scope}),[snapshot]);
 useEffect(()=>{
  const controller=new AbortController();void readGameScopeMetadata('pokemon',controller.signal).then(data=>{if(!controller.signal.aborted){setMetadata(data);setError('')}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>{controller.abort();request.current?.abort()};
 },[attempt]);
 async function start(){
  request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{const next=await readGamePracticePool(scope,controller.signal);if(!controller.signal.aborted){const cards=priceGamePool(unpackGameCatalog(next),'pokemon');if(!drawPriceRound(cards,difficulty,[],()=>.5,pokemonPriceRoundRules).length)throw new Error('This selection cannot form a fair round. Try more sets or eras.');setSnapshot(next)}}catch(cause){if(!controller.signal.aborted)setError((cause as Error).message)}finally{if(!controller.signal.aborted)setLoading(false)}
 }
 const summary=metadata?pokemonSelectionSummary(metadata,scope):null;
 return <>
 {!snapshot&&<><PokemonPoolSelector metadata={metadata} scope={scope} onChange={setScope} loading={loading||!metadata}/><button className="game-control auction-step-next" type="button" disabled={loading||!metadata||!!summary?.unavailable.length||!summary?.count||account.loading||!!account.error} onClick={()=>void start()}>{loading&&metadata?'Checking Card Pool…':'Start Showdown'}</button>{!metadata&&!loading&&<button type="button" className="game-control" onClick={()=>{setLoading(true);setAttempt(n=>n+1)}}>Retry Card Catalog</button>}</>}
 {error&&<p role="alert">{error}</p>}
 {snapshot&&<><div className="price-game-controls pokemon-price-controls"><SlidingTabs label="Difficulty" className="price-game-difficulty market-tabs" options={[{key:'normal',label:'Normal · 2 cards'},{key:'hard',label:'Hard · 3 cards'}]} selectedKey={difficulty} onSelect={key=>setDifficulty(key as PriceGameDifficulty)}/><CheckboxGrid className="set-option-grid price-game-auto" options={[{key:'auto',label:'Auto next round (1s)'}]} selected={autoMode==='on'?['auto']:[]} onToggle={()=>setAutoMode(autoMode==='on'?'off':'on')}/><button className="game-control" type="button" onClick={()=>{if(account.user)resetPracticeSave(difficulty,context);setSession(n=>n+1)}}>Restart Game</button><button className="game-control" type="button" onClick={()=>{setScope(snapshot.scope);setSnapshot(null);setError('')}}>Change Card Pool</button></div><p className="games-note">Changing difficulty or card pool starts a fresh score. Eligible catalog printings only.</p><GameSession key={`${gameScopeKey(snapshot.scope)}:${difficulty}:${session}`} pool={pool} difficulty={difficulty} images={images} auto={autoMode==='on'} context={context} rules={pokemonPriceRoundRules} showPrinting focusOnStart/><p className="games-note">{snapshot.source==='database'?'Market snapshot':'Bundled market snapshot'} · Source date: {snapshot.asOf??'unavailable'}. TCGCSV / TCGplayer market prices in USD, frozen for this session. {account.user?'Practice progress saves to your Pokémon game profile.':'Practice scores last for this session.'}</p></>}
 </>;
}
export default function PokemonPriceGame(){
 const account=useAccount();
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Pokémon · Singles</span><h1>Pokémon Price Showdown</h1><p>Choose your eras and sets, then pick the most valuable card. Set and printing are shown; prices stay hidden until you answer.</p></header>{account.loading?<><PokemonPoolSelector metadata={null} scope={POKEMON_INITIAL_SCOPE} onChange={()=>{}} loading/><button type="button" className="game-control auction-step-next" disabled>Start Showdown</button></>:account.error?<p role="alert">Your account could not be checked. Use Retry Account before starting a game.</p>:<PokemonPractice key={account.user?.id??'guest'}/>}</GamesShell>;
}
