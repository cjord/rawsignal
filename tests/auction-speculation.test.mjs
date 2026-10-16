import assert from 'node:assert/strict';
import test from 'node:test';
import {applyNpcMarketPrior,NPC_SPECULATION_WEIGHTS} from '../core/domain/auction-npc-prior.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';
import {npcBid,auctionWinner} from '../core/domain/auction-engine.ts';
import {AUCTION_NPCS} from '../core/domain/auction-npcs.ts';
import {auctionRandom} from '../core/domain/auction-types.ts';

const card=cents=>({productId:1,printing:'Normal',name:'Known Card',image:'https://images.example/1',set:'Origins',rarity:'Common',section:'commons',cents});
const prior={mean:1000,bands:[{band:'common',mean:1000,typical:100,share:1}]};

test('free and paid speculation tapers while retaining an uncertain-remainder prior in round four',()=>{
 const knowledge={count:100,observed:[],random:[],clues:[],prior};
 for(const kind of ['free','paid']){
  const values=[1,2,3,4].map(round=>applyNpcMarketPrior({...knowledge,kind,round},1000,.2).estimate);
  NPC_SPECULATION_WEIGHTS[kind].forEach((weight,index)=>assert.equal(values[index],Math.round(1000*(1-weight)+100000*weight)));
  assert.ok(values[0]>values[1]&&values[1]>values[2]&&values[2]>values[3]);assert.ok(values[3]>1000);
 }
 assert.deepEqual(NPC_SPECULATION_WEIGHTS.free,[.14,.11,.085,.06]);
 assert.deepEqual(NPC_SPECULATION_WEIGHTS.paid,[.20,.18,.15,.12]);
 assert.equal(applyNpcMarketPrior(knowledge,1000,.2).estimate,14860); // Legacy missing kind defaults to free.
});

test('individually priced coverage further reduces speculation without discounting known prices',()=>{
 for(const kind of ['free','paid'])for(const round of [1,2,3,4]){
  const observed=Array.from({length:80},()=>card(100)),knowledge={kind,round,count:100,observed,random:observed,clues:[],prior};
  const weight=NPC_SPECULATION_WEIGHTS[kind][round-1]*.2;
  assert.equal(applyNpcMarketPrior(knowledge,8000,.5).estimate,Math.round(8000*(1-weight)+28000*weight));
  const priced=Array.from({length:100},()=>card(100));
  assert.equal(npcKnowledgeValue({...knowledge,observed:priced,random:priced}).estimate,10000);
 }
});

test('lucky priced investigations retain their full value and never hit an opening target cap',()=>{
 for(const kind of ['free','paid'])for(const round of [1,2,3,4]){
  const random=Array.from({length:8},()=>card(100)),knowledge={kind,round,count:90,random,observed:[...random,card(100)],clues:[],prior};
  const before=npcKnowledgeValue(knowledge),after=npcKnowledgeValue({...knowledge,observed:[...random,card(1000100)]});
  assert.equal(after.estimate-before.estimate,1000000);
  assert.ok(npcBid([],[90,90],[],0,()=>.5,1000,1,0,after.estimate,after.certainty,round)>250000);
 }
});

test('completed public bids have progressively stronger bounded influence, not a first-round floor',()=>{
 for(let personality=0;personality<AUCTION_NPCS.length;personality++){
  const follower=AUCTION_NPCS[personality].name==='The Follower',counts=[];
  for(const round of [1,2,3,4]){
   let influenced=0;
   const limit=round===1?0:follower?.18+(round-2)*.04:.12+(round-2)*.04;
   for(let seed=0;seed<500;seed++){
    const bid=history=>npcBid([],[50,50],history,personality,auctionRandom(seed),1000,1,0,10000,.5,round);
    const personal=bid([]),high=bid([900000,800000,1]),low=bid([1,2,900000]);
    assert.ok(high>=personal&&high<=Math.round(personal*(1+limit))+1);
    assert.ok(low<=personal&&low>=Math.round(personal*(1-limit))-1);
    assert.equal(bid([0,NaN,-1,Infinity]),personal);
    influenced+=Number(high>personal);
   }
   counts.push(influenced);
  }
  assert.equal(counts[0],0);assert.ok(counts[1]>0&&counts[1]<counts[2]&&counts[2]<counts[3]);
 }
});

test('round-one buyouts still require twice the highest rival, not twice their median',()=>{
 for(const bids of [[80,100,150],[200,300,500]]){
  const rivals=bids.map((cents,index)=>({name:`Rival ${index}`,cents})),required=Math.max(...bids)*2;
  assert.equal(auctionWinner([{name:'You',cents:required-1},...rivals],1,42).buyout,false);
  assert.deepEqual(auctionWinner([{name:'You',cents:required},...rivals],1,42),{winner:{name:'You',cents:required},buyout:true});
 }
});
