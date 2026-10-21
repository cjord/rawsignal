import assert from 'node:assert/strict';
import test from 'node:test';
import {createFreshnessStore} from '../app/data/freshness-store.ts';
test('freshness coalesces subscribers, expires and never replaces last-good with invalid data',async()=>{
 let calls=0,now=1,value='2026-10-20T00:00:00Z';const store=createFreshnessStore(async()=>{calls++;return Response.json({sourceUpdatedAt:value})},()=>now,10);
 let events=0;const stop=store.subscribe(()=>events++);await Promise.all([store.refresh(),store.refresh()]);assert.equal(calls,1);assert.equal(events,1);assert.equal(store.getSnapshot(),value);await store.refresh();assert.equal(calls,1);stop();now=20;value='bad';await store.refresh();assert.equal(store.getSnapshot(),'2026-10-20T00:00:00Z');value='2026-10-21T00:00:00Z';await store.refresh();assert.equal(store.getSnapshot(),value);assert.equal(store.getServerSnapshot(),null);
});
