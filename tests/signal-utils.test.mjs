import test from "node:test";import assert from "node:assert/strict";import {evaluateMarketSignal,marketSignal} from "../core/signal-utils.ts";
const series=prices=>prices.map((price,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),price}));
test("a bounced buy and an exact-high sell both explain their extreme",()=>{const buy=marketSignal(series([20,18,16,14,10,10.3]),"buy","balanced"),sell=marketSignal(series([10,12,14,16,18,20]),"sell","balanced");assert.match(buy.reason,/low/);assert.match(sell.reason,/high/);assert.equal(buy.confidence,"medium");assert.equal(sell.confidence,"medium")});
test("falling knives are not buys: no bounce or a 7-day freefall waits for stabilization",()=>{
 // Monotonic decline: the current price IS the running low — no bounce evidence.
 assert.equal(evaluateMarketSignal(series([20,18,16,14,12,10]),"buy","aggressive").code,"awaiting-stabilization");
 // Bounced 1.3% off the low but down >5% on the week: still in freefall.
 assert.equal(evaluateMarketSignal(series([30,30,30,20,19,18,17,16,15,15.2]),"buy","aggressive").code,"awaiting-stabilization");
 // The same shapes stay valid sells at the other extreme.
 assert.ok(marketSignal(series([10,12,14,16,18,20]),"sell","balanced"));
});
test("strictness presets widen qualification without excluding low confidence labels",()=>{const points=series([10,12,11,10.2]),conservative=marketSignal(points,"buy","conservative"),aggressive=marketSignal(points,"buy","aggressive");assert.ok(!conservative||aggressive);assert.equal(aggressive?.confidence,"low")});
test("illiquid cards are excluded from both boards; unknown counts pass",()=>{
 const rising=series([10,12,14,16,18,20]);
 // Below the 5/30D floor: no sell signal even at a fresh high.
 assert.equal(evaluateMarketSignal(rising,"sell","balanced",undefined,{sales7:1,sales30:3}).code,"insufficient-liquidity");
 // 30D volume fine but a dead week fails the 1/7D floor.
 assert.equal(evaluateMarketSignal(rising,"sell","balanced",undefined,{sales7:0,sales30:12}).code,"insufficient-liquidity");
 // At the floors, and with unknown counts, the signal evaluates normally.
 assert.ok(evaluateMarketSignal(rising,"sell","balanced",undefined,{sales7:1,sales30:5}).eligible);
 assert.ok(evaluateMarketSignal(rising,"sell","balanced",undefined,{sales7:null,sales30:null}).eligible);
 assert.ok(evaluateMarketSignal(rising,"sell","balanced").eligible);
});

test("signal evaluation explains each non-qualification path",()=>{
 assert.equal(evaluateMarketSignal([],"buy","balanced").code,"missing-current-price");
 assert.equal(evaluateMarketSignal(series([10]),"buy","balanced",10).code,"insufficient-history");
 assert.equal(evaluateMarketSignal(series([10,20,20]),"buy","conservative",20).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(series([10,10.1,10.1]),"buy","conservative",10.1).code,"below-minimum-score");
});
