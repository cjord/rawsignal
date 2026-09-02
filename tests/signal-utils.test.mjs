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
 assert.equal(evaluateMarketSignal(rising,"sell","balanced",undefined,{liquidity:{sales7:1,sales30:3}}).code,"insufficient-liquidity");
 // 30D volume fine but a dead week fails the 1/7D floor.
 assert.equal(evaluateMarketSignal(rising,"sell","balanced",undefined,{liquidity:{sales7:0,sales30:12}}).code,"insufficient-liquidity");
 // At the floors, and with unknown counts, the signal evaluates normally.
 assert.ok(evaluateMarketSignal(rising,"sell","balanced",undefined,{liquidity:{sales7:1,sales30:5}}).eligible);
 assert.ok(evaluateMarketSignal(rising,"sell","balanced",undefined,{liquidity:{sales7:null,sales30:null}}).eligible);
 assert.ok(evaluateMarketSignal(rising,"sell","balanced").eligible);
});

test("v2 anchors on winsorized percentiles: one glitch mark no longer defines the low",()=>{
 // A single $2 flash-crash mark inside an otherwise-flat $10 series. v1 measures the
 // buy distance against the $2 raw minimum (~400% away — far outside every cutoff);
 // v2's 10th-percentile floor sits near $10, so the same series reads as near its low.
 const glitch=series([10,10.2,10.1,9.9,2,10.1,10,10.2,9.9,10,10.1,9.9,10,10.05]);
 assert.equal(evaluateMarketSignal(glitch,"buy","aggressive",10.05).code,"outside-adaptive-cutoff");
 const v2=evaluateMarketSignal(glitch,"buy","aggressive",10.05,{model:"v2"});
 assert.ok(v2.eligible,`v2 should qualify near the robust low (got ${v2.code}: ${v2.detail})`);
 assert.match(v2.signal.reason,/typical low/);
 // Sell mirror: one spiked mark cannot define the high either.
 const spike=series([10,10.2,10.1,9.9,50,10.1,10,10.2,9.9,10,10.1,9.9,10,10.15]);
 assert.equal(evaluateMarketSignal(spike,"sell","aggressive",10.15).code,"outside-adaptive-cutoff");
 assert.ok(evaluateMarketSignal(spike,"sell","aggressive",10.15,{model:"v2"}).eligible);
});
test("v2 keeps the stabilization gate: sitting on the robust floor is not a buy",()=>{
 // Current at/below the 10th-percentile floor clamps distance to 0 — no bounce evidence.
 assert.equal(evaluateMarketSignal(series([20,18,16,14,12,10]),"buy","aggressive",undefined,{model:"v2"}).code,"awaiting-stabilization");
});
test("v2 sell gate: a breakout in progress is not a sell (v1 still fires)",()=>{
 // Flat base then a strong accelerating climb: at the high with momentum building.
 const breakout=series([...Array.from({length:25},()=>10),10.4,10.8,11.2,11.6,12,12.4,12.8,13.2,13.6,14]);
 assert.ok(evaluateMarketSignal(breakout,"sell","aggressive").eligible,"v1 keeps its sell");
 assert.equal(evaluateMarketSignal(breakout,"sell","aggressive",undefined,{model:"v2"}).code,"breakout-continuation");
 // Once momentum stalls at the high, the v2 sell qualifies again.
 const stalled=series([...Array.from({length:20},()=>10),11,12,13,13.5,14,...Array.from({length:10},()=>14)]);
 assert.ok(evaluateMarketSignal(stalled,"sell","aggressive",undefined,{model:"v2"}).eligible);
});

test("signal evaluation explains each non-qualification path",()=>{
 assert.equal(evaluateMarketSignal([],"buy","balanced").code,"missing-current-price");
 assert.equal(evaluateMarketSignal(series([10]),"buy","balanced",10).code,"insufficient-history");
 assert.equal(evaluateMarketSignal(series([10,20,20]),"buy","conservative",20).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(series([10,10.1,10.1]),"buy","conservative",10.1).code,"below-minimum-score");
});
