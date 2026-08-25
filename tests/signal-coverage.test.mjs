import assert from "node:assert/strict";
import test from "node:test";
import {selectSignalCandidates} from "../app/data/signal-coverage.ts";

const cards=(section,count)=>Array.from({length:count},(_,index)=>({id:`${section}-${index}`,section,price:count-index}));

test("fallback coverage is proportional across selected rarities",()=>{
 const source=[...cards("illustration-rares",499),...cards("special-illustration-rares",222)];
 const selected=selectSignalCandidates(source,400,card=>card.section);
 assert.equal(selected.length,400);
 assert.equal(selected.filter(card=>card.section==="illustration-rares").length,277);
 assert.equal(selected.filter(card=>card.section==="special-illustration-rares").length,123);
 assert.equal(new Set(selected.map(card=>card.id)).size,400);
});

test("fallback coverage spans the full existing order inside every rarity",()=>{
 const source=[...cards("illustration-rares",499),...cards("special-illustration-rares",222)];
 const selected=selectSignalCandidates(source,400,card=>card.section);
 for(const section of ["illustration-rares","special-illustration-rares"]){
  const group=selected.filter(card=>card.section===section);
  assert.equal(group[0].id,`${section}-0`);
  assert.equal(group.at(-1).id,`${section}-${section==="illustration-rares"?498:221}`);
 }
});

test("a rarity below the fallback limit receives complete evaluation",()=>{
 const source=cards("special-illustration-rares",222);
 assert.deepEqual(selectSignalCandidates(source,400,card=>card.section),source);
});
