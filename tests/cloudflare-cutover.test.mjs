import assert from "node:assert/strict";
import test from "node:test";
import {prepareDeploymentConfig} from "../scripts/cloudflare/prepare-deployment.mjs";
import {compareCatalogEndpoints} from "../scripts/cloudflare/catalog-parity.mjs";
import {decideScheduledAction} from "../worker/scheduled-decision.ts";

const base={name:"raw-signal",main:"index.js",d1_databases:[{binding:"DB",database_name:"local",database_id:"00000000-0000-4000-8000-000000000000"}],assets:{directory:"../client"},triggers:{crons:["0 5 * * *"]}};
const databaseId="123e4567-e89b-42d3-a456-426614174000";

test("staging config keeps Cron disabled and binds assets plus an isolated D1 database",()=>{
 const config=prepareDeploymentConfig(base,{environment:"staging",databaseId,databaseName:"raw-signal-staging",workerName:"raw-signal-staging"});
 assert.equal(config.name,"raw-signal-staging");assert.equal(config.workers_dev,true);assert.equal(config.preview_urls,true);
 assert.deepEqual(config.triggers,{});assert.equal(config.assets.binding,"ASSETS");assert.equal(config.images.binding,"IMAGES");assert.equal(config.version_metadata.binding,"CF_VERSION_METADATA");assert.equal(config.vars.ENVIRONMENT,"staging");assert.equal(config.d1_databases[0].binding,"DB");assert.equal(config.d1_databases[0].database_id,databaseId);assert.equal(config.d1_databases[0].migrations_dir,"../../drizzle");
 assert.equal("routes" in config,false);
});

test("production config requires an explicit hostname and never inherits a schedule",()=>{
 assert.throws(()=>prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal"}),/custom-domain/);
 const config=prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal",route:"cards.example.com"});
 assert.equal(config.workers_dev,false);assert.equal(config.vars.ENVIRONMENT,"production");assert.deepEqual(config.routes,[{pattern:"cards.example.com",custom_domain:true}]);assert.deepEqual(config.triggers,{});
});

test("staging config can opt into a guard cron while production never carries one",()=>{
 const withCron=prepareDeploymentConfig(base,{environment:"staging",databaseId,databaseName:"raw-signal-staging",workerName:"raw-signal-staging",cron:"*/2 * * * *"});
 assert.deepEqual(withCron.triggers,{crons:["*/2 * * * *"]});
 const production=prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal",route:"cards.example.com",cron:"*/2 * * * *"});
 assert.deepEqual(production.triggers,{});
});

test("scheduled ticks advance due work and never start history backfills",()=>{
 const snapshotUpdatedAt="2026-08-27T19:00:00.000Z",dailyTodayRunId="daily-market:2026-08-27",detailsTodayRunId="product-details:2026-08-27";
 const dailyDone={dailyPublishedUpdatedAt:snapshotUpdatedAt,dailyPublishedRunId:dailyTodayRunId};
 const detailsDone={detailsPublishedUpdatedAt:snapshotUpdatedAt,detailsPublishedRunId:detailsTodayRunId};
 const decide=overrides=>decideScheduledAction({snapshotUpdatedAt,dailyPublishedUpdatedAt:null,dailyPublishedRunId:null,dailyTodayRunId,detailsPublishedUpdatedAt:null,detailsPublishedRunId:null,detailsTodayRunId,historyCheckpointRunId:null,historyPublishedRunId:null,...overrides});
 // A snapshot with no completed ingestion is due, whether the mismatch is absence or staleness.
 assert.equal(decide({}),"daily");
 assert.equal(decide({dailyPublishedUpdatedAt:"2026-08-26T00:00:00.000Z",dailyPublishedRunId:"daily-market:2026-08-26",historyCheckpointRunId:"history-backfill:2026-08-27"}),"daily");
 // A same-day redeploy cannot advance today's completed run: wait for the midnight re-key, don't spin.
 assert.equal(decide({dailyPublishedUpdatedAt:"2026-08-27T10:00:00.000Z",dailyPublishedRunId:dailyTodayRunId}),"idle");
 // Details follow the snapshot-once rule but only after the snapshot's catalog run completed (FK).
 assert.equal(decide(dailyDone),"details");
 assert.equal(decide({...dailyDone,detailsPublishedUpdatedAt:"2026-08-26T00:00:00.000Z",detailsPublishedRunId:"product-details:2026-08-26"}),"details");
 assert.equal(decide({...dailyDone,detailsPublishedUpdatedAt:"2026-08-27T10:00:00.000Z",detailsPublishedRunId:detailsTodayRunId}),"idle");
 // History advances only when an operator-started backfill is checkpointed but not complete.
 assert.equal(decide({...dailyDone,...detailsDone,historyCheckpointRunId:"history-backfill:2026-08-27"}),"history");
 assert.equal(decide({...dailyDone,...detailsDone,historyCheckpointRunId:"history-backfill:2026-08-27",historyPublishedRunId:"history-backfill:2026-08-27"}),"idle");
 assert.equal(decide({...dailyDone,...detailsDone}),"idle");
});

const response=(source,items)=>new Response(JSON.stringify({source,items,total:items.length,page:1,pages:1,perPage:50,facets:{sets:["Set A"],productTypes:[]}}),{headers:{"Content-Type":"application/json"}});
const oneCase=[{name:"sample",params:{mode:"singles",market:"pokemon",rarity:"illustration-rares"}}];

test("catalog parity requires the candidate to prove D1 readiness",async()=>{
 const item={productId:1,game:"pokemon",section:"illustration-rares",name:"Card",set:"Set A",year:2026,rarity:"Illustration Rare",number:"1/1",marketPrice:10,lowPrice:9,midPrice:10,highPrice:11,printing:"Holofoil"};
 const fetcher=async url=>response(url.host==="baseline.test"?"feed":"database",[item]);
 const report=await compareCatalogEndpoints({baseline:"https://baseline.test",candidate:"https://candidate.test",fetcher,cases:oneCase});
 assert.equal(report.pass,true);assert.equal(report.results[0].databaseReady,true);
 const fallback=await compareCatalogEndpoints({baseline:"https://baseline.test",candidate:"https://baseline.test",fetcher,cases:oneCase});
 assert.equal(fallback.pass,false);assert.equal(fallback.results[0].databaseReady,false);
});
