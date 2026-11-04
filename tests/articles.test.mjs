import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {emptyArticleDraft,parseArticleDraft,inspectArticleMarkdown,articleHref,articleLinkProduct,articleReviewProblems,articleRevisionChanges} from '../core/domain/articles.ts';
import {articleProductMarkup,matchArticleProduct} from '../core/domain/article-product-links.ts';
import {saveArticleDraft,transitionArticle,readPublicArticle,listArticles,articleRevisions,readArticleProducts,resolveArticleProducts} from '../db/articles.ts';
import {handlePublicArticles,handleArticleSitemap} from '../worker/article-routes.ts';
import {handleAdminManagement} from '../worker/admin-routes.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
const origin='https://staging.example',now='2026-10-27T12:00:00Z';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>/^\d{4}.*\.sql$/.test(n)).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return this.execute()},execute(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 return {sqlite,db,env:{DB:db,AUTH_ENABLED:'true',AUTH_BASE_URL:origin,AUTH_AUDIT_ENABLED:'true',ARTICLES_ENABLED:'true',AUTH_ADMIN_EMAILS:'editor@example.test'}};
}
const draft=()=>({...emptyArticleDraft(),title:'Radiance outlook',slug:'radiance-outlook',summary:'A concise release outlook.',markdown:'## Outlook\n\nThe release premium should narrow as supply arrives. Our estimates are dated and depend on continued availability.',observedAt:now,targetDate:'2026-11-22',sources:['https://www.tcgplayer.com/'],evidenceNotes:'PRIVATE RESEARCH'});
const request=(path,body,from=origin)=>new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:from,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const admin={id:'private-editor-id',email:'editor@example.test',emailVerified:true};
test('editorial navigation uses document requests across the server-protected admin boundary',()=>{
 // vinext client links failed live acceptance despite direct routes working. The footer's
 // isolated-test link shim must not hide a regression in these auth-boundary controls.
 for(const path of ['../app/articles/ArticleShell.tsx','../app/admin/articles/ArticlesAdmin.tsx']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"]next\/link['"]/);assert.match(source,/<a[^>]+href="\/admin\/articles/);
 }
});
async function publish(db,article,note=''){
 article=await transitionArticle(db,admin.id,article.id,article.revision,'submit','',false,now);
 article=await transitionArticle(db,admin.id,article.id,article.revision,'approve','',true,now);
 return transitionArticle(db,admin.id,article.id,article.revision,'publish',note,true,now);
}
test('article links preserve exact printings and reject unsafe markup without executing HTML',()=>{
 for(const href of ['javascript:alert(1)','data:text/html,x','http://evil.test','https://user:password@evil.test','/cards/1\n'])assert.equal(articleHref(href),null);
 assert.deepEqual(articleLinkProduct('https://rawsignal.cards/cards/123?printing=Foil'),{kind:'single',productId:123});
 assert.equal(articleLinkProduct('https://evil.test/cards/123'),null);
 const inspected=inspectArticleMarkdown('[Signature](/cards/1) and [Overnumbered](/cards/2). [Again](/cards/1)\n\n|Card|\n|---|\n|[Box](/sealed/3)|');
 assert.equal(inspected.products.length,3);
 for(const text of ['<script>alert(1)</script>','[bad](javascript:alert)','![remote](https://evil.test/tracker.png)'])assert.ok(inspectArticleMarkdown(text).problems.length);
 assert.ok(inspectArticleMarkdown(Array.from({length:41},(_,i)=>`[card](/cards/${i+1})`).join(' ')).problems.length);
});

test('double brackets support names, exact identities and tables without interpreting code or nested links',()=>{
 const inspected=inspectArticleMarkdown('## [[Ezreal]]\n\n[[Ezreal]] and [[Signature::single:1]].\n\n|Product|\n|---|\n|[[Radiance Box::sealed:3]]|\n\n`[[Not a card]]`\n\n```text\n[[Not a card either]]\n```\n\n\\[[Escaped]]');
 assert.deepEqual(inspected.names,['Ezreal']);assert.deepEqual(inspected.products,[{kind:'single',productId:1},{kind:'sealed',productId:3}]);assert.deepEqual(inspected.problems,[]);
 for(const markdown of ['[[Missing end','[[Bad::single:0]]','[[Bad::javascript:alert(1)]]','[outer [[Card]]](https://example.test/)'])assert.ok(inspectArticleMarkdown(markdown).problems.length,markdown);
 assert.ok(inspectArticleMarkdown(Array.from({length:41},(_,i)=>`[[Card ${i}]]`).join(' ')).problems.length);
 assert.equal(articleProductMarkup({kind:'sealed',productId:3,name:'Radiance Box'}),'[[Radiance Box::sealed:3]]');
 const ref={kind:'single',productId:1,name:'Ezreal'};
 assert.equal(matchArticleProduct({valid:true,text:'ezreal',target:null},[ref]),ref);
 assert.equal(matchArticleProduct({valid:true,text:'Ezreal',target:null},[ref,{...ref,productId:2}]),undefined);
 assert.ok(articleReviewProblems({...draft(),markdown:draft().markdown+' [[Ambiguous]]'},[]).some(p=>p.includes('no unique product match')));
 assert.ok(articleReviewProblems({...draft(),markdown:draft().markdown+' [Card](/cards/1)'},[ref]).some(p=>p.includes('double brackets')));
});

