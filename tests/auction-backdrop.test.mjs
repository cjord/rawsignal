import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionBackdropImages,auctionBackdropSlots,auctionBackdropThumbnail,backdropResizeTime} from '../core/domain/auction-backdrop.ts';
test('decorative loop budgets cover the viewport with two incoming cards',()=>{
 for(const width of [320,390,768,1440,1920,3840]){const slots=auctionBackdropSlots(width),card=Math.min(190,Math.max(110,width*.15));assert.ok((slots-2)*(card+28)>=width);assert.ok(slots>=5)}
 assert.equal(auctionBackdropSlots(390),5);assert.equal(auctionBackdropSlots(1440),9);assert.equal(auctionBackdropSlots(NaN),9);
});
const catalog=Array.from({length:40},(_,index)=>({image:`https://images.example/${index}.jpg`}));

test('decorative thumbnails rewrite only the verified product CDN shape',()=>{
 assert.equal(auctionBackdropThumbnail('https://tcgplayer-cdn.tcgplayer.com/product/653045_in_1000x1000.jpg'),'https://tcgplayer-cdn.tcgplayer.com/product/653045_200w.jpg');
 for(const image of ['https://images.example/card.jpg','https://tcgplayer-cdn.tcgplayer.com.evil.test/product/1_in_1000x1000.jpg','https://tcgplayer-cdn.tcgplayer.com/product/1_200w.jpg'])assert.equal(auctionBackdropThumbnail(image),image);
});
test('auction backdrop samples catalog artwork by seed, independent of catalog order and without duplicates',()=>{
 const art=auctionBackdropImages([...catalog,catalog[0],{image:''},{image:'javascript:bad'}],42);
 assert.equal(art.length,18);assert.equal(new Set(art).size,18);assert.ok(art.every(image=>image.startsWith('https://images.example/')));
 assert.deepEqual(art,auctionBackdropImages([...catalog].reverse(),42));assert.notDeepEqual(art,auctionBackdropImages(catalog,43));
 assert.deepEqual(auctionBackdropImages([],42),[]);assert.deepEqual(auctionBackdropImages(catalog,42,0),[]);
});
test('decorative selection favors premium artwork without sampling hidden auction contents',()=>{
 const cards=Array.from({length:100},(_,index)=>({image:`https://images.example/${index}.jpg`,rarity:index<50?'Common':'Showcase',section:index<50?'commons':'signatures'}));
 let premiums=0;for(let seed=0;seed<100;seed++)premiums+=auctionBackdropImages(cards,seed).filter(image=>Number(/\/(\d+)\.jpg$/.exec(image)[1])>=50).length;
 assert.ok(premiums>1300);assert.ok(premiums<1800);assert.deepEqual(auctionBackdropImages(cards,7),auctionBackdropImages([...cards].reverse(),7));
});

test('resize preserves the directed pixel offset for forward and reverse lanes without resetting iteration',()=>{
 for(const reverse of [false,true])for(const time of [15000,25000,85000,135000]){
  const duration=70000,oldWidth=1900,newWidth=2200,next=backdropResizeTime(time,duration,oldWidth,newWidth,reverse);
  const offset=(t,width)=>((reverse?1-t/duration%1:t/duration%1)*width)%newWidth;
  assert.ok(Math.abs(offset(time,oldWidth)-offset(next,newWidth))<.00001);
  assert.equal(Math.floor(next/duration),Math.floor(time/duration));
 }
 assert.equal(backdropResizeTime(35000,70000,2000,1000),0);
 for(const args of [[100,0,100,100],[100,100,0,100],[100,100,100,0],[-1,100,100,100],[100,NaN,100,100]])assert.equal(backdropResizeTime(...args),args[0]);
});
