import assert from 'node:assert/strict';
import test from 'node:test';
import {createLegacyAuctionCatalog} from '../app/data/auction-legacy-catalog.ts';
import {communityLimit} from '../worker/community-limits.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
const card={game:'riftbound',productId:123,printing:'Normal',name:'Card',set:'Origins',rarity:'Rare',section:'rares',image:'https://art.test/card',marketPrice:10,lowPrice:null,midPrice:null,highPrice:null,priceChange:null,number:'1',year:2025,url:''};
test('legacy auction data coalesces readers, expires and preserves last-good prices on failed refresh',async()=>{
 let calls=0,now=1,fail=false;const cache=createLegacyAuctionCatalog(async()=>{calls++;if(fail)return Response.json({},{status:503});return Response.json([card])},()=>now);
 await Promise.all(Array.from({length:8},()=>cache.refresh()));assert.equal(calls,11);assert.equal(cache.getSnapshot().items.length,1);const before=cache.getSnapshot();await cache.refresh();assert.equal(calls,11);now+=300001;await cache.refresh();assert.equal(calls,22);
 fail=true;await cache.refresh(true);assert.equal(calls,33);assert.equal(cache.getSnapshot().items.length,1);assert.equal(cache.getSnapshot().loading,false);assert.match(cache.getSnapshot().error,/Keeping/);assert.equal(cache.getSnapshot().checkedAt,now);assert.notEqual(cache.getSnapshot().items,before.items);
 fail=false;await cache.refresh(true);assert.equal(cache.getSnapshot().error,null);
});
test('legacy catalog deadlines release loading and never publish a partial failed batch',async()=>{
 const cache=createLegacyAuctionCatalog(async url=>url.includes('commons')?new Promise(()=>{}):Response.json([card]),Date.now,5);await cache.refresh();assert.equal(cache.getSnapshot().status,'error');assert.equal(cache.getSnapshot().items.length,0);assert.equal(cache.getSnapshot().loading,false);
});
test('platform burst controls fail closed when enabled, return retry guidance and keep identities out of responses',async()=>{
 assert.equal(await communityLimit({},'read',null),null);
 assert.equal((await communityLimit({AUTH_COMMUNITY_LIMITS_ENABLED:'true'},'read','192.0.2.1')).status,503);
 const keys=[],env={AUTH_COMMUNITY_LIMITS_ENABLED:'true',COMMUNITY_READ_LIMITER:{async limit({key}){keys.push(key);return {success:false}}},ACCOUNT_WRITE_LIMITER:{async limit({key}){keys.push(key);return {success:true}}}};
 const limited=await communityLimit(env,'read','192.0.2.1');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');assert.equal(limited.headers.get('cache-control'),'private, no-store');assert.ok(!(await limited.text()).includes('192.0.2.1'));assert.match(keys[0],/^[a-f0-9]{64}$/);assert.equal(await communityLimit(env,'write','owner-a'),null);assert.notEqual(keys[0],keys[1]);assert.equal((await communityLimit(env,'read',null)).status,503);
 env.COMMUNITY_READ_LIMITER.limit=async()=>{throw new Error('Private binding message')};assert.equal((await communityLimit(env,'read','192.0.2.1')).status,503);
});
test('community protections require explicit deployment choices and discard inherited activation',()=>{
 const options={environment:'staging',databaseId:'00000000-0000-4000-8000-000000000000',databaseName:'fixture',workerName:'fixture'},base={vars:{AUTH_COMMUNITY_LIMITS_ENABLED:'true',AUTH_COMMUNITY_MODERATION_ENABLED:'true'},ratelimits:[{name:'COMMUNITY_READ_LIMITER'}]};
 const off=prepareDeploymentConfig(base,options);assert.equal(off.vars.AUTH_COMMUNITY_LIMITS_ENABLED,'false');assert.equal(off.vars.AUTH_COMMUNITY_MODERATION_ENABLED,'false');assert.equal(off.ratelimits,undefined);
 assert.throws(()=>prepareDeploymentConfig(base,{...options,communityLimits:true}),/requires/);
 const enabled={...options,accounts:true,authBaseUrl:'https://staging.example',accountTools:true,accountCommunity:true,communityLimits:true,communityModeration:true,communityReadNamespace:'91001',accountWriteNamespace:'91002'};
 const config=prepareDeploymentConfig(base,enabled);assert.equal(config.vars.AUTH_COMMUNITY_LIMITS_ENABLED,'true');assert.deepEqual(config.ratelimits.map(row=>row.simple),[{limit:120,period:60},{limit:60,period:60}]);assert.throws(()=>prepareDeploymentConfig(base,{...enabled,accountWriteNamespace:'91001'}),/distinct/);
});
