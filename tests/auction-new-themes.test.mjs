import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_LOT_THEMES,auctionLotTheme} from '../core/domain/auction-lot-themes.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {holdingKey} from '../core/domain/auction-types.ts';
const pool=Array.from({length:700},(_,i)=>({productId:i+1,name:`Card ${i}`,printing:'Normal',image:`https://images.example/${i}`,set:i%2?'Origins':'Spiritforged',rarity:['Common','Uncommon','Rare','Epic'][i%4],section:['commons','uncommons','rares','epics'][i%4],cents:100}));
test('seven themes include a genuinely larger clear-out and a low-duplicate curated binder without exceeding auction limits',()=>{
 const sizes={free:{ordinary:[],large:[]},paid:{ordinary:[],large:[]}};
 for(const kind of ['free','paid'])for(let seed=0;seed<400;seed++){
  const theme=auctionLotTheme(seed),lot=generateAuctionLot(pool,seed,kind),large=theme.id==='store-clearout';sizes[kind][large?'large':'ordinary'].push(lot.length);
  assert.ok(lot.length>=(kind==='paid'?50:25)&&lot.length<=(kind==='paid'?130:90));
  if(large)assert.ok(lot.length>=(kind==='paid'?106:71));
  if(theme.id==='curated-binder'){const counts=new Map();for(const card of lot)counts.set(holdingKey(card),(counts.get(holdingKey(card))??0)+1);assert.ok([...counts.values()].every(n=>n<=2));}
 }
 for(const kind of ['free','paid']){const avg=rows=>rows.reduce((s,n)=>s+n,0)/rows.length;assert.ok(avg(sizes[kind].large)>avg(sizes[kind].ordinary)+15);}
 assert.equal(AUCTION_LOT_THEMES.length,7);
});
