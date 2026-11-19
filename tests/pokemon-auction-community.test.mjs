import test from 'node:test';
import assert from 'node:assert/strict';
import {gameTestDb} from './helpers/game-db.mjs';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {emptyAuctionStatistics} from '../core/domain/auction-statistics.ts';
import {ownAuctionProfile,writePublicAuctionSettings,auctionCommunityPage,publicAuctionProfile} from '../db/auction-community.ts';
import {writeAccountDocument} from '../db/account-documents.ts';
import {startIngestion,upsertCard,completeIngestion} from '../db/repository.ts';
import {handleOwnAuctionProfile,handleAuctionCommunity,auctionCommunityPath} from '../worker/auction-community.ts';
import {handleAdminManagement} from '../worker/admin-routes.ts';
import {handleAccountExport} from '../worker/account-export.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
const now=new Date().toISOString(),origin='https://staging.example',pokemonKey='raw-signal-pokemon-auction-v1',riftKey='raw-signal-auction-house-v1';
const state=(market,profit=200)=>({...initialAuctionSave(market),statistics:{...emptyAuctionStatistics(),started:2,settled:2,won:1,profit},showcase:[{productId:1,printing:'Normal',quantity:1},{productId:1,printing:'Normal',quantity:1},{productId:2,printing:'Holofoil',quantity:1}]});
async function fixture(){
 const f=gameTestDb(),db={...f.db,async batch(statements){return (await f.db.batch(statements)).map(row=>({meta:{changes:row.changes}}))}};
 for(const id of ['owner-a','owner-b','admin'])f.sqlite.prepare('INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,public_username) VALUES(?,?,?,1,?,?,?)').run(id,'PRIVATE NAME',id+'@example.test',now,now,'Public '+id);
 for(const id of ['owner-a','owner-b']){await writeAccountDocument(db,id,pokemonKey,JSON.stringify(state('pokemon')),0);await writeAccountDocument(db,id,riftKey,JSON.stringify({...state('riftbound',700),showcase:[]}),0)}
 const card={game:'pokemon',productId:2,name:'Canonical Rare',set:'SV01: Scarlet & Violet',year:2023,rarity:'Ultra Rare',section:'ultra-rares',printing:'Holofoil',number:'2',image:'https://images.example/rare.jpg',url:'',marketPrice:5,lowPrice:null,midPrice:null,highPrice:null,priceChange:null};
 await startIngestion(db,'published','test',now,{sourceUpdatedAt:now});await upsertCard(db,card,now,'published');await completeIngestion(db,'published','daily-market',now,1,1,0,0,{gameStockEnabled:true,gameStockWritten:1});
 f.sqlite.prepare("INSERT INTO game_catalog_stock(product_id,game,section,name,set_name,release_year,rarity,card_number,printing,image_url,source_url,market_cents,observed_at,ingestion_run_id) VALUES(1,'pokemon','pokemon-commons','Canonical Common','SV01: Scarlet & Violet',2023,'Common','1','Normal','https://images.example/common.jpg','',100,?,'published')").run(now);
 const env={DB:db,AUTH_ENABLED:'true',AUTH_BASE_URL:origin,AUTH_AUDIT_ENABLED:'true',AUTH_COMMUNITY_ENABLED:'true',AUTH_COMMUNITY_MODERATION_ENABLED:'true',POKEMON_GAME_CATALOG_ENABLED:'true',POKEMON_AUCTION_COMMUNITY_ENABLED:'true',AUTH_ADMIN_EMAILS:'admin@example.test'};
 return {...f,db,env};
}
const visible={showcasePublic:true,leaderboardPublic:true};
const publish=(f,id='owner-a',market='pokemon')=>writePublicAuctionSettings(f.db,id,visible,true,market);
const board=(f,mode='leaderboard',cursor=null,market='pokemon')=>auctionCommunityPage(f.db,mode,cursor,true,undefined,market);
const profile=(f,id,market='pokemon')=>publicAuctionProfile(f.db,id,true,undefined,market);
const request=(path,body,from=origin)=>new Request(origin+path,{method:body?'PUT':'GET',headers:{Origin:from,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});

test('Pokemon visibility, score projections and resets are independent of Riftbound and private by default',async()=>{
 const f=await fixture();try{
  assert.equal((await ownAuctionProfile(f.db,'owner-a',true,'pokemon')).id,null);assert.equal((await board(f)).rows.length,0);
  const poke=await publish(f);assert.equal((await board(f)).rows[0].profit,200);assert.equal((await board(f,'leaderboard',null,'riftbound')).rows.length,0);
  const rift=await publish(f,'owner-a','riftbound');assert.notEqual(poke.id,rift.id);assert.equal((await board(f,'leaderboard',null,'riftbound')).rows[0].profit,700);
  await writeAccountDocument(f.db,'owner-a',pokemonKey,JSON.stringify(state('pokemon',999)),1);assert.equal((await board(f)).rows[0].profit,999);assert.equal((await board(f,'leaderboard',null,'riftbound')).rows[0].profit,700);
  await writeAccountDocument(f.db,'owner-a',pokemonKey,JSON.stringify(initialAuctionSave('pokemon')),2);assert.equal((await board(f)).rows.length,0);assert.equal((await profile(f,rift.id,'riftbound')).stats.profit,700);
 }finally{f.sqlite.close()}
});

test('Pokemon public values include admitted bulk, exact printing and duplicate slots with unavailable values last',async()=>{
 const f=await fixture();try{const a=await publish(f);await writeAccountDocument(f.db,'owner-b',pokemonKey,JSON.stringify({...state('pokemon'),showcase:[{productId:2,printing:'Holofoil',quantity:1}]}),1);const b=await publish(f,'owner-b');let page=await board(f,'showcases');assert.deepEqual(page.rows.map(r=>r.id),[a.id,b.id]);assert.equal(page.rows[0].showcaseValue,700);assert.equal(page.rows[0].cardCount,3);
  const publicData=await profile(f,a.id);assert.equal(publicData.market,'pokemon');assert.deepEqual(publicData.cards.map(c=>[c.name,c.cents]),[['Canonical Common',100],['Canonical Common',100],['Canonical Rare',500]]);for(const token of ['PRIVATE','@example.test','wallet','inventory','drafts'])assert.ok(!JSON.stringify(publicData).includes(token));
  await writeAccountDocument(f.db,'owner-a',pokemonKey,JSON.stringify({...state('pokemon'),showcase:[{productId:1,printing:'Foil',quantity:1},{productId:2,printing:'Holofoil',quantity:1}]}),1);page=await board(f,'showcases');assert.equal(page.rows[1].id,a.id);assert.equal(page.rows[1].showcaseValue,null);assert.equal(page.rows[1].knownValue,500);
  f.sqlite.prepare("UPDATE ingestion_runs SET stats_json=? WHERE id='published'").run(JSON.stringify({gameStockEnabled:true,gameStockWritten:2}));assert.equal((await profile(f,a.id)).cards[0].cents,null);assert.equal((await profile(f,a.id)).cards[1].cents,500);
 }finally{f.sqlite.close()}
});

test('Pokemon APIs require explicit activation, preserve owner/origin guards and fail closed across markets',async()=>{
 const f=await fixture();try{assert.equal(auctionCommunityPath('/api/games/pokemon/auction-community'),true);assert.equal(auctionCommunityPath('/api/games/pokemon/auction-community-wrong'),false);
  const disabled={...f.env,POKEMON_AUCTION_COMMUNITY_ENABLED:undefined,DB:{prepare(){throw Error('Must not access an unmigrated table')}}};assert.equal((await handleAuctionCommunity(request('/api/games/pokemon/auction-community'),disabled)).status,503);assert.equal((await handleOwnAuctionProfile(request('/api/account/pokemon-auction-profile'),disabled,'owner-a','pokemon')).status,503);
  const own=(body,from)=>handleOwnAuctionProfile(request('/api/account/pokemon-auction-profile',body,from),f.env,'owner-a','pokemon');assert.equal((await own({...visible,owner:'owner-a',userId:'owner-b'})).status,400);assert.equal((await own({...visible,owner:'owner-b'})).status,401);assert.equal((await own(visible)).status,401);assert.equal((await own({...visible,owner:'owner-a'},'https://evil.test')).status,403);
  const response=await own({...visible,owner:'owner-a'}),settings=await response.json();assert.equal(settings.market,'pokemon');assert.equal((await ownAuctionProfile(f.db,'owner-b',true,'pokemon')).id,null);assert.equal((await ownAuctionProfile(f.db,'owner-a',true,'riftbound')).id,null);
  const read=await handleAuctionCommunity(request('/api/games/pokemon/auction-community/'+settings.id),f.env);assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');assert.equal((await handleAuctionCommunity(request('/api/games/auction-community/'+settings.id),f.env)).status,404);
  await own({owner:'owner-a',showcasePublic:false,leaderboardPublic:false});assert.equal((await handleAuctionCommunity(request('/api/games/pokemon/auction-community/'+settings.id),f.env)).status,404);
 }finally{f.sqlite.close()}
});

test('Pokemon moderation is market-scoped, fresh-session protected and atomic with its audit',async()=>{
 const f=await fixture();try{const poke=await publish(f),rift=await publish(f,'owner-a','riftbound'),admin={id:'admin',email:'admin@example.test',emailVerified:true},body={id:poke.id,market:'pokemon',hidden:true,revision:0,reason:'user-request'},call=(value=body,time=new Date())=>handleAdminManagement(request('/api/account/admin/community',value),f.env,admin,time);
  assert.equal((await call(body,new Date(Date.now()-660000))).status,403);assert.equal((await call({...body,market:'wrong'})).status,400);assert.equal((await call()).status,200);assert.equal((await call()).status,409);assert.equal(await profile(f,poke.id),null);assert.ok(await profile(f,rift.id,'riftbound'));
  const audit=f.sqlite.prepare("SELECT target_type FROM admin_audit_events WHERE action='admin.community.hide'").get();assert.equal(audit.target_type,'pokemon-auction-public-profile');assert.equal((await ownAuctionProfile(f.db,'owner-a',true,'pokemon')).moderationHidden,true);
  assert.equal((await call({...body,hidden:false,revision:1,reason:'review-complete'})).status,200);f.sqlite.exec("CREATE TRIGGER reject_poke_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='admin.community.hide' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");await assert.rejects(()=>call({...body,revision:2}),/audit unavailable/);assert.ok(await profile(f,poke.id));
 }finally{f.sqlite.close()}
});

test('Pokemon exports include separate visibility, identity removal hides profiles and deletion cascades new records',async()=>{
 const f=await fixture();try{const poke=await publish(f),rift=await publish(f,'owner-a','riftbound'),owner={id:'owner-a',name:'PRIVATE NAME',email:'owner-a@example.test',emailVerified:true};const exported=await (await handleAccountExport(request('/api/account/export'),f.db,owner,true,true)).json();assert.equal(exported.publicProfile.id,rift.id);assert.equal(exported.pokemonPublicProfile.id,poke.id);assert.ok(exported.documents.some(d=>d.key===pokemonKey));
  const absentIdentity={prepare(){return {bind(){return this},async first(){return null},async all(){return {results:[]}}}}};assert.equal(await publicAuctionProfile(f.db,poke.id,true,absentIdentity,'pokemon'),null);assert.deepEqual((await auctionCommunityPage(f.db,'leaderboard',null,true,absentIdentity,'pokemon')).rows,[]);
  f.sqlite.prepare("DELETE FROM auth_user WHERE id='owner-a'").run();assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pokemon_auction_public_profiles').get().n,0);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pokemon_auction_profile_moderation').get().n,0);assert.equal(await profile(f,rift.id,'riftbound'),null);
 }finally{f.sqlite.close()}
});

