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
 // v2's 10th-percentile floor sits near $10, so the same series reads as near its low
 // (the short fixture then fails on score, not on distance — that IS the proof).
 const glitch=series([10,10.2,10.1,9.9,2,10.1,10,10.2,9.9,10,10.1,9.9,10,10.05]);
 assert.equal(evaluateMarketSignal(glitch,"buy","aggressive",10.05).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(glitch,"buy","aggressive",10.05,{model:"v2"}).code,"below-minimum-score");
 // Sell mirror: one spiked mark cannot define the high either (v2 sees it near the
 // robust high; the week is still up, so it waits for the roll-over instead).
 const spike=series([10,10.2,10.1,9.9,50,10.1,10,10.2,9.9,10,10.1,9.9,10,10.15]);
 assert.equal(evaluateMarketSignal(spike,"sell","aggressive",10.15).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(spike,"sell","aggressive",10.15,{model:"v2"}).code,"awaiting-rollover");
});
test("v2 keeps the stabilization gate: sitting on the robust floor is not a buy",()=>{
 // Current at/below the 10th-percentile floor clamps distance to 0 — no bounce evidence.
 assert.equal(evaluateMarketSignal(series([20,18,16,14,12,10]),"buy","aggressive",undefined,{model:"v2"}).code,"awaiting-stabilization");
});
test("v2.2 buy scoring: cohort breadth lifts the score; co-movement no longer dampens (P4 reversal)",()=>{
 // 35 daily points: flat $20, a ~15% slide, flat floor, then a confirmed bounce — a
 // v2-qualifying aggressive buy with high confidence.
 const prices=[...Array.from({length:10},()=>20),...Array.from({length:18},(_,i)=>20-(i+1)*(3/18)),17,17,17,17,17,17,17.25];
 const points=prices.map((price,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),price}));
 const plain=evaluateMarketSignal(points,"buy","aggressive",undefined,{model:"v2"});
 assert.ok(plain.eligible,`fixture should qualify (got ${plain.code}: ${plain.detail})`);
 assert.equal(plain.signal.confidence,"high");
 // The cohort fell the same ~14%: the calibration sweep showed co-moving recoveries
 // OUTPERFORM (79% vs 70%), so confidence is untouched — the dampener is gone.
 const cohortWide=evaluateMarketSignal(points,"buy","aggressive",undefined,{model:"v2",cohort:{logReturn30:Math.log(.86),breadth:null}});
 assert.equal(cohortWide.signal.confidence,"high");
 assert.doesNotMatch(cohortWide.signal.detail,/moved with its cohort/);
 // Breadth carries the cohort context now: a broadly-rising cohort scores higher than
 // a broadly-falling one.
 const broad=evaluateMarketSignal(points,"buy","aggressive",undefined,{model:"v2",cohort:{logReturn30:null,breadth:80}});
 const narrow=evaluateMarketSignal(points,"buy","aggressive",undefined,{model:"v2",cohort:{logReturn30:null,breadth:20}});
 assert.ok(broad.eligible&&broad.signal.score>(narrow.score??narrow.signal?.score??0));
});

test("v2 sales bump: heavy realized volume lifts confidence one tier (P5)",()=>{
 // A rolled-over sell fixture (off the high, fading week), 20 points → medium confidence.
 const fading=series([...Array.from({length:16},()=>10),11,12,13,14,14,13.9,13.8,13.7,13.6,13.5,13.45,13.4]);
 const plain=evaluateMarketSignal(fading,"sell","balanced",undefined,{model:"v2"});
 assert.ok(plain.eligible,`fixture should qualify (got ${plain.code}: ${plain.detail})`);
 assert.equal(plain.signal.confidence,"medium");
 const bumped=evaluateMarketSignal(fading,"sell","balanced",undefined,{model:"v2",liquidity:{sales7:4,sales30:25}});
 assert.equal(bumped.signal.confidence,"high");
 assert.match(bumped.signal.detail,/25 sales\/30D backing/);
 // Below the bump threshold nothing changes; v1 never bumps.
 assert.equal(evaluateMarketSignal(fading,"sell","balanced",undefined,{model:"v2",liquidity:{sales7:2,sales30:12}}).signal.confidence,"medium");
});

test("v2 sell gates: breakouts and unconfirmed highs are not sells; a rolled-over high is (v1 unchanged)",()=>{
 // Flat base then a strong accelerating climb: at the high with momentum building.
 const breakout=series([...Array.from({length:25},()=>10),10.4,10.8,11.2,11.6,12,12.4,12.8,13.2,13.6,14]);
 assert.ok(evaluateMarketSignal(breakout,"sell","aggressive").eligible,"v1 keeps its sell");
 assert.equal(evaluateMarketSignal(breakout,"sell","aggressive",undefined,{model:"v2"}).code,"breakout-continuation");
 // Stalled AT the high (flat week, zero distance): still no confirmed roll-over.
 const stalled=series([...Array.from({length:20},()=>10),11,12,13,13.5,14,...Array.from({length:10},()=>14)]);
 assert.equal(evaluateMarketSignal(stalled,"sell","aggressive",undefined,{model:"v2"}).code,"awaiting-rollover");
 // Off the high with a fading week: the v2.1 sell qualifies.
 const rolled=series([...Array.from({length:18},()=>10),11,12,13,14,14,13.9,13.8,13.7,13.6,13.5,13.45,13.4]);
 const sell=evaluateMarketSignal(rolled,"sell","aggressive",undefined,{model:"v2"});
 assert.ok(sell.eligible,`rolled-over fixture should qualify (got ${sell.code}: ${sell.detail})`);
});

test("signal evaluation explains each non-qualification path",()=>{
 assert.equal(evaluateMarketSignal([],"buy","balanced").code,"missing-current-price");
 assert.equal(evaluateMarketSignal(series([10]),"buy","balanced",10).code,"insufficient-history");
 assert.equal(evaluateMarketSignal(series([10,20,20]),"buy","conservative",20).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(series([10,10.1,10.1]),"buy","conservative",10.1).code,"below-minimum-score");
});
