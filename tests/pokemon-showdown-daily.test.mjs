import assert from 'node:assert/strict';
import test from 'node:test';
import {gameTestDb} from './helpers/game-db.mjs';
import {startIngestion,upsertCard,completeIngestion} from '../db/repository.ts';
import {loadPokemonDailyShowdown} from '../db/pokemon-showdown-daily.ts';
import {pokemonDailyTheme,validPokemonDailyManifest,initialPokemonDaily,parsePokemonDaily} from '../core/domain/pokemon-showdown-daily.ts';
import {pokemonDailyCards as cards,pokemonDailyFixture as manifest} from './helpers/pokemon-daily-fixture.ts';
import {answerDailyShowdown,advanceDailyShowdown,parseDailyShowdown} from '../core/domain/showdown-daily.ts';
import {encodeGameShare,decodeGameShare,showdownShareText} from '../core/domain/game-sharing.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
const date='2026-11-09',now=Date.parse(date+'T12:00:00Z');
async function fixture(){const f=gameTestDb();await startIngestion(f.db,'daily-source','test',date,{sourceUpdatedAt:date});for(const card of cards)await upsertCard(f.db,card,date,'daily-source');await completeIngestion(f.db,'daily-source','daily-market',date,cards.length,cards.length);return f}

test('Pokémon daily themes are deterministic, mostly eras, with occasional viable set spotlights',async()=>{
 let sets=0;for(let i=0;i<28;i++){const day=new Date(now+i*86400000).toISOString().slice(0,10),theme=pokemonDailyTheme(cards,day);assert.deepEqual(pokemonDailyTheme([...cards].reverse(),day),theme);if(theme.kind==='set')sets++;const value=await manifest(day);assert.equal(validPokemonDailyManifest(value),true);for(const mode of ['normal','hard'])assert.equal(new Set(value[mode].flat().map(c=>c.productId)).size,mode==='hard'?30:20)}assert.equal(sets,4);
 assert.throws(()=>pokemonDailyTheme(cards.slice(0,20),date),/No eligible/);
 const one=await manifest();assert.equal(new Set([...one.normal.flat(),...one.hard.flat()].map(c=>c.productId)).size,50);assert.deepEqual(await manifest(),one);assert.notDeepEqual((await manifest('2026-11-10')).normal,one.normal);
});
test('Pokémon daily saves and versioned shares cannot be interpreted as Riftbound',async()=>{
 const value=await manifest();let save=initialPokemonDaily(value);
 for(let i=0;i<10;i++){save=answerDailyShowdown(save,'normal',0,now);assert.equal(answerDailyShowdown(save,'normal',1,now),save);if(i<9)save=advanceDailyShowdown(save,'normal',now)}
 assert.deepEqual(save.hard,{picks:[],cursor:0});assert.deepEqual(parsePokemonDaily(JSON.stringify(save)),save);assert.equal(answerDailyShowdown(save,'hard',0,now+86400000),save);assert.equal(advanceDailyShowdown(save,'normal',now),save);
 assert.equal(validAccountValue('raw-signal-pokemon-showdown-daily-v1',JSON.stringify(save)),true);assert.equal(validAccountValue('raw-signal-showdown-daily-v1',JSON.stringify(save)),false);assert.throws(()=>parseDailyShowdown(JSON.stringify(save)));
 const share={v:2,g:'showdown',market:'pokemon',d:date,m:'normal',p:save.normal.picks,c:value.catalogVersion};assert.deepEqual(decodeGameShare(encodeGameShare(share)),share);const text=showdownShareText(value,'normal',share.p,'https://example.test');assert.match(text,/Pokémon/);assert.equal((text.match(/🟩|🟥/gu)??[]).length,10);assert.ok(!text.includes('$'));assert.ok(!text.includes('Pokémon Daily 1'));
 for(const change of [{market:'riftbound'},{c:'bad'},{v:1},{p:[0]}])assert.throws(()=>decodeGameShare(encodeGameShare({...share,...change})));
 const invalid=structuredClone(value);Object.assign(invalid.normal[0][0],invalid.theme.kind==='set'?{set:'Wrong Set'}:invalid.theme.scope.eras.includes('wotc')?{set:'SV01: Scarlet & Violet',year:2023}:{set:'Base Set',year:1999});assert.equal(validPokemonDailyManifest(invalid),false);const wrongMarket=structuredClone(value);wrongMarket.hard[0][0].game='riftbound';assert.equal(validPokemonDailyManifest(wrongMarket),false);
});
test('concurrent first visitors share one frozen archive, and historical reads never regenerate prices',async()=>{
 const f=await fixture();try{let checks=0;const options={clock:()=>now,check:async()=>{checks++;return true}};const all=await Promise.all(Array.from({length:12},()=>loadPokemonDailyShowdown(f.db,options)));for(const value of all)assert.deepEqual(value,all[0]);assert.ok(checks<=50);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM shared_game_manifests').get().n,1);
  f.sqlite.exec('DELETE FROM refresh_state');const stored=await loadPokemonDailyShowdown(f.db,{...options,date,clock:()=>now+86400000});assert.deepEqual(stored,all[0]);assert.equal(await loadPokemonDailyShowdown(f.db,{...options,date:'2026-11-08'}),null);assert.equal(checks<=50,true);
 }finally{f.sqlite.close()}
});
test('broken artwork is replaced within the assigned scope before publication; transient failures consume no snapshot',async()=>{
 const f=await fixture();try{const initial=await manifest(),bad=initial.normal[0][0].image;const value=await loadPokemonDailyShowdown(f.db,{clock:()=>now,check:async image=>image!==bad});assert.equal(validPokemonDailyManifest(value),true);assert.deepEqual(value.theme,initial.theme);assert.ok(![...value.normal.flat(),...value.hard.flat()].some(c=>c.image===bad));
 }finally{f.sqlite.close()}
 const failed=await fixture();try{await assert.rejects(()=>loadPokemonDailyShowdown(failed.db,{clock:()=>now,check:async()=>{throw new Error('temporary')}}),/temporary/);assert.equal(failed.sqlite.prepare('SELECT count(*) n FROM shared_game_manifests').get().n,0);assert.ok(await loadPokemonDailyShowdown(failed.db,{clock:()=>now,check:async()=>true}));}finally{failed.sqlite.close()}
});
test('crossing midnight during preparation cannot publish an expired new lineup',async()=>{
 const f=await fixture();try{let clock=Date.parse(date+'T23:59:59Z');await assert.rejects(()=>loadPokemonDailyShowdown(f.db,{clock:()=>clock,check:async()=>{clock+=2000;return true}}),/date changed/);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM shared_game_manifests').get().n,0);assert.equal(await loadPokemonDailyShowdown(f.db,{date:'2026-11-11',clock:()=>now}),null)}finally{f.sqlite.close()}
});
