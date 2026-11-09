"use client";
import {CheckboxGrid,SearchableCheckboxGrid} from '../filters/CheckboxGrid';
import {useState} from 'react';
import {toggleSelection} from '../filters/selection';
import {POKEMON_GAME_ERAS,type GameScope} from '../../core/domain/game-scope';
import type {GameScopeMetadata} from '../../core/domain/game-scope-metadata';
export const POKEMON_INITIAL_SCOPE:GameScope={market:'pokemon',eras:['swsh','sv','me'],sets:[]};
const emptyMetadata:GameScopeMetadata={market:'pokemon',source:'feed',asOf:null,publishedAt:null,bulkReady:false,sets:[]};
export function pokemonSelectionSummary(metadata:GameScopeMetadata,scope:GameScope){
 const available=metadata.sets.filter(set=>!scope.eras.length||scope.eras.includes(set.era));
 const unavailable=scope.sets.filter(name=>!available.some(set=>set.name===name));
 const count=available.filter(set=>!scope.sets.length||scope.sets.includes(set.name)).reduce((sum,set)=>sum+set.count,0);
 return {available,unavailable,count};
}
export default function PokemonPoolSelector({metadata,scope,onChange,loading=false}:{metadata:GameScopeMetadata|null;scope:GameScope;onChange:(scope:GameScope)=>void;loading?:boolean}){
 const [limit,setLimit]=useState(false);
 const {available,unavailable,count}=pokemonSelectionSummary(metadata??emptyMetadata,scope),keys=POKEMON_GAME_ERAS.map(era=>era.key);
 return <section className="detail-section pokemon-pool-selector" aria-labelledby="pokemon-pool-heading" aria-busy={loading}><h2 id="pokemon-pool-heading">Choose Your Card Pool</h2><fieldset disabled={loading}><legend>Eras</legend><div className="game-pool-presets"><button type="button" className="game-control" aria-pressed={scope.eras.length===0} onClick={()=>onChange({...scope,eras:[]})}>All Eras</button><button type="button" className="game-control" aria-pressed={scope.eras.length===3&&['swsh','sv','me'].every(era=>scope.eras.includes(era))} onClick={()=>onChange({...scope,eras:['swsh','sv','me']})}>Modern Eras</button></div><CheckboxGrid options={POKEMON_GAME_ERAS.map(era=>({key:era.key,label:era.label}))} selected={scope.eras} onToggle={key=>onChange({...scope,eras:toggleSelection(scope.eras,key,keys)})}/><p className="games-note">{scope.eras.length?'Selected eras':'All eras selected'}. Promos spanning several eras have their own group.</p></fieldset>
 <fieldset disabled={loading} className="game-pool-set-group"><legend className="sr-only">Set selection</legend><details><summary>Choose Specific Sets {scope.sets.length?`(${scope.sets.length})`:'(Optional)'}</summary><SearchableCheckboxGrid legend="Sets" searchLabel="Search Pokémon sets" options={available.map(set=>({key:set.name,label:`${set.name} · ${set.count} cards`}))} selected={scope.sets} onChange={sets=>{setLimit(sets.length>40);if(sets.length<=40)onChange({...scope,sets})}}/><p className="games-note">With no specific sets selected, use all available sets in your chosen eras. Select up to 40 sets.</p>{limit&&<p role="alert">The set limit is 40. Remove a set before adding another.</p>}</details></fieldset>
 {unavailable.length>0&&<p role="alert">These sets are unavailable in your selected eras: {unavailable.join(', ')}. <button className="game-control" type="button" onClick={()=>onChange({...scope,sets:scope.sets.filter(name=>!unavailable.includes(name))})}>Clear Unavailable Sets</button></p>}<p className="game-pool-count" role="status">{loading?'Checking available cards…':`${count.toLocaleString('en-US')} eligible priced cards · English raw singles`}</p><p className="games-note game-pool-source">{loading?'Checking market snapshot…':`TCGCSV / TCGplayer · Source date: ${metadata?.asOf??'unavailable'}${metadata?.bulkReady?'':' · Some everyday rarities are unavailable.'}`}</p></section>;
}
