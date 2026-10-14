import assert from "node:assert/strict";
import test from "node:test";
import {priceGamePool,drawPriceRound,initialPriceGame,priceGameReducer,priceGameWinner,priceGameRarity,priceRoundStyle} from "../core/domain/price-game.ts";
import {createPriceGameImageLoader,preparePriceRound} from "../app/data/price-game-images.ts";
const card=(id,price,extra={})=>({productId:id,name:`Card ${id}`,image:`https://images.example/${id}.jpg`,printing:"Normal",game:"riftbound",rarity:"Rare",section:"rares",marketPrice:price,...extra});
test("price game excludes missing, zero, invalid, wrong-game and ambiguous printing prices",()=>{
 const pool=priceGamePool([card(1,1.005),card(2,null),card(3,0),card(4,NaN),card(5,10,{game:"pokemon"}),card(6,1,{image:""}),card(7,2),card(7,5,{printing:"Foil"}),card(8,2),card(8,2)],"riftbound");
 assert.deepEqual(pool.map(row=>row.productId),[1,8]);assert.equal(pool[0].marketPrice,1.01);
});
test("normal and hard rounds have distinct identities, names, art and displayed cents",()=>{
 const pool=priceGamePool(Array.from({length:20},(_,i)=>card(i+1,i+1)),"riftbound");
 for(const difficulty of ["normal","hard"]){
  const first=drawPriceRound(pool,difficulty,[],()=>.5),second=drawPriceRound(pool,difficulty,first.map(card=>card.productId),()=>.5);
  assert.equal(first.length,difficulty==="normal"?2:3);
  assert.ok(second.every(card=>!first.some(previous=>previous.productId===card.productId)));
  assert.equal(new Set(first.map(card=>card.marketPrice)).size,first.length);
 }
 assert.deepEqual(drawPriceRound([card(1,1),card(2,1)],"normal"),[]);
 assert.deepEqual(drawPriceRound([card(1,1),card(2,2)],"hard"),[]);
 assert.deepEqual(drawPriceRound([card(1,1),card(2,2,{image:"https://images.example/1.jpg"})],"normal"),[]);
});
test("answer locks once, correct increments score/streak, wrong resets streak, next preserves score",()=>{
 const round=[card(1,1),card(2,5)];let state=initialPriceGame(round);
 assert.equal(priceGameWinner(round).productId,2);
 assert.equal(priceGameReducer(state,{type:"answer",productId:99}),state);
 state=priceGameReducer(state,{type:"answer",productId:2});assert.equal(state.correct,1);assert.equal(state.streak,1);
 assert.equal(priceGameReducer(state,{type:"answer",productId:1}),state);
 state=priceGameReducer(state,{type:"next",round});assert.equal(state.selected,null);assert.equal(state.correct,1);
 state=priceGameReducer(state,{type:"answer",productId:1});assert.equal(state.streak,0);assert.equal(state.attempts,2);assert.equal(state.correct,1);
});

test("history captures each accepted pick once with frozen prices, newest first, and clears with a new session",()=>{
 const first=[card(1,1),card(2,5)],second=[card(3,3),card(4,8),card(5,6)];
 let state=initialPriceGame(first);
 assert.deepEqual(state.history,[]);
 assert.equal(priceGameReducer(state,{type:"answer",productId:99}).history.length,0);
 state=priceGameReducer(state,{type:"answer",productId:2});
 assert.deepEqual(state.history[0],{roundNumber:1,cards:first,selected:2,winner:2,correct:true});
 assert.equal(priceGameReducer(state,{type:"answer",productId:1}).history.length,1);
 first[0].marketPrice=99;assert.equal(state.history[0].cards[0].marketPrice,1);
 state=priceGameReducer(state,{type:"next",round:second});
 assert.equal(state.history.length,1);
 state=priceGameReducer(state,{type:"answer",productId:3});
 assert.deepEqual(state.history.map(entry=>[entry.roundNumber,entry.selected,entry.winner,entry.correct]),[[2,3,4,false],[1,2,2,true]]);
 assert.equal(priceGameReducer(state,{type:"replace",round:first}).history.length,2);
 assert.deepEqual(initialPriceGame(second).history,[]);
});

