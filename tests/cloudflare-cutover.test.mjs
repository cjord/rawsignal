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
 // The Collectr full-import worker is reached by service binding (a same-account
 // workers.dev subrequest 404s), and the binding must ride both environments.
 assert.deepEqual(config.services,[{binding:"COLLECTR_FETCH",service:"raw-signal-collectr"}]);
});

test("production config requires an explicit hostname and never inherits a schedule",()=>{
 assert.throws(()=>prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal"}),/custom-domain/);
 const config=prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal",route:"cards.example.com"});
 assert.equal(config.workers_dev,false);assert.equal(config.vars.ENVIRONMENT,"production");assert.deepEqual(config.routes,[{pattern:"cards.example.com",custom_domain:true}]);assert.deepEqual(config.triggers,{});
 // Since the split, production is ingestion's home: an explicit --cron applies there too.
 const scheduled=prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal",route:"cards.example.com",cron:"*/2 * * * *"});
 assert.deepEqual(scheduled.triggers,{crons:["*/2 * * * *"]});
});

test("either environment opts into a guard cron explicitly; none is inherited",()=>{
 const withCron=prepareDeploymentConfig(base,{environment:"staging",databaseId,databaseName:"raw-signal-staging",workerName:"raw-signal-staging",cron:"*/2 * * * *"});
 assert.deepEqual(withCron.triggers,{crons:["*/2 * * * *"]});
 // The base config's schedule never leaks through without an explicit request.
 const production=prepareDeploymentConfig(base,{environment:"production",databaseId,databaseName:"raw-signal-production",workerName:"raw-signal",route:"cards.example.com"});
 assert.deepEqual(production.triggers,{});
});

test("scheduled ticks advance due work and never start history backfills",()=>{
 const probeUpdatedAt="2026-08-28T20:05:00Z",deploySnapshotUpdatedAt="2026-08-28T04:00:00.000Z";
 const liveTodayRunId="live-daily:2026-08-28",detailsTodayRunId="product-details:2026-08-28";
 const liveDone={livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:liveTodayRunId};
 const detailsDone={detailsPublishedUpdatedAt:deploySnapshotUpdatedAt,detailsPublishedRunId:detailsTodayRunId};
 const gradedTodayRunId="graded-rotation:2026-08-28",gradedDone={gradedPublishedRunId:gradedTodayRunId};
 const metricsDone={metricsPublishedRunId:"metrics-rollup:2026-08-28"};
 const decide=overrides=>decideScheduledAction({probeUpdatedAt,livePublishedUpdatedAt:null,livePublishedRunId:null,liveTodayRunId,deploySnapshotUpdatedAt,detailsPublishedUpdatedAt:null,detailsPublishedRunId:null,detailsTodayRunId,gradedKeyConfigured:true,gradedPublishedRunId:null,gradedTodayRunId,metricsPublishedRunId:null,historyCheckpointRunId:null,historyPublishedRunId:null,...overrides});
 // A TCGCSV publish not yet ingested is due, whether the mismatch is absence or staleness.
 assert.equal(decide({...detailsDone}),"live");
 assert.equal(decide({livePublishedUpdatedAt:"2026-08-27T20:04:00Z",livePublishedRunId:"live-daily:2026-08-27",historyCheckpointRunId:"history-backfill:2026-08-27"}),"live");
 // A failed probe (null) skips live and retries next tick.
 assert.equal(decide({probeUpdatedAt:null,...detailsDone,...gradedDone}),"idle");
 // The probe timestamp is the snapshot identity: an ingested publish is never re-observed —
 // the tick moves on to that run's rollup instead (R1).
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone}),"metrics");
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-27",historyPublishedRunId:"history-daily:2026-08-27"}),"idle");
 // At most one live run per day: a same-day re-publish never re-runs live — the tick
 // moves on to the daily history refresh instead (M4).
 assert.equal(decide({livePublishedUpdatedAt:"2026-08-28T10:00:00Z",livePublishedRunId:liveTodayRunId,...detailsDone,...gradedDone,...metricsDone}),"history");
 // Details are keyed to the deploy snapshot, at most once per day.
 assert.equal(decide({...liveDone}),"details");
 assert.equal(decide({...liveDone,detailsPublishedUpdatedAt:"2026-08-27T00:00:00Z",detailsPublishedRunId:"product-details:2026-08-27"}),"details");
 // Graded rotation runs once per day, only when its key is configured.
 assert.equal(decide({...liveDone,...detailsDone}),"graded");
 assert.equal(decide({...liveDone,...detailsDone,gradedPublishedRunId:"graded-rotation:2026-08-27"}),"graded");
 assert.equal(decide({...liveDone,...detailsDone,gradedKeyConfigured:false,...metricsDone,historyPublishedRunId:"history-daily:2026-08-28"}),"idle");
 // Metrics roll up once per day, only after that day's live run completed.
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone}),"metrics");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-27"}),"metrics");
 // R1 (2026-09-03): the rollup is keyed to the PUBLISHED live run's date, not the wall-clock
 // day — a live run for the 08-27 publish that finished after midnight still gets its rollup
 // (metrics-rollup:2026-08-27) and then its tiered history run, on 08-28.
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone}),"metrics");
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-27"}),"history");
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-27",historyPublishedRunId:"history-daily:2026-08-27"}),"idle");
 // A rollup keyed to an OLDER live run does not satisfy the new one.
 assert.equal(decide({livePublishedUpdatedAt:probeUpdatedAt,livePublishedRunId:"live-daily:2026-08-27",...detailsDone,...gradedDone,metricsPublishedRunId:"metrics-rollup:2026-08-26"}),"metrics");
 // No live run published yet (fresh database): nothing to roll up, nothing to refresh.
 assert.equal(decide({probeUpdatedAt:null,...detailsDone,...gradedDone}),"idle");
 // History continues any checkpointed, uncompleted run first (operator backfills too).
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyCheckpointRunId:"history-backfill:2026-08-27"}),"history");
 // Daily tiered refresh (M4): starts once live + metrics landed and no history run
 // dated today has completed — a stale completed backfill does not satisfy the day...
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone}),"history");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyCheckpointRunId:"history-backfill:2026-08-27",historyPublishedRunId:"history-backfill:2026-08-27"}),"history");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyPublishedRunId:"history-daily:2026-08-27"}),"history");
 // ...but either kind of completed run dated today does, and metrics must land first.
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyPublishedRunId:"history-daily:2026-08-28"}),"idle");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone,...metricsDone,historyPublishedRunId:"history-backfill:2026-08-28"}),"idle");
 assert.equal(decide({...liveDone,...detailsDone,...gradedDone}),"metrics");
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
