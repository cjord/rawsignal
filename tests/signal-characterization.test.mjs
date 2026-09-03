import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {classifyRegime} from "../core/domain/regime.ts";
import {evaluateMarketSignal} from "../core/signal-utils.ts";

// Characterization pins for the single scoring path and the regime classifier
// (refactor program 2026-09, wave 4): every case's full evaluation — code, score,
// confidence, distance, cutoff, and the human-readable strings — was captured from the
// pre-refactor implementation over hand-built and seeded-random series across both sides,
// all three strictness presets, both models, and four contexts. A change here is a model
// change and belongs in docs/backtests.md with a harness verdict, never in a refactor.
const cases=JSON.parse(readFileSync(new URL("./fixtures/signal-cases.json",import.meta.url),"utf8"));
const demands={none:null,cooling:{recent:5,prior:30,change:-83.3},rising:{recent:40,prior:20,change:100}};

test(`evaluateMarketSignal reproduces ${cases.signals.length} pinned evaluations`,()=>{
 for(const item of cases.signals){
  const context={...(cases.contexts[item.context]??{}),model:item.model};
  const actual=evaluateMarketSignal(cases.fixtures[item.fixture],item.side,item.strictness,undefined,context);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),item.expected,`${item.fixture} ${item.side} ${item.strictness} ${item.model} ${item.context}`);
 }
});

test(`classifyRegime reproduces ${cases.regimes.length} pinned readings`,()=>{
 for(const item of cases.regimes){
  const actual=classifyRegime(cases.fixtures[item.fixture],undefined,demands[item.demand],item.breadth);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),item.expected,`${item.fixture} breadth=${item.breadth} demand=${item.demand}`);
 }
});