test("rarity preferences use 70/25/5 boundaries and distinct signature/overnumbered tiers",()=>{
 assert.equal(priceRoundStyle(.6999),"same");assert.equal(priceRoundStyle(.7),"similar");assert.equal(priceRoundStyle(.9499),"similar");assert.equal(priceRoundStyle(.95),"random");
 assert.equal(priceGameRarity(card(1,1,{rarity:"Showcase",section:"signatures"})),"signature");
 assert.equal(priceGameRarity(card(1,1,{rarity:"Showcase",section:"overnumbered"})),"overnumbered");
 const pool=[...Array.from({length:4},(_,i)=>card(i+1,i+1)),...Array.from({length:4},(_,i)=>card(i+10,i+10,{rarity:"Epic",section:"epics"})),card(30,30,{rarity:"Common",section:"riftbound-commons"})];
 const same=drawPriceRound(pool,"hard",[],()=>.1);assert.equal(new Set(same.map(priceGameRarity)).size,1);
 const similar=drawPriceRound(pool,"hard",[],()=>.8);assert.deepEqual(new Set(similar.map(priceGameRarity)),new Set(["rare","epic"]));
 const random=drawPriceRound(pool,"hard",[],()=>.99);assert.equal(random.length,3);
 const sparse=[card(1,1,{rarity:"Common"}),card(2,2,{rarity:"Epic"}),card(3,3,{section:"signatures"})];
 assert.equal(drawPriceRound(sparse,"hard",[],()=>.1).length,3,"sparse preferred groups fall back without an empty round");
});

test("image probes cache successful checks and reject errors, zero dimensions and TCGplayer placeholders",async()=>{
 let probes=0;
 const loader=createPriceGameImageLoader(()=>{
  probes++;
  return {naturalWidth:200,naturalHeight:280,onload:null,onerror:null,set src(value){this._src=value;queueMicrotask(()=>{if(value.includes("broken"))this.onerror?.();else{if(value.includes("placeholder"))this.naturalHeight=285;if(value.includes("zero"))this.naturalWidth=0;this.onload?.()}})},get src(){return this._src}};
 },100);
 assert.equal(await loader.load("https://images.example/good"),true);
 assert.equal(await loader.load("https://images.example/good"),true);assert.equal(probes,1);
 for(const src of ["https://images.example/broken","https://images.example/zero","https://tcgplayer-cdn.tcgplayer.com/placeholder"]){assert.equal(await loader.load(src),false);assert.equal(loader.failed(src),true)}
 const before=probes;assert.equal(await loader.load("https://images.example/broken"),false);assert.equal(probes,before);
});

test("round preparation excludes broken images, stays bounded and honors cancellation without score changes",async()=>{
 const pool=Array.from({length:12},(_,i)=>card(i+1,i+1));const rejected=new Set([pool[0].image,pool[1].image]);let loads=0;
 const loader={failed:src=>rejected.has(src),exclude:src=>rejected.add(src),load:async src=>{loads++;return !rejected.has(src)}};
 const round=await preparePriceRound(pool,"hard",[],loader,undefined,()=>.1);
 assert.equal(round.length,3);assert.equal(loads,3);assert.ok(round.every(card=>!rejected.has(card.image)));
 const state=initialPriceGame([]),replaced=priceGameReducer(state,{type:"replace",round});assert.equal(replaced.roundNumber,1);assert.equal(replaced.attempts,0);
 const controller=new AbortController();controller.abort();assert.deepEqual(await preparePriceRound(pool,"hard",[],loader,controller.signal),[]);
 const allFailed={failed:()=>false,exclude:()=>{},load:async()=>false};let checks=0;allFailed.load=async()=>{checks++;return false};
 assert.deepEqual(await preparePriceRound(pool,"hard",[],allFailed),[]);assert.equal(checks,24);
});
