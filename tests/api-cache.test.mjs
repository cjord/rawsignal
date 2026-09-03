import assert from "node:assert/strict";
import test from "node:test";
import {CACHE_TIERS} from "../app/api/cache.ts";

// The named Cache-Control tiers every API route serves from (decision D6).
const parse=value=>{
 const match=value.match(/^public, max-age=(\d+), s-maxage=(\d+)(?:, stale-while-revalidate=(\d+))?$/);
 assert.ok(match,`malformed tier: ${value}`);
 return {maxAge:Number(match[1]),sMaxAge:Number(match[2]),swr:match[3]==null?null:Number(match[3])};
};

test("every tier is a well-formed public Cache-Control with an edge TTL at least the browser TTL",()=>{
 for(const [name,value] of Object.entries(CACHE_TIERS)){
  const tier=parse(value);
  assert.ok(tier.sMaxAge>=tier.maxAge,`${name}: s-maxage ${tier.sMaxAge} < max-age ${tier.maxAge}`);
 }
});

test("tiers order by edge lifetime and the transient tier never serves stale",()=>{
 const edge=name=>parse(CACHE_TIERS[name]).sMaxAge;
 assert.ok(edge("transient")<edge("short"));
 assert.ok(edge("short")<edge("medium"));
 assert.ok(edge("medium")<edge("long"));
 assert.ok(edge("hour")<=edge("long"));
 assert.equal(parse(CACHE_TIERS.transient).swr,null);
 assert.ok(edge("transient")<=60);
});