test('bracket resolution rejects ambiguous names, freezes saved identities and never guesses from a partial name',async()=>{
 const f=fixture();try{
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written) VALUES('test','tcgcsv','succeeded','${now}','${now}',5)`);
  const insert=(id,kind,name)=>f.sqlite.prepare("INSERT INTO catalog_products(product_id,kind,game,name,set_name,printing,source_updated_at,ingestion_run_id) VALUES(?,?,'riftbound',?,'Radiance','Foil',?,'test')").run(id,kind,name,now);
  insert(1,'single','Ezreal');insert(2,'sealed','Radiance Box');insert(3,'single','Ambiguous');insert(4,'single','Ambiguous');
  const products=await resolveArticleProducts(f.db,[],['ezreal','Radiance Box','Ambiguous','Ezr',"' OR 1=1 --"]);
  assert.deepEqual(products.map(p=>p.productId).sort(),[1,2]);
  const article=await saveArticleDraft(f.db,admin.id,{revision:0,draft:{...draft(),markdown:draft().markdown+' [[Ezreal]] [[Radiance Box]]'}},now);
  assert.equal(article.references.length,2);
  insert(5,'single','Ezreal'); // Newly added printing must not retarget the saved revision.
  f.sqlite.prepare("UPDATE catalog_products SET name='Renamed Ezreal' WHERE product_id=1").run();
  await publish(f.db,article);const published=await readPublicArticle(f.db,article.draft.slug);
  assert.equal(published.references.find(p=>p.productId===1).name,'Ezreal');
  const next=await saveArticleDraft(f.db,admin.id,{id:article.id,revision:1,draft:{...article.draft,title:'A revision'}},now);
  assert.equal(next.references.find(p=>p.name==='Ezreal').productId,1);
  const unresolved=await saveArticleDraft(f.db,admin.id,{revision:0,draft:{...draft(),slug:'unresolved',markdown:draft().markdown+' [[Ambiguous]]'}},now);
  await assert.rejects(()=>transitionArticle(f.db,admin.id,unresolved.id,1,'submit','',false,now),/no unique product match/);
  const exact=await saveArticleDraft(f.db,admin.id,{revision:0,draft:{...draft(),slug:'exact',markdown:draft().markdown+' [[Ambiguous::single:3]]'}},now);
  await publish(f.db,exact);assert.equal((await readPublicArticle(f.db,'exact')).references[0].productId,3);
  const response=await handlePublicArticles(request('/api/articles/products?name=Radiance%20Box&name=Ambiguous'),f.env);
  assert.equal(response.status,200);assert.deepEqual((await response.json()).products.map(p=>p.productId),[2]);
  for(const query of ['name=',`name=${'x'.repeat(301)}`,Array.from({length:41},()=>`name=Ezreal`).join('&')])assert.equal((await handlePublicArticles(request('/api/articles/products?'+query),f.env)).status,400);
 }finally{f.sqlite.close()}
});
test('draft parsing strips unknown private properties and review requires evidence and dated forecasts',()=>{
 const value=parseArticleDraft({...draft(),internalToken:'secret',sources:['https://example.test/',''],forecasts:[{productKey:'single:1',low:5,high:10,basis:'delivered',confidence:'low',rationale:'Supply',invalidation:'New shortage',secret:'not public'}]});
 assert.equal(value.byline,'Raw Signal Editorial');assert.equal(value.internalToken,undefined);assert.equal(value.forecasts[0].secret,undefined);assert.equal(value.sources.length,1);
 assert.ok(articleReviewProblems({...draft(),targetDate:'2026-02-30'},[]).length);
 assert.ok(articleReviewProblems({...draft(),observedAt:'2999-01-01'},[]).length);
 assert.ok(articleReviewProblems({...draft(),markdown:'[Unknown](/cards/999) '+draft().markdown},[]).some(p=>p.includes('Resolve product')));
 assert.throws(()=>parseArticleDraft({...draft(),forecasts:[{...value.forecasts[0],low:20,high:10}]}));
});
test('revision comparison includes changed metadata and sources without modifying either draft',()=>{
 const before=draft(),after={...before,title:'Corrected title',markdown:before.markdown+'\nNew evidence.',sources:['https://example.test/']};
 const changes=articleRevisionChanges(before,after);assert.deepEqual(changes.map(c=>c.field),['title','markdown','sources']);assert.ok(changes[1].after.includes('New evidence.'));assert.equal(before.title,'Radiance outlook');
});
test('Articles deployment activation is explicit and requires account auditing',()=>{
 const options={environment:'staging',databaseId:'11111111-1111-4111-8111-111111111111',databaseName:'test',workerName:'test'};
 assert.equal(prepareDeploymentConfig({vars:{ARTICLES_ENABLED:'true'}},options).vars.ARTICLES_ENABLED,'false');
 assert.throws(()=>prepareDeploymentConfig({}, {...options,articles:true}),/require accounts/);
 assert.equal(prepareDeploymentConfig({}, {...options,articles:true,accounts:true,accountTools:true,authBaseUrl:origin}).vars.ARTICLES_ENABLED,'true');
});
test('published pointers isolate draft edits, preserve earlier releases and remove all public versions when unpublished',async()=>{
 const f=fixture();try{
  let article=await saveArticleDraft(f.db,admin.id,{revision:0,draft:draft()},now);
  assert.equal(await readPublicArticle(f.db,'radiance-outlook'),null);assert.equal((await listArticles(f.db)).total,0);
  await assert.rejects(()=>transitionArticle(f.db,admin.id,article.id,1,'publish','',true,now),/not available/);
  article=await publish(f.db,article);assert.equal(article.publishedRevision,1);
  assert.match(await(await handleArticleSitemap(f.env)).text(),/radiance-outlook/);
  let pub=await readPublicArticle(f.db,'radiance-outlook');assert.equal(pub.revision,1);assert.ok(!JSON.stringify(pub).includes('PRIVATE'));assert.ok(!JSON.stringify(pub).includes(admin.id));
  article=await saveArticleDraft(f.db,admin.id,{id:article.id,revision:1,draft:{...draft(),title:'Updated outlook'}},now);
  assert.equal((await readPublicArticle(f.db,'radiance-outlook')).title,'Radiance outlook');assert.equal(await readPublicArticle(f.db,'radiance-outlook',2),null);
  await assert.rejects(()=>saveArticleDraft(f.db,admin.id,{id:article.id,revision:1,draft:draft()},now),/newer revision/);
  article=await transitionArticle(f.db,admin.id,article.id,2,'submit','',false,now);
  await assert.rejects(()=>transitionArticle(f.db,admin.id,article.id,2,'approve','',false,now),/Confirm review/);
  article=await transitionArticle(f.db,admin.id,article.id,2,'approve','',true,now);
  await assert.rejects(()=>transitionArticle(f.db,admin.id,article.id,2,'publish','',true,now),/Describe the correction/);
  article=await transitionArticle(f.db,admin.id,article.id,2,'publish','Updated supply evidence.',true,now);
  assert.equal((await readPublicArticle(f.db,'radiance-outlook')).title,'Updated outlook');assert.equal((await readPublicArticle(f.db,'radiance-outlook',1)).title,'Radiance outlook');
  assert.equal((await readPublicArticle(f.db,'radiance-outlook')).releases.length,2);
  await assert.rejects(()=>saveArticleDraft(f.db,admin.id,{id:article.id,revision:2,draft:{...draft(),slug:'new-url'}},now),/URL is fixed/);
  await transitionArticle(f.db,admin.id,article.id,2,'unpublish','',false,now);
  assert.equal(await readPublicArticle(f.db,'radiance-outlook'),null);assert.equal(await readPublicArticle(f.db,'radiance-outlook',1),null);
  assert.doesNotMatch(await(await handleArticleSitemap(f.env)).text(),/radiance-outlook/);
  assert.equal((await articleRevisions(f.db,article.id)).rows.length,2);
  assert.ok(f.sqlite.prepare("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action LIKE 'admin.article.%'").get().n>=9);
 }finally{f.sqlite.close()}
});
test('an audit write failure rolls back the draft and revision atomically',async()=>{
 const f=fixture();try{
  const article=await saveArticleDraft(f.db,admin.id,{revision:0,draft:draft()},now);
  f.sqlite.exec("CREATE TRIGGER reject_article_audit BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  await assert.rejects(()=>saveArticleDraft(f.db,admin.id,{id:article.id,revision:1,draft:{...draft(),title:'Must roll back'}},now),/audit unavailable/);
  assert.equal(f.sqlite.prepare('SELECT head_revision FROM articles').get().head_revision,1);assert.equal((await articleRevisions(f.db,article.id)).rows.length,1);
 }finally{f.sqlite.close()}
});
test('concurrent edits save one immutable revision and reject the stale writer',async()=>{
 const f=fixture();try{
  const original=await saveArticleDraft(f.db,admin.id,{revision:0,draft:draft()},now);
  const writes=await Promise.allSettled(['A','B'].map(title=>saveArticleDraft(f.db,admin.id,{id:original.id,revision:1,draft:{...draft(),title}},now)));
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.filter(r=>r.status==='rejected').length,1);assert.equal((await articleRevisions(f.db,original.id)).rows.length,2);
 }finally{f.sqlite.close()}
});
test('article product lookup keeps exact identities, current market prices and unavailable values separate from editorial forecasts',async()=>{
 const f=fixture();try{
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written) VALUES('published','tcgcsv','succeeded','${now}','${now}',3);INSERT INTO refresh_state(key,ingestion_run_id,last_success_at) VALUES('daily-market','published','${now}');`);
  for(const [id,kind,name,printing]of [[1,'single','Ezreal Signature','Foil'],[2,'single','Ezreal Overnumbered','Foil'],[3,'sealed','Radiance Box',null]])f.sqlite.prepare("INSERT INTO catalog_products(product_id,kind,game,name,set_name,printing,source_updated_at,ingestion_run_id) VALUES(?,?,'riftbound',?,'Radiance',?,?,'published')").run(id,kind,name,printing,now);
  f.sqlite.prepare("INSERT INTO current_prices(product_id,market_cents,median_cents,observed_at,source,ingestion_run_id) VALUES(1,51000,55000,?,'tcgcsv','published')").run(now);
  f.sqlite.prepare("INSERT INTO market_metrics(product_id,variant,condition,as_of_date,coverage,updated_at,history_snapshot_id) VALUES(1,'Foil','Near Mint','2026-10-27','exact',?,'snapshot-1')").run(now);
  const targets=[{kind:'single',productId:1},{kind:'single',productId:2},{kind:'sealed',productId:3}],products=await readArticleProducts(f.db,targets);
  assert.equal(products.length,3);assert.equal(products.find(p=>p.productId===1).marketPrice,510);assert.equal(products.find(p=>p.productId===1).metrics.snapshotId,'snapshot-1');assert.equal(products.find(p=>p.productId===2).marketPrice,null);assert.equal(products.find(p=>p.productId===3).printing,'Sealed');
  assert.equal((await readArticleProducts(f.db,[{kind:'sealed',productId:1}])).length,0);
  const article=await saveArticleDraft(f.db,admin.id,{revision:0,draft:{...draft(),markdown:draft().markdown+'\n [Ezreal](/cards/1)'}});
  assert.equal(article.references[0].name,'Ezreal Signature');assert.equal(article.references[0].marketPrice,undefined);
 }finally{f.sqlite.close()}
});
test('article APIs enforce admin roles, verified email, origin, feature gates and bounded input',async()=>{
 const f=fixture();try{
  const call=(body,user=admin,from=origin)=>handleAdminManagement(request('/api/account/admin/articles',body,from),f.env,user);
  for(const user of [{...admin,emailVerified:false},{...admin,email:'reader@example.test'}])assert.equal((await call({revision:0,draft:draft()},user)).status,403);
  assert.equal((await call({revision:0,draft:draft()},admin,'https://evil.test')).status,403);
  assert.equal((await call({revision:0,draft:{...draft(),markdown:'x'.repeat(140001)}})).status,400);
  const result=await call({revision:0,draft:draft()});assert.equal(result.status,200);const saved=(await result.json()).article;
  assert.equal((await handlePublicArticles(request('/api/articles'),{...f.env,ARTICLES_ENABLED:'false'})).status,503);
  assert.equal((await handlePublicArticles(request('/api/articles?page=NaN'),f.env)).status,400);
  assert.equal((await handlePublicArticles(request('/api/articles/products?ids=single:1,evil:2'),f.env)).status,400);
  assert.equal((await handlePublicArticles(request('/api/articles/radiance-outlook?revision=1'),f.env)).status,404);
  await publish(f.db,saved);
  const response=await handlePublicArticles(request('/api/articles/radiance-outlook'),f.env);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.status,200);
  const publicData=JSON.stringify(await response.json());assert.ok(!publicData.includes('evidenceNotes'));assert.ok(!publicData.includes(admin.id));
  assert.equal((await handlePublicArticles(request('/api/articles',{evil:true}),f.env)).status,405);
 }finally{f.sqlite.close()}
});
