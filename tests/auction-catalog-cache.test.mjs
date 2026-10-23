import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuctionCatalogSnapshot,parseAuctionCatalogManifest,parseAuctionCatalogSnapshot,verifyAuctionCatalogSnapshot,unpackAuctionCatalog,auctionCatalogCacheEnabled} from '../core/domain/auction-catalog-snapshot.ts';
import {createAuctionCatalogCache,AUCTION_CATALOG_FRESH_MS} from '../app/data/auction-catalog-cache.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
const cards=[{game:'riftbound',productId:1,printing:'Normal',name:'First',set:'Origins',rarity:'Rare',section:'rares',image:'https://art.example/1',marketPrice:1.01},{game:'riftbound',productId:1,printing:'Foil',name:'First',set:'Origins',rarity:'Rare',section:'rares',image:'https://art.example/1',marketPrice:null}];
const make=(price=1.01,source='database')=>createAuctionCatalogSnapshot(cards.map(card=>card.printing==='Normal'?{...card,marketPrice:price}:card),source,'2026-10-19T00:00:00Z','2026-10-19T01:00:00Z');
const manifest=value=>parseAuctionCatalogManifest(value);
test('compact catalog retains exact unpriced printings and has a content hash, not a timestamp-only identity',async()=>{
 const first=await make(),second=await make(2);assert.notEqual(first.version,second.version);
 assert.equal((await make()).version,first.version);assert.deepEqual(await verifyAuctionCatalogSnapshot(first),first);
 const restored=unpackAuctionCatalog(first);assert.equal(restored.find(card=>card.printing==='Foil').marketPrice,null);assert.equal(restored.find(card=>card.printing==='Normal').marketPrice,1.01);
 assert.deepEqual(Object.keys(first).sort(),['asOf','count','publishedAt','rows','schema','source','version']);
 const corrupt=structuredClone(first);corrupt.rows[0][2]='Changed';await assert.rejects(()=>verifyAuctionCatalogSnapshot(corrupt),/version mismatch/);
 for(const change of [value=>value.schema=2,value=>value.count=99999,value=>value.rows.push(value.rows[0]),value=>value.rows[0][7]=-1,value=>value.rows[0][6]='javascript:alert(1)']){const value=structuredClone(first);change(value);assert.throws(()=>parseAuctionCatalogSnapshot(value))}
 assert.throws(()=>parseAuctionCatalogManifest({...manifest(first),asOf:'yesterday'}));
});
test('public cache coalesces subscribers, reuses unchanged versions and replaces complete catalogs atomically',async()=>{
 let current=await make(),now=100,reads=[];
 const cache=createAuctionCatalogCache(async(url,options)=>{reads.push({url,options});return Response.json(url.includes('?')?current:manifest(current))},()=>now);
 const results=await Promise.all(Array.from({length:8},()=>cache.refresh()));assert.equal(reads.length,2);assert.ok(results.every(value=>value.version===current.version));
 const before=cache.getSnapshot();assert.equal(await cache.refresh(),before.snapshot);assert.equal(reads.length,2);
 now+=AUCTION_CATALOG_FRESH_MS+1;await cache.refresh();assert.equal(reads.length,3);assert.equal(cache.getSnapshot().items,before.items);
 current=await make(3);await cache.refresh(true);assert.equal(reads.length,5);assert.equal(cache.getSnapshot().snapshot.version,current.version);assert.equal(cache.getSnapshot().items.find(card=>card.printing==='Normal').marketPrice,3);
 assert.ok(reads.every(row=>row.options.credentials==='omit'&&row.options.cache==='no-store'&&row.options.signal instanceof AbortSignal&&!row.options.signal.aborted));
});
test('unsubscribing does not abort another public consumer and failures retain last-good prices without reporting freshness',async()=>{
 let fail=false,release;const gate=new Promise(resolve=>release=resolve),first=await make();
 const cache=createAuctionCatalogCache(async url=>{await gate;if(fail)throw new Error('Offline');return Response.json(url.includes('?')?first:manifest(first))});
 let notified=0;const unsubscribe=cache.subscribe(()=>notified++),request=cache.refresh();unsubscribe();release();await request;assert.equal(notified,1);
 const before=cache.getSnapshot();fail=true;assert.equal(await cache.refresh(true),null);assert.equal(cache.getSnapshot().items,before.items);assert.equal(cache.getSnapshot().checkedAt,before.checkedAt);assert.equal(cache.getSnapshot().error,'Offline');
 fail=false;await cache.refresh(true);assert.equal(cache.getSnapshot().error,null);
});
test('publication races retry once; mismatched/malformed data and fallback downgrade cannot replace live prices',async()=>{
 const first=await make(),second=await make(2);let calls=0;
 const race=createAuctionCatalogCache(async url=>{calls++;if(calls===2)return Response.json({error:'changed'},{status:409});return Response.json(url.includes('?')?second:manifest(calls<3?first:second))});
 await race.refresh();assert.equal(calls,4);assert.equal(race.getSnapshot().snapshot.version,second.version);
 let response=first;const cache=createAuctionCatalogCache(async url=>Response.json(url.includes('?')?response:manifest(response)));await cache.refresh();
 response=await make(4,'feed');await cache.refresh(true);assert.equal(cache.getSnapshot().snapshot.version,first.version);assert.match(cache.getSnapshot().error,/Keeping/);
 response={...second,rows:second.rows.slice(1)};await cache.refresh(true);assert.equal(cache.getSnapshot().snapshot.version,first.version);assert.match(cache.getSnapshot().error,/Invalid/);
 const endless=createAuctionCatalogCache(async url=>url.includes('?')?Response.json({},{status:409}):Response.json(manifest(first)));await endless.refresh();assert.equal(endless.getSnapshot().snapshot,null);assert.ok(endless.getSnapshot().error);
});
test('cache feature is explicit and staging-only; deployment preparation never inherits enabled state',()=>{
 assert.equal(auctionCatalogCacheEnabled({}),false);assert.equal(auctionCatalogCacheEnabled({ENVIRONMENT:'staging',AUCTION_CATALOG_CACHE_ENABLED:'true'}),true);assert.equal(auctionCatalogCacheEnabled({ENVIRONMENT:'production',AUCTION_CATALOG_CACHE_ENABLED:'true'}),false);
 const base={vars:{AUCTION_CATALOG_CACHE_ENABLED:'true'}},options={environment:'staging',databaseId:'00000000-0000-4000-8000-000000000000',databaseName:'fixture',workerName:'fixture'};
 assert.equal(prepareDeploymentConfig(base,options).vars.AUCTION_CATALOG_CACHE_ENABLED,'false');assert.equal(prepareDeploymentConfig(base,{...options,auctionCatalogCache:true}).vars.AUCTION_CATALOG_CACHE_ENABLED,'true');
 assert.throws(()=>prepareDeploymentConfig(base,{...options,environment:'production',route:'example.test',auctionCatalogCache:true}),/staging-only/);
});

test('a stalled catalog request times out, retains last-good prices and can be retried',async()=>{
 const snapshot=await make();let stall=false;
 const cache=createAuctionCatalogCache(async url=>stall?new Promise(()=>{}):Response.json(url.includes('?')?snapshot:manifest(snapshot)),Date.now,20);
 await cache.refresh();const before=cache.getSnapshot();stall=true;assert.equal(await cache.refresh(true),null);assert.equal(cache.getSnapshot().items,before.items);assert.equal(cache.getSnapshot().checkedAt,before.checkedAt);assert.equal(cache.getSnapshot().loading,false);assert.match(cache.getSnapshot().error,/timed out/);
 stall=false;await cache.refresh(true);assert.equal(cache.getSnapshot().error,null);
});
