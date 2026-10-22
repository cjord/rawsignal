import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionBackdropImages,auctionBackdropThumbnail} from '../core/domain/auction-backdrop.ts';
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
