import assert from 'node:assert/strict';
import test from 'node:test';
import {gameTestDb as fixture} from './helpers/game-db.mjs';
import {validAccountValue} from '../core/domain/account-data.ts';
import {initialPriceGame,priceGameReducer} from '../core/domain/price-game.ts';
import {GAME_PROFILES,parseGameMarket} from '../core/domain/game-profile.ts';
import {parseGameScope,gameScopeKey,selectGameScope,pokemonGameEra} from '../core/domain/game-scope.ts';
import {pokemonBulkSection,pokemonGameRarity,pokemonPriceRoundRules} from '../core/domain/pokemon-game-rarity.ts';
import {priceGamePool,drawPriceRound} from '../core/domain/price-game.ts';
import {createGameCatalogSnapshot,parseGameCatalogSnapshot,unpackGameCatalog,verifyGameCatalogSnapshot} from '../core/domain/game-catalog-snapshot.ts';
import {normalizeSinglesGroup} from '../core/normalize/singles.ts';
import {normalizePokemonGameStock,persistGameStock} from '../db/game-catalog-stock.ts';
import {runLiveDailyIngestionBatch} from '../db/live-ingestion.ts';
import {readPracticeGameCatalog} from '../db/practice-game-catalog.ts';
import {handlePracticeGameCatalog} from '../app/api/game-catalog-service.ts';
import {startIngestion,upsertCard} from '../db/repository.ts';
import {parseGameScopeMetadata} from '../core/domain/game-scope-metadata.ts';
const card=(productId,patch={})=>({game:'pokemon',section:'illustration-rares',productId,name:'Card '+productId,set:'SV01: Scarlet & Violet',year:2023,rarity:'Illustration Rare',number:productId+'/100',printing:'Holofoil',image:'https://tcgplayer-cdn.tcgplayer.com/product/'+productId+'_in_1000x1000.jpg',url:'',marketPrice:productId,lowPrice:null,midPrice:null,highPrice:null,priceChange:null,...patch});
const scope=(patch={})=>({market:'pokemon',eras:[],sets:[],...patch});
const group={groupId:1,name:'SV01: Scarlet & Violet',publishedOn:'2023-03-31T00:00:00Z'};
const product=(id,rarity)=>({productId:id,name:'Card '+id,imageUrl:'https://tcgplayer-cdn.tcgplayer.com/product/'+id+'_200w.jpg',url:'https://www.tcgplayer.com/product/'+id,extendedData:[{name:'Number',value:id+'/100'},{name:'Rarity',value:rarity}]});
const price=(id,value,printing='Holofoil')=>({productId:id,marketPrice:value,subTypeName:printing});
const now=new Date('2026-11-09T12:00:00Z');
function dependencies(){let calls=0;return {get calls(){return calls},client:{async groups(category){return category===3?[group]:[]},async products(){calls++;return [product(1,'Illustration Rare'),product(2,'Common'),product(3,'Uncommon'),product(4,'Rare'),product(5,'Holo Rare')]},async prices(){calls++;return [price(1,12),price(2,.1,'Normal'),price(2,.25,'Reverse Holofoil'),price(3,.2,'Normal'),price(4,.3,'Normal'),price(5,1,'Holofoil')]}},async fetchMsrp(){return new Map()},async loadBundledSealed(){return []}}}
async function ingest(f,includeGameStock=false){const deps=dependencies();let result;for(let i=0;i<30;i++){result=await runLiveDailyIngestionBatch(f.db,deps,{sourceUpdatedAt:now.toISOString(),now,batchSize:2,minimumRecords:1,includeGameStock});if(result.done)return {result,deps}}throw new Error('Fixture did not finish')}

test('game identity keeps legacy paths/keys while Pokémon has independent progress domains',()=>{
 assert.equal(GAME_PROFILES.riftbound.keys.auction,'raw-signal-auction-house-v1');assert.equal(GAME_PROFILES.pokemon.houses.free,'Pewter Auction House');assert.equal(GAME_PROFILES.pokemon.houses.paid,'Celadon Auction House');
 const keys=Object.values(GAME_PROFILES).flatMap(p=>Object.values(p.keys));assert.equal(new Set(keys).size,6);for(const invalid of ['all','onepiece',null,{},'Pokemon'])assert.throws(()=>parseGameMarket(invalid));
});

