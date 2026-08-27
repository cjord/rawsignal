import assert from "node:assert/strict";
import test from "node:test";
import {INFO_HINT_WIDTH,infoHintAlignment} from "../app/hooks/info-hint.ts";

test("centers the tooltip when both edges have room",()=>{
 assert.equal(infoHintAlignment(500,1000),"center");
 assert.equal(infoHintAlignment(INFO_HINT_WIDTH/2,1000),"center");
});

test("start-aligns near the left viewport edge",()=>{
 assert.equal(infoHintAlignment(40,1000),"start");
 assert.equal(infoHintAlignment(INFO_HINT_WIDTH/2-1,1000),"start");
});

test("end-aligns near the right viewport edge",()=>{
 assert.equal(infoHintAlignment(980,1000),"end");
 assert.equal(infoHintAlignment(1000-INFO_HINT_WIDTH/2+1,1000),"end");
});

test("honors a custom tooltip width",()=>{
 assert.equal(infoHintAlignment(90,1000,150),"center");
 assert.equal(infoHintAlignment(70,1000,150),"start");
});
