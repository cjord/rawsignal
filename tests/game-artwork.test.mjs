import assert from 'node:assert/strict';
import test from 'node:test';
import {imageHeaderSize} from '../core/domain/image-header.ts';
import {checkGameArtwork,failedGameArtwork} from '../db/game-artwork.ts';
import {verifiedDailyAuction,verifiedDailyShowdown} from '../db/game-lineups.ts';
import {createDailyShowdownManifest} from '../core/domain/showdown-daily.ts';
import {createDailyAuctionManifest} from '../core/domain/auction-daily.ts';

const url='https://tcgplayer-cdn.tcgplayer.com/product/123_in_1000x1000.jpg';
const jpeg=(width,height)=>new Uint8Array([255,216,255,224,0,4,0,0,255,192,0,11,8,height>>8,height&255,width>>8,width&255,1,1,17,0]);
test('bounded image header reads detect real artwork, truncated headers and CDN placeholders',async()=>{
 assert.deepEqual(imageHeaderSize(jpeg(469,655)),{width:469,height:655});
 assert.equal(imageHeaderSize(jpeg(469,655).subarray(0,14)),null);
 assert.equal(imageHeaderSize(new TextEncoder().encode('<xml>Error</xml>')),null);
 for(const [width,height,valid] of [[469,655,true],[400,570,false],[200,285,false]])
  assert.equal(await checkGameArtwork(url,async()=>new Response(jpeg(width,height))),valid);
 assert.equal(await checkGameArtwork(url,async()=>new Response('Forbidden',{status:403})),false);
 assert.equal(await checkGameArtwork(url,async()=>new Response('Missing',{status:404})),false);
 await assert.rejects(()=>checkGameArtwork(url,async()=>new Response('Down',{status:503})),/temporarily unavailable/);
 let requests=0;assert.equal(await checkGameArtwork('https://evil.example/image.jpg',async()=>{requests++;return new Response()}),false);assert.equal(requests,0);
 await checkGameArtwork(url,async(_url,options)=>{assert.equal(options.redirect,'manual');assert.equal(options.headers.Range,'bytes=0-65535');return new Response(jpeg(469,655))});
});
test('artwork checks deduplicate URLs with at most six concurrent checks',async()=>{
 let active=0,peak=0,calls=0;
 const bad=await failedGameArtwork(Array.from({length:30},(_,index)=>({image:`url-${index%15}`})),async image=>{calls++;peak=Math.max(peak,++active);await new Promise(resolve=>setImmediate(resolve));active--;return image!=='url-2'});
 assert.equal(calls,15);assert.ok(peak<=6);assert.deepEqual([...bad],['url-2']);
});
const catalog=Array.from({length:150},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index}`,image:`https://images.example/${index}`,set:'Origins',rarity:'Rare',section:'rares',cents:200+index}));
test('shared repair excludes broken images without rerolling valid Showdown rounds',async()=>{
 const original=createDailyShowdownManifest(catalog,'2026-10-16','test'),broken=original.normal[0][0].image;
 const manifest=await verifiedDailyShowdown(catalog,'2026-10-16','test',async image=>image!==broken);
 assert.ok(![...manifest.normal,...manifest.hard].flat().some(card=>card.image===broken));
 for(const mode of ['normal','hard'])for(let index=0;index<10;index++)if(!original[mode][index].some(card=>card.image===broken))assert.deepEqual(manifest[mode][index],original[mode][index]);
 assert.ok(manifest.normal.every(round=>round.length===2));assert.ok(manifest.hard.every(round=>round.length===3));
});
test('auction repair removes broken artwork, retains valid lots/seeds/rivals and fails closed with insufficient stock',async()=>{
 const original=createDailyAuctionManifest(catalog,'2026-10-16','test'),broken=original.auctions[0].lot[0].image;
 const manifest=await verifiedDailyAuction(catalog,'2026-10-16','test',async image=>image!==broken);
 for(let index=0;index<5;index++){
  const draft=manifest.auctions[index],prior=original.auctions[index];
  assert.ok(!draft.lot.some(card=>card.image===broken));assert.equal(draft.seed,prior.seed);assert.deepEqual(draft.rivals,prior.rivals);
  if(!prior.lot.some(card=>card.image===broken))assert.deepEqual(draft.lot,prior.lot);
 }
 await assert.rejects(()=>verifiedDailyAuction(catalog,'2026-10-16','test',async()=>false),/Not enough verified/);
 await assert.rejects(()=>verifiedDailyShowdown(catalog,'2026-10-16','test',async()=>false),/Not enough verified/);
});