test('scope normalization is deterministic, bounded and never silently broadens invalid selections',()=>{
 assert.equal(gameScopeKey(scope({eras:['sv','swsh','sv'],sets:[' B ','A']})),gameScopeKey(scope({eras:['swsh','sv'],sets:['A','B']})));
 for(const patch of [{market:'all'},{market:'riftbound',eras:['sv']},{eras:['invented']},{eras:'sv'},{sets:Array.from({length:41},(_,i)=>'Set '+i)},{sets:['bad\nset']},{unknown:true}])assert.throws(()=>parseGameScope(scope(patch)));
 const cards=[card(1),card(2,{set:'SWSH01',year:2020}),card(3,{game:'riftbound'}),card(4,{section:'japanese-promos'}),card(5,{marketPrice:null})];
 assert.deepEqual(selectGameScope(cards,scope({eras:['sv']})).cards.map(c=>c.productId),[1]);
 const missing=selectGameScope(cards,scope({sets:['Missing']}));assert.deepEqual(missing.cards,[]);assert.deepEqual(missing.missingSets,['Missing']);
 const wrongEra=selectGameScope(cards,scope({eras:['sv'],sets:['SWSH01']}));assert.deepEqual(wrongEra.cards,[]);assert.deepEqual(wrongEra.incompatibleSets,['SWSH01']);
 assert.equal(pokemonGameEra({set:'Unclassified',year:0}),'unknown');assert.equal(pokemonGameEra({set:'SV10: Example',year:0}),'sv');assert.equal(pokemonGameEra({set:'Prize Pack Series Cards',year:2022}),'cross-era');
});

test('bulk admission is opt-in, excludes missing prices and preserves the actual preferred printing',()=>{
 const products=[product(2,'Common'),product(3,'Uncommon'),product(4,'Rare'),product(5,'Holo Rare'),product(6,'Unknown'),product(7,'Common')];const prices=[price(2,.1,'Normal'),price(2,.25,'Reverse Holofoil'),price(3,.2,'Normal'),price(4,.3,'Normal'),price(5,1)];
 assert.equal(normalizeSinglesGroup({game:'pokemon',group,products,prices}).cards.length,0);
 const stock=normalizePokemonGameStock(group,products,prices);assert.equal(stock.length,4);assert.equal(stock[0].printing,'Reverse Holofoil');assert.equal(stock[0].marketPrice,.25);assert.equal(stock[0].productId,2);
 assert.deepEqual(normalizePokemonGameStock({...group,publishedOn:'2000-01-01T00:00:00Z'},products,prices),[]);assert.equal(pokemonBulkSection('Rare Holo')[0],'pokemon-holo-rares');assert.equal(pokemonBulkSection('Rare Holo EX'),null);
});

test('Pokémon comparison cohorts remain separate from Riftbound rarity assumptions and displayed prices never tie',()=>{
 assert.equal(pokemonGameRarity(card(1,{rarity:'Common',section:'pokemon-commons',printing:'Reverse Holofoil'})),'common');assert.equal(pokemonGameRarity(card(1,{section:'vintage',rarity:'Rare',printing:'Holofoil'})),'holo');
 assert.equal(pokemonGameRarity(card(1,{section:'ultra-rares',rarity:'Rare Ultra',number:'TG21/TG30'})),'gallery');
 const cards=[1,2,3].map(id=>card(id,{section:'pokemon-commons',rarity:'Common'})).concat([4,5,6].map(id=>card(id,{section:'pokemon-uncommons',rarity:'Uncommon'})));
 const pool=priceGamePool(cards,'pokemon');const round=drawPriceRound(pool,'hard',[],()=>.8,pokemonPriceRoundRules);assert.equal(round.length,3);assert.equal(new Set(round.map(c=>pokemonPriceRoundRules.rarity(c))).size,2);assert.equal(new Set(round.map(c=>c.marketPrice)).size,3);
});

test('catalog versions pin game, scope, exact printing, date and price; mismatches and tampering fail',async()=>{
 const cards=[card(1),card(2,{set:'SWSH01',year:2020})];const one=await createGameCatalogSnapshot(cards,scope({eras:['sv']}),'database','2026-11-09','2026-11-09T12:00:00Z');
 assert.equal(one.count,1);assert.equal(unpackGameCatalog(one)[0].set,cards[0].set);assert.equal(unpackGameCatalog(one)[0].printing,'Holofoil');assert.equal((await verifyGameCatalogSnapshot(one,scope({eras:['sv']}))).version,one.version);
 await assert.rejects(()=>verifyGameCatalogSnapshot(one,scope({eras:['swsh']})),/identity mismatch/);
 const changed=structuredClone(one);changed.rows[0][7]++;await assert.rejects(()=>verifyGameCatalogSnapshot(changed,one.scope),/identity mismatch/);
 assert.throws(()=>parseGameCatalogSnapshot({...one,market:'riftbound'}),/market mismatch/);assert.throws(()=>parseGameCatalogSnapshot({...one,rows:[...one.rows,...one.rows],count:2}),/Invalid/);
 await assert.rejects(()=>createGameCatalogSnapshot(cards,scope({sets:['Missing']}),'feed',null,null),/unavailable/);
 const empty=await createGameCatalogSnapshot(cards,scope({eras:['wotc']}),'feed',null,null);assert.equal(empty.count,0);assert.equal(empty.asOf,null);
});

