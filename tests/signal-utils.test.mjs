import test from "node:test";import assert from "node:assert/strict";import {evaluateMarketSignal,marketSignal} from "../app/signal-utils.ts";
const series=prices=>prices.map((price,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),price}));
test("buy and sell signals explain exact extrema symmetrically",()=>{const buy=marketSignal(series([20,18,16,14,12,10]),"buy","balanced"),sell=marketSignal(series([10,12,14,16,18,20]),"sell","balanced");assert.match(buy.reason,/low/);assert.match(sell.reason,/high/);assert.equal(buy.confidence,"medium");assert.equal(sell.confidence,"medium")});
test("strictness presets widen qualification without excluding low confidence labels",()=>{const points=series([10,12,11,10.2]),conservative=marketSignal(points,"buy","conservative"),aggressive=marketSignal(points,"buy","aggressive");assert.ok(!conservative||aggressive);assert.equal(aggressive?.confidence,"low")});
test("signal evaluation explains each non-qualification path",()=>{
 assert.equal(evaluateMarketSignal([],"buy","balanced").code,"missing-current-price");
 assert.equal(evaluateMarketSignal(series([10]),"buy","balanced",10).code,"insufficient-history");
 assert.equal(evaluateMarketSignal(series([10,20,20]),"buy","conservative",20).code,"outside-adaptive-cutoff");
 assert.equal(evaluateMarketSignal(series([10,10.1,10.1]),"buy","conservative",10.1).code,"below-minimum-score");
});