test('Pokemon cursors pin the market and paginate separately from Riftbound',async()=>{
 const f=await fixture();try{for(let i=0;i<30;i++){const id='collector-'+i;f.sqlite.prepare('INSERT INTO auth_user(id,name,email,createdAt,updatedAt,public_username) VALUES(?,?,?,?,?,?)').run(id,'Private',id+'@example.test',now,now,'Collector '+i);await writeAccountDocument(f.db,id,pokemonKey,JSON.stringify({...state('pokemon',i),showcase:[]}),0);await publish(f,id)}
  const first=await board(f),second=await board(f,'leaderboard',first.nextCursor);assert.equal(first.market,'pokemon');assert.equal(first.rows.length,25);assert.equal(second.rows.length,5);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,30);assert.equal(JSON.parse(first.nextCursor)[5],'pokemon');await assert.rejects(()=>board(f,'leaderboard',first.nextCursor,'riftbound'),/Invalid community cursor/);
 }finally{f.sqlite.close()}
});

test('Pokemon community configuration cannot inherit activation or bypass its staging/protection/catalog gates',()=>{
 const options={environment:'staging',databaseId:'00000000-0000-4000-8000-000000000001',databaseName:'synthetic',workerName:'raw-signal-staging',accounts:true,authBaseUrl:'https://staging.example',accountTools:true,accountCommunity:true,communityModeration:true,pokemonGameCatalog:true},base={vars:{POKEMON_AUCTION_COMMUNITY_ENABLED:'true'}};
 assert.equal(prepareDeploymentConfig(base,options).vars.POKEMON_AUCTION_COMMUNITY_ENABLED,undefined);assert.equal(prepareDeploymentConfig(base,{...options,pokemonAuctionCommunity:true}).vars.POKEMON_AUCTION_COMMUNITY_ENABLED,'true');
 for(const change of [{accounts:false},{accountTools:false},{accountCommunity:false},{communityModeration:false},{pokemonGameCatalog:false},{environment:'production',route:'example.test'}])assert.throws(()=>prepareDeploymentConfig(base,{...options,...change,pokemonAuctionCommunity:true}));
});