test('checkpointed game stock shares upstream reads and leaves market rows, observations and minimum guards unchanged',async()=>{
 const baseline=fixture(),expanded=fixture();try{
  await ingest(baseline);const {result}=await ingest(expanded,true);
  const queries=['SELECT product_id,kind,game,section FROM catalog_products ORDER BY product_id','SELECT product_id,market_cents FROM current_prices ORDER BY product_id','SELECT product_id,market_cents FROM price_observations ORDER BY product_id'];
  for(const sql of queries)assert.deepEqual(expanded.sqlite.prepare(sql).all(),baseline.sqlite.prepare(sql).all(),sql);
  assert.equal(baseline.sqlite.prepare('SELECT COUNT(*) n FROM game_catalog_stock').get().n,0);assert.equal(expanded.sqlite.prepare('SELECT COUNT(*) n FROM game_catalog_stock').get().n,4);assert.equal(result.recordsWritten,baseline.sqlite.prepare('SELECT COUNT(*) n FROM catalog_products').get().n);
  const row=expanded.sqlite.prepare('SELECT * FROM game_catalog_stock WHERE product_id=2').get();assert.equal(row.market_cents,25);assert.equal(row.printing,'Reverse Holofoil');
  const marketOnly=await readPracticeGameCatalog(expanded.db,'pokemon');assert.deepEqual(marketOnly.cards.map(c=>c.productId),[1]);assert.equal(marketOnly.bulkReady,false);
  baseline.sqlite.exec('DROP TABLE game_catalog_stock');assert.equal((await readPracticeGameCatalog(baseline.db,'pokemon')).cards.length,1);
  const games=await readPracticeGameCatalog(expanded.db,'pokemon',{includeGameStock:true});assert.equal(games.cards.length,5);assert.equal(games.bulkReady,true);
  await persistGameStock(expanded.db,{...games.cards.find(c=>c.productId===2),marketPrice:.05,gameCatalogOnly:true},now.toISOString(),result.runId);assert.equal(expanded.sqlite.prepare('SELECT market_cents FROM game_catalog_stock WHERE product_id=2').get().market_cents,25);
  expanded.sqlite.prepare('DELETE FROM game_catalog_stock WHERE product_id=2').run();await assert.rejects(()=>readPracticeGameCatalog(expanded.db,'pokemon',{includeGameStock:true}),/unavailable/);
 }finally{baseline.sqlite.close();expanded.sqlite.close()}
});

test('an interrupted ingestion cannot switch admission policy or expose pending game stock',async()=>{
 const f=fixture();try{
  const deps=dependencies(),options={sourceUpdatedAt:now.toISOString(),now,batchSize:2,minimumRecords:1,includeGameStock:true};
  const result=await runLiveDailyIngestionBatch(f.db,deps,options);assert.equal(result.done,false);
  await assert.rejects(()=>runLiveDailyIngestionBatch(f.db,deps,{...options,includeGameStock:false}),/cannot change/);await assert.rejects(()=>readPracticeGameCatalog(f.db,'pokemon',{includeGameStock:true}),/unavailable/i);
  await ingest(f,true);assert.equal((await readPracticeGameCatalog(f.db,'pokemon',{includeGameStock:true})).bulkReady,true);
 }finally{f.sqlite.close()}
});

test('unpublished extra rows do not hide a complete published pool, but overwritten published rows fail closed',async()=>{
 const f=fixture();try{
  await ingest(f,true);await startIngestion(f.db,'pending-next','test',now.toISOString());
  await upsertCard(f.db,card(999),now.toISOString(),'pending-next');await persistGameStock(f.db,{...card(998),gameCatalogOnly:true},now.toISOString(),'pending-next');
  const published=await readPracticeGameCatalog(f.db,'pokemon',{includeGameStock:true});assert.deepEqual(published.cards.map(c=>c.productId),[1,2,3,4,5]);
  await persistGameStock(f.db,{...card(2),gameCatalogOnly:true},now.toISOString(),'pending-next');await assert.rejects(()=>readPracticeGameCatalog(f.db,'pokemon',{includeGameStock:true}),/unavailable/);
  await upsertCard(f.db,card(1),now.toISOString(),'pending-next');await assert.rejects(()=>readPracticeGameCatalog(f.db,'pokemon'),/unavailable/i);
 }finally{f.sqlite.close()}
});

