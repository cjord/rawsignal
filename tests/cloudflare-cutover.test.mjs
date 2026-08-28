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
 assert.deepEqual(config.triggers,{});assert.equal(config.assets.binding,"ASSETS");assert.deepEqual(config.assets.run_worker_first,["/data/*"]);assert.equal(config.images.binding,"IMAGES");assert.equal(config.version_metadata.binding,"CF_VERSION_METADATA");assert.equal(config.vars.ENVIRONMENT,"staging");assert.equal(config.d1_databases[0].binding,"DB");assert.equal(config.d1_databases[0].database_id,databaseId);assert.equal(config.d1_databases[0].migrations_dir,"../../drizzle");
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
 const probeUpdatedAt="2026-08-28T20:05:00Z",deploySnapshotUpdatedAt="2026-08-28T04:00:00.000Z";
 const liveTodayRunId="live-daily:2026-08-28",detailsTodayRunId="product-details:2026-08-28";
 const liveDone={livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:liveTodayRunId};
 const detailsDone={detailsPublishedUpdatedAt:deploySnapshotUpdatedAt,detailsPublishedRunId:detailsTodayRunId};
 const gradedTodayRunId="graded-rotation:2026-08-28",gradedDone={gradedPublishedRunId:gradedTodayRunId};
 const metricsTodayRunId="metrics-rollup:2026-08-28",metricsDone={metricsPublishedRunId:metricsTodayRunId};
 const decide=overrides=>decideScheduledAction({probeUpdatedAt,livePublishedUpdatedAt:null,livePublishedRunId:null,liveTodayRunId,deploySnapshotUpdatedAt,detailsPublishedUpdatedAt:null,detailsPublishedRunId:null,detailsTodayRunId,gradedKeyConfigured:true,gradedPublishedRunId:null,gradedTodayRunId,metricsPublishedRunId:null,metricsTodayRunId,historyCheckpointRunId:null,historyPublishedRunId:null,...overrides});
 // A TCGCSV publish not yet ingested is due, whether the mismatch is absence or staleness.
 assert.equal(decide({...detailsDone}),"live");
 assert.equal(decide({livePublishedUpdatedAt:"2026-08-27T20:04:00Z",livePublishedRunId:"live-daily:2026-08-27",historyCheckpointRunId:"history-backfill:2026-08-27"}),"live");
 // A failed probe (null) skips live and retries next tick.
 assert.equal(decide({probeUpdatedAt:null,...detailsDone,...gradedDone}),"idle");
 // The probe timestamp is the snapshot identity: an ingested publish is never re-observed.
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone}),"idle");
 // At most one live run per day: a same-day re-publish waits for the midnight re-key.
 assert.equal(decide({livePublishedUpdatedAt:"2026-08-28T10:00:00Z",livePublishedRunId:liveTodayRunId,...detailsDone,...gradedDone,...metricsDone}),"idle");
 // Details are keyed to the deploy snapshot, at most once per day.
 assert.equal(decide({...liveDone}),"details");
 assert.equal(decide({...liveDone,detailsPublishedUpdatedAt:"2026-08-27T00:00:00Z",detailsPublishedRunId:"product-details:2026-08-27"}),"details");
 // Graded rotation runs once per day, only when its key is configured.
 assert.equal(decide({...liveDone,...detailsDone}),"graded");
 assert.equal(decide({...liveDone,...detailsDone,gradedPublishedRunId:"graded-rotation:2026-08-27"}),"graded");
 assert.equal(decide({...liveDone,...detailsDone,gradedKeyConfigured:false,...metricsDone}),"idle");
 // Metrics roll up once per day, only after that day's live run completed.
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone}),"metrics");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-27"}),"metrics");
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone}),"idle");
 // History advances only when an operator-started backfill is checkpointed but not complete.
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyCheckpointRunId:"history-backfill:2026-08-27"}),"history");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyCheckpointRunId:"history-backfill:2026-08-27",historyPublishedRunId:"history-backfill:2026-08-27"}),"idle");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone}),"idle");
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
