import assert from "node:assert/strict";
import test from "node:test";
import { fetchTcgplayerHistory } from "../core/clients/tcgplayer-history.ts";
import { handleStagingJob, loadStagingSnapshot } from "../worker/staging-jobs.ts";

const card={game:"pokemon",section:"illustration-rares",productId:1,name:"Card",set:"Set",year:2026,rarity:"Illustration Rare",number:"1/1",image:"https://example.test/card.jpg",url:"https://example.test/card",marketPrice:10,lowPrice:9,midPrice:10,highPrice:11,printing:"Holofoil",priceChange:null};
const sealed={game:"pokemon",productId:2,name:"Box",set:"Set",category:"Booster Boxes",image:null,url:"https://example.test/box",msrp:null,marketPrice:20,midPrice:21,profit:null,profitPct:null,msrpSource:null};
const assets={fetch:async input=>{const filename=new URL(input.url??input).pathname.split("/").at(-1);return Response.json(filename==="illustration-rares.json"?[card]:filename==="sealed-pokemon.json"?[sealed]:[])}};

test("staging snapshot loads and validates the shared bundled feeds",async()=>{
 const snapshot=await loadStagingSnapshot(new Request("https://staging.example.test/__ops/staging-jobs"),assets,"2026-08-25T12:00:00.000Z");
 assert.deepEqual(snapshot.cards,[card]);assert.deepEqual(snapshot.sealed,[sealed]);assert.equal(snapshot.sourceUpdatedAt,"2026-08-25T12:00:00.000Z");
});

test("staging job endpoint is hidden outside staging and requires its bearer token",async()=>{
 const request=token=>new Request("https://staging.example.test/__ops/staging-jobs",{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify({job:"daily"})});
 const base={ASSETS:assets,DB:{},STAGING_JOB_TOKEN:"secret"};
 assert.equal((await handleStagingJob(request("secret"),{...base,ENVIRONMENT:"production"})).status,404);
 assert.equal((await handleStagingJob(request(),{...base,ENVIRONMENT:"staging"})).status,401);
 assert.equal((await handleStagingJob(request("wrong"),{...base,ENVIRONMENT:"staging"})).status,401);
});

test("the TCGplayer client keys sealed series Sealed/Unopened with exact coverage whatever variant the API reports (R3)",async()=>{
 const sealedFetcher=async url=>Response.json({result:[{variant:"Normal",language:"English",condition:"Unopened",buckets:[{marketPrice:"120",bucketStartDate:String(url).includes("annual")?"2025-09-01":"2026-08-20"}]}]});
 const box=await fetchTcgplayerHistory(2,"Sealed",true,sealedFetcher);
 assert.deepEqual([box.variant,box.condition,box.coverage,box.points.map(point=>point.price)],["Sealed","Unopened","exact",[120,120]]);
 // Singles keep the API's variant and the printing-match coverage rule.
 const single=await fetchTcgplayerHistory(1,"Holofoil",false,async()=>Response.json({result:[{variant:"Normal",language:"English",condition:"Near Mint",buckets:[{marketPrice:"5",bucketStartDate:"2026-08-20"}]}]}));
 assert.deepEqual([single.variant,single.condition,single.coverage],["Normal","Near Mint","fallback"]);
});

test("shared TCGplayer client merges annual depth with the quarterly series",async()=>{
 const series=range=>range==="quarter"?[{variant:"Holofoil",language:"English",condition:"Near Mint",buckets:[{marketPrice:"12",bucketStartDate:"2026-08-20"}]}]:[{variant:"Holofoil",language:"English",condition:"Near Mint",buckets:[{marketPrice:"8",bucketStartDate:"2025-09-01"}]}];
 const fetcher=async input=>Response.json({result:series(new URL(input).searchParams.get("range"))});
 const result=await fetchTcgplayerHistory(1,"Holofoil",false,fetcher);
 assert.equal(result.coverage,"exact");assert.deepEqual(result.points,[{date:"2025-09-01",price:8},{date:"2026-08-20",price:12}]);
});