test('catalog API isolates cached markets and validates requests before catalog reads',async()=>{
 const f=fixture();try{
  await ingest(f,true);const origin='https://example.test/api/games/pokemon/catalog';const env={DB:f.db,POKEMON_GAME_CATALOG_ENABLED:'true'};
  const get=query=>handlePracticeGameCatalog(new Request(origin+query),env,'pokemon');
  const meta=await get('?view=scopes');assert.equal(meta.status,200);const info=await meta.json();assert.equal(info.bulkReady,true);assert.equal(info.market,'pokemon');assert.equal(info.sets[0].count,5);
  const pool=await get('?eras='+encodeURIComponent(JSON.stringify(['sv'])));assert.equal(pool.status,200);const snapshot=await pool.json();assert.equal(snapshot.market,'pokemon');assert.equal(snapshot.count,5);assert.equal(pool.headers.get('cache-control'),'no-store');
  for(const query of ['?extra=1','?view=wrong','?eras=bad','?sets=[]&sets=[]','?view=scopes&eras=%5B%22sv%22%5D','?sets='+encodeURIComponent(JSON.stringify(['Missing']))])assert.equal((await get(query)).status,400,query);
  const rival=await handlePracticeGameCatalog(new Request(origin),env,'riftbound');assert.equal(rival.status,200);const rivalPool=await rival.json();assert.equal(rivalPool.market,'riftbound');assert.equal(rivalPool.count,0);
  assert.equal((await handlePracticeGameCatalog(new Request(origin),env,'all')).status,400);
  assert.equal((await handlePracticeGameCatalog(new Request(origin,{method:'POST'}),env,'pokemon')).status,405);
 }finally{f.sqlite.close()}
});

test('Pokémon practice validation requires its own market and pool, without changing legacy saves',()=>{
 const round=priceGamePool([card(1),card(2)],'pokemon'),state=priceGameReducer(initialPriceGame(round),{type:'answer',productId:1}),value={v:1,market:'pokemon',scope:scope({eras:['sv']}),difficulty:'normal',state};
 const key=GAME_PROFILES.pokemon.keys.practice;assert.equal(validAccountValue(key,JSON.stringify(value)),true);assert.equal(validAccountValue(key,JSON.stringify({...value,market:'riftbound'})),false);assert.equal(validAccountValue(key,JSON.stringify({...value,scope:scope({eras:['wotc']})})),false);assert.equal(validAccountValue(key,JSON.stringify({...value,scope:scope({sets:['Missing']})})),false);
 assert.equal(validAccountValue(GAME_PROFILES.riftbound.keys.practice,JSON.stringify({v:1,difficulty:'normal',state:initialPriceGame([])})),true);
});

test('feed fallback requires complete sources and never invents provenance or bulk readiness',async()=>{
 const makeEnv=(fail=false)=>({ASSETS:{async fetch(request){const path=new URL(request.url).pathname;if(fail&&path.includes('illustration-rares'))return new Response('',{status:404});return Response.json(path==='/data/illustration-rares.json'?[card(1)]:[])}}});
 const url='https://example.test/api/games/pokemon/catalog';
 const meta=await handlePracticeGameCatalog(new Request(url+'?view=scopes'),makeEnv(),'pokemon');assert.equal(meta.status,200);const value=parseGameScopeMetadata(await meta.json());assert.equal(value.source,'feed');assert.equal(value.asOf,null);assert.equal(value.publishedAt,null);assert.equal(value.bulkReady,false);assert.equal(value.sets.length,1);
 const response=await handlePracticeGameCatalog(new Request(url),makeEnv(),'pokemon');assert.equal(response.status,200);const snapshot=await verifyGameCatalogSnapshot(await response.json(),scope());assert.equal(snapshot.source,'feed');assert.equal(snapshot.count,1);
 assert.equal((await handlePracticeGameCatalog(new Request(url),makeEnv(true),'pokemon')).status,503);
 assert.throws(()=>parseGameScopeMetadata({...value,sets:[...value.sets,...value.sets]}),/Conflicting/);
});
