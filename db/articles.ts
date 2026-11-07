import type {D1DatabaseLike} from './repository.ts';
import {articleNextState,articleProductKey,articleReviewProblems,articleReferenceSnapshots,inspectArticleMarkdown,publicArticleDraft,type ArticleAction,type ArticleDraft,type ArticleProduct,type ArticleRecord,type ArticleReference,type ArticleRelease,type ArticleState,type ArticleSummary,type PublicArticle} from '../core/domain/articles.ts';
import {articleNameKey,articleProductQuery,articleProductSearchNames,resolveArticleProductName,type ArticleNamedProduct} from '../core/domain/article-product-links.ts';
import {readyCatalogRun} from './readiness.ts';
import {articleBoundLookup,type ArticleBinding} from '../core/domain/article-authoring.ts';

type Stored={id:string;slug:string;head_revision:number;state:ArticleState;published_revision:number|null;published_at:string|null;first_published_at:string|null;created_at:string;updated_at:string;content_json:string;references_json:string};
export class ArticleError extends Error{status:number;constructor(message:string,status=409){super(message);this.status=status}}
const record=(r:Stored):ArticleRecord=>({id:r.id,revision:r.head_revision,state:r.state,publishedRevision:r.published_revision,publishedAt:r.published_at,createdAt:r.created_at,updatedAt:r.updated_at,draft:JSON.parse(r.content_json),references:JSON.parse(r.references_json)});
export async function readAdminArticle(db:D1DatabaseLike,id:string,revision?:number){
 const row=await db.prepare(`SELECT a.*,r.content_json,r.references_json FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=${revision?'?':'a.head_revision'} WHERE a.id=?`).bind(...(revision?[revision,id]:[id])).first<Stored>();
 if(!row)return null;const result=record(row);if(revision)result.revision=revision;return result;
}
export async function articleRevisions(db:D1DatabaseLike,id:string,before=Number.MAX_SAFE_INTEGER){
 const rows=await db.prepare('SELECT revision,created_at AS createdAt FROM article_revisions WHERE article_id=? AND revision<? ORDER BY revision DESC LIMIT 21').bind(id,before).all<{revision:number;createdAt:string}>();
 const entries=rows.results??[];return {rows:entries.slice(0,20),nextBefore:entries.length>20?entries[19].revision:null};
}
export async function listArticles(db:D1DatabaseLike,options:{admin?:boolean;game?:string;category?:string;query?:string;page?:number}={}){
 const where=[options.admin?'1=1':'a.published_revision IS NOT NULL'],args:unknown[]=[];
 for(const [key,value] of [['game',options.game],['category',options.category]]as const)if(value){where.push(`json_extract(r.content_json,'$.${key}')=?`);args.push(value)}
 if(options.query){where.push("(json_extract(r.content_json,'$.title') LIKE ? ESCAPE '\\' OR json_extract(r.content_json,'$.setName') LIKE ? ESCAPE '\\')");const q=`%${options.query.replace(/[\\%_]/g,'\\$&')}%`;args.push(q,q)}
 const page=options.page??1,join=`FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=${options.admin?'a.head_revision':'a.published_revision'} WHERE ${where.join(' AND ')}`;
 const fields=['title','summary','game','category','setName','byline'].map(k=>`json_extract(r.content_json,'$.${k}') AS ${k}`).join(',');
 const [count,data]=await Promise.all([db.prepare(`SELECT COUNT(*) AS total ${join}`).bind(...args).first<{total:number}>(),db.prepare(`SELECT a.id,a.slug,r.revision,a.state,a.published_revision AS publishedRevision,a.published_at AS publishedAt,a.updated_at AS updatedAt,${fields} ${join} ORDER BY ${options.admin?'a.updated_at':'a.published_at'} DESC,a.id DESC LIMIT 12 OFFSET ?`).bind(...args,(page-1)*12).all<ArticleSummary>()]);
 const rows=(data.results??[]).map(row=>options.admin?row:{slug:row.slug,title:row.title,summary:row.summary,game:row.game,category:row.category,setName:row.setName,byline:row.byline,revision:row.revision,publishedAt:row.publishedAt});
 return {rows,page,pages:Math.max(1,Math.ceil((count?.total??0)/12)),total:count?.total??0};
}
export async function readPublicArticle(db:D1DatabaseLike,slug:string,revision?:number):Promise<PublicArticle|null>{
 const row=await db.prepare(`SELECT a.*,r.content_json,r.references_json,r.revision AS selected_revision,l.published_at AS release_date FROM articles a JOIN article_revisions r ON r.article_id=a.id AND r.revision=${revision?'?':'a.published_revision'} JOIN article_releases l ON l.article_id=a.id AND l.revision=r.revision WHERE a.slug=? AND a.published_revision IS NOT NULL`).bind(...(revision?[revision,slug]:[slug])).first<Stored&{selected_revision:number;release_date:string}>();
 if(!row)return null;
 const releases=(await db.prepare('SELECT revision,published_at AS publishedAt,note FROM article_releases WHERE article_id=? ORDER BY revision DESC LIMIT 50').bind(row.id).all<ArticleRelease>()).results??[];
 return {...publicArticleDraft(JSON.parse(row.content_json)),revision:row.selected_revision,publishedAt:row.release_date,firstPublishedAt:row.first_published_at!,references:JSON.parse(row.references_json),releases};
}
export async function readArticleProducts(db:D1DatabaseLike,targets:Pick<ArticleReference,'kind'|'productId'>[]):Promise<ArticleProduct[]>{
 if(!targets.length)return [];if(targets.length>40)throw new ArticleError('Too many product references.',400);
 const published=await readyCatalogRun(db),args=targets.map(t=>t.productId);
 const rows=await db.prepare(`SELECT p.product_id AS productId,p.kind,p.name,p.game,p.set_name AS setName,p.card_number AS number,p.printing,p.image_url AS image,c.market_cents AS market,c.median_cents AS mid,m.history_snapshot_id AS snapshotId,m.as_of_date AS asOfDate,m.change_7_bps AS change7,m.change_30_bps AS change30,m.low_30_cents AS low30,m.high_30_cents AS high30,m.regime FROM catalog_products p LEFT JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=? LEFT JOIN market_metrics m ON m.product_id=p.product_id AND m.variant=COALESCE(p.printing,'Sealed') AND m.condition=CASE WHEN p.kind='single' THEN 'Near Mint' ELSE 'Unopened' END WHERE p.product_id IN (${args.map(()=>'?').join(',')})`).bind(published?.runId??'',...args).all<{productId:number;kind:'single'|'sealed';name:string;game:string;setName:string;number:string|null;printing:string|null;image:string|null;market:number|null;mid:number|null;snapshotId:string|null;asOfDate:string|null;change7:number|null;change30:number|null;low30:number|null;high30:number|null;regime:string|null}>();
 const dollars=(v:number|null)=>v==null?null:v/100,keys=new Set(targets.map(articleProductKey));
 return (rows.results??[]).filter(r=>keys.has(articleProductKey(r))).map(r=>({kind:r.kind,productId:r.productId,name:r.name,set:r.setName,game:r.game,number:r.number??'',printing:r.printing??'Sealed',image:r.image,marketPrice:dollars(r.market),midPrice:dollars(r.mid),metrics:{snapshotId:r.snapshotId??undefined,asOfDate:r.asOfDate??undefined,change7:dollars(r.change7),change30:dollars(r.change30),low30:dollars(r.low30),high30:dollars(r.high30),regime:r.regime}}));
}
async function articleNameCandidates(db:D1DatabaseLike,names:string[]){
 const wanted=names.flatMap(query=>articleProductSearchNames(query).map(name=>({lookupName:articleNameKey(query),name,pattern:name.replace(/[\\%_]/g,'\\$&')+' (%)',set:articleProductQuery(query)?.set??''})));
 if(!wanted.length)return {groups:new Map<string,ArticleNamedProduct[]>(),overflow:new Set<string>()};
 const rows=await db.prepare(`WITH candidates AS (
  SELECT DISTINCT json_extract(w.value,'$.lookupName') AS lookupName,p.product_id AS productId,p.kind,p.name,p.set_name AS setName,p.card_number AS number
  FROM json_each(?) w JOIN catalog_products p ON p.name=(json_extract(w.value,'$.name')) COLLATE NOCASE OR p.name LIKE (json_extract(w.value,'$.pattern')) ESCAPE '\\'
  WHERE json_extract(w.value,'$.set')='' OR p.set_name=json_extract(w.value,'$.set') COLLATE NOCASE
 ), matches AS (
  SELECT *,COUNT(*) OVER (PARTITION BY lookupName) AS total,ROW_NUMBER() OVER (PARTITION BY lookupName ORDER BY productId) AS position FROM candidates
 ) SELECT * FROM matches WHERE position<=25`).bind(JSON.stringify(wanted)).all<{lookupName:string;productId:number;kind:'single'|'sealed';name:string;setName:string;number:string|null;total:number}>();
 const groups=new Map<string,ArticleNamedProduct[]>(),overflow=new Set<string>();
 for(const row of rows.results??[]){if(row.total>25)overflow.add(row.lookupName);const entries=groups.get(row.lookupName)??[];entries.push({...row,set:row.setName,number:row.number??''});groups.set(row.lookupName,entries)}
 return {groups,overflow};
}
export async function resolveArticleProducts(db:D1DatabaseLike,targets:Pick<ArticleReference,'kind'|'productId'|'aliases'>[],names:string[]=[]){
 if(targets.length+names.length>40)throw new ArticleError('At most 40 product references are supported.',400);
 const aliases=new Map(targets.map(p=>[articleProductKey(p),p.aliases??[]]));
 const {groups,overflow}=await articleNameCandidates(db,names);
 for(const name of names){
  const query=articleNameKey(name);if(overflow.has(query))continue;
  const product=resolveArticleProductName(name,groups.get(query)??[]);if(!product)continue;
  targets=[...targets,product];const key=articleProductKey(product);aliases.set(key,[...new Set([...(aliases.get(key)??[]),name])]);
 }
 const products=await readArticleProducts(db,[...new Map(targets.map(p=>[articleProductKey(p),p])).values()]);
 return products.map(p=>({...p,aliases:aliases.get(articleProductKey(p))??[]}));
}
function auditMutation(db:D1DatabaseLike,id:string,op:string,actor:string,action:string,revision:number,now:string){
 return db.prepare("INSERT INTO admin_audit_events(id,occurred_at,actor_id,actor_role,action,target_type,target_id,outcome,request_id,reason_code,event_bucket) SELECT ?,?,?,'admin',?,'article',id,'allowed',?,?,? FROM articles WHERE id=? AND last_operation_id=?").bind(op,now,actor,`admin.article.${action}`,op,`revision:${revision}`,op,id,op);
}
async function checkMutation(db:D1DatabaseLike,id:string,operation:string){
 const result=await db.prepare('SELECT last_operation_id AS operation FROM articles WHERE id=?').bind(id).first<{operation:string}>();
 if(result?.operation!==operation)throw new ArticleError('The article changed. Your text is preserved; load the latest revision before continuing.');
 return (await readAdminArticle(db,id))!;
}
export async function saveArticleDraft(db:D1DatabaseLike,actor:string,input:{id?:string;revision:number;draft:ArticleDraft;bindings?:ArticleBinding[]},now=new Date().toISOString()){
 const old=input.id?await readAdminArticle(db,input.id):null;
 if(input.id&&!old)throw new ArticleError('Article not found.',404);
 if(old&&old.revision!==input.revision)throw new ArticleError('A newer revision exists. Your text has not been overwritten.');
 if(!old&&input.revision!==0)throw new ArticleError('Invalid initial revision.',400);
 if(old?.publishedAt)throw new ArticleError('Published articles are read-only. Write a new article for follow-up coverage.');
 const inspected=inspectArticleMarkdown(input.draft.markdown),lookup=articleBoundLookup(inspected,old?.references,old?.draft.markdown,input.bindings);
 const products=await resolveArticleProducts(db,lookup.products,lookup.names);
 if(input.bindings?.some(b=>!products.some(p=>articleProductKey(p)===articleProductKey(b))))throw new ArticleError('A restored product is unavailable. Resolve its exact printing before saving.',400);
 const references=articleReferenceSnapshots(products,old?.references??[],inspected.names,lookup.products);
 const id=old?.id??crypto.randomUUID(),revision=(old?.revision??0)+1,operation=crypto.randomUUID(),slug=input.draft.slug||`draft-${id}`;
 const head=old?db.prepare("UPDATE articles SET slug=?,head_revision=?,state='draft',updated_at=?,last_operation_id=? WHERE id=? AND head_revision=? AND first_published_at IS NULL").bind(slug,revision,now,operation,id,input.revision):db.prepare("INSERT INTO articles(id,slug,head_revision,state,created_at,updated_at,last_operation_id) VALUES(?,?,?,'draft',?,?,?)").bind(id,slug,revision,now,now,operation);
 await db.batch([head,db.prepare('INSERT INTO article_revisions(article_id,revision,content_json,references_json,author_id,created_at) SELECT id,?,?,?,?,? FROM articles WHERE id=? AND last_operation_id=?').bind(revision,JSON.stringify(input.draft),JSON.stringify(references),actor,now,id,operation),auditMutation(db,id,operation,actor,'save',revision,now)]);
 return checkMutation(db,id,operation);
}
export async function transitionArticle(db:D1DatabaseLike,actor:string,id:string,revision:number,action:ArticleAction,note:string,reviewed:boolean,now=new Date().toISOString()){
 const old=await readAdminArticle(db,id);if(!old)throw new ArticleError('Article not found.',404);
 if(old.revision!==revision)throw new ArticleError('A newer revision exists. Review it before taking this action.');
 if(old.publishedAt&&!['unpublish','archive'].includes(action))throw new ArticleError('Published articles are read-only. Write a new article for follow-up coverage.');
 let state:ArticleState;try{state=articleNextState(old.state,action)}catch{throw new ArticleError('This action is not available for the current revision.')}

 if(['approve','publish'].includes(action)&&!reviewed)throw new ArticleError('Confirm review of this exact saved revision.',400);
 if(['submit','approve','publish'].includes(action)){
  const current=await readArticleProducts(db,old.references),available=new Set(current.map(articleProductKey));
  const problems=articleReviewProblems(old.draft,old.references.filter(r=>available.has(articleProductKey(r))),Date.parse(now));if(problems.length)throw new ArticleError(problems.join(' '),400);
 }
 if(action==='unpublish'&&!old.publishedRevision)throw new ArticleError('The article is already unpublished.');
 const operation=crypto.randomUUID(),publish=action==='publish',remove=['unpublish','archive'].includes(action);
 const update=db.prepare(`UPDATE articles SET state=?,published_revision=${publish?'head_revision':remove?'NULL':'published_revision'},published_at=${publish?'?':'published_at'},first_published_at=${publish?'COALESCE(first_published_at,?)':'first_published_at'},updated_at=?,last_operation_id=? WHERE id=? AND head_revision=? AND state=? AND COALESCE(published_revision,0)=?${remove?'':' AND first_published_at IS NULL'}`).bind(state,...(publish?[now,now]:[]),now,operation,id,revision,old.state,old.publishedRevision??0);
 const statements=[update];
 if(publish)statements.push(db.prepare('INSERT INTO article_releases(article_id,revision,published_at,note) SELECT id,head_revision,?,? FROM articles WHERE id=? AND last_operation_id=? ON CONFLICT(article_id,revision) DO NOTHING').bind(now,note,id,operation));
 statements.push(auditMutation(db,id,operation,actor,action,revision,now));await db.batch(statements);return checkMutation(db,id,operation);
}
