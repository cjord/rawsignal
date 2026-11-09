import assert from 'node:assert/strict';
import test from 'node:test';
import {runLiveJob} from '../worker/staging-jobs.ts';
import {gameTestDb} from './helpers/game-db.mjs';

const group={groupId:1,name:'SV01: Scarlet & Violet',publishedOn:'2023-03-31T00:00:00Z'};
const products=Array.from({length:6},(_,i)=>({productId:i+1,name:'Stock fixture '+i,imageUrl:'https://example.test/'+i+'.jpg',url:'https://www.tcgplayer.com/product/'+(i+1),extendedData:[{name:'Rarity',value:i===5?'Common':'Illustration Rare'},{name:'Number',value:(i+1)+'/100'}]}));
const prices=products.map(p=>({productId:p.productId,subTypeName:'Normal',marketPrice:p.productId===6?.1:5}));

test('the shared live job admits game-only stock only for the exact producer flag and rejects mid-run changes',async t=>{
 const urls=[];
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(input.url??input);urls.push(url.href);
  if(url.hostname==='tcg-price-tracker.shizukaziye.workers.dev')return Response.json({items:[]});
  assert.equal(url.hostname,'tcgcsv.com');
  if(url.pathname.endsWith('/groups'))return Response.json({results:url.pathname==='/tcgplayer/3/groups'?[group]:[]});
  if(url.pathname==='/tcgplayer/3/1/products')return Response.json({results:products});
  if(url.pathname==='/tcgplayer/3/1/prices')return Response.json({results:prices});
  throw new Error('Unexpected fixture URL: '+url.pathname);
 });
 for(const flag of [undefined,'TRUE','true']){
  const f=gameTestDb();try{
   const env={ENVIRONMENT:'staging',DB:f.db,ASSETS:{fetch:async()=>Response.json([])},POKEMON_GAME_STOCK_INGESTION_ENABLED:flag};
   const request=new Request('https://stage.example/__ops/staging-jobs');
   await runLiveJob(env,request,3,'2026-11-09T12:00:00Z');if(flag==='true')await runLiveJob(env,request,3,'2026-11-09T12:00:00Z');
   assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM game_catalog_stock').get().n,flag==='true'?1:0);
   assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM catalog_products WHERE product_id=6').get().n,0);
   if(flag==='true'){
    const before=urls.length;await assert.rejects(()=>runLiveJob({...env,POKEMON_GAME_STOCK_INGESTION_ENABLED:undefined},request,2,'2026-11-09T12:00:00Z'),/cannot change/);assert.equal(urls.length,before);
    for(const environment of ['production',undefined])assert.throws(()=>runLiveJob({...env,ENVIRONMENT:environment},request,2,'2026-11-09T12:00:00Z'),/staging-only/);assert.equal(urls.length,before);
   }
  }finally{f.sqlite.close()}
 }
});
