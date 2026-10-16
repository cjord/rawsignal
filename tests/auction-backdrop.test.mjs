import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionBackdropImages} from '../core/domain/auction-backdrop.ts';
const catalog=Array.from({length:40},(_,index)=>({image:`https://images.example/${index}.jpg`}));
test('auction backdrop samples catalog artwork by seed, independent of catalog order and without duplicates',()=>{
 const art=auctionBackdropImages([...catalog,catalog[0],{image:''},{image:'javascript:bad'}],42);
 assert.equal(art.length,10);assert.equal(new Set(art).size,10);assert.ok(art.every(image=>image.startsWith('https://images.example/')));
 assert.deepEqual(art,auctionBackdropImages([...catalog].reverse(),42));assert.notDeepEqual(art,auctionBackdropImages(catalog,43));
 assert.deepEqual(auctionBackdropImages([],42),[]);assert.deepEqual(auctionBackdropImages(catalog,42,0),[]);
});
