import assert from "node:assert/strict";
import test from "node:test";
import {priceGamePool,drawPriceRound,initialPriceGame,priceGameReducer,priceGameWinner} from "../core/domain/price-game.ts";
const card=(id,price,extra={})=>({productId:id,name:`Card ${id}`,image:`https://images.example/${id}.jpg`,printing:"Normal",game:"riftbound",marketPrice:price,...extra});
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
