import type {D1DatabaseLike} from './repository.ts';
import type {AdminAccountHealth,AdminQuality,AdminJobs} from '../core/domain/admin.ts';

export async function recordSyncHealth(db:D1DatabaseLike,userId:string,key:string,outcome:'saved'|'conflict'|'invalid',now=new Date().toISOString()){
 // Metadata only. Telemetry must not turn an acknowledged save into a failure.
 try{await db.prepare('INSERT INTO account_sync_health(user_id,usage_date,document_key,outcome,count,updated_at) VALUES(?,?,?,?,1,?) ON CONFLICT(user_id,usage_date,document_key,outcome) DO UPDATE SET count=count+1,updated_at=excluded.updated_at').bind(userId,now.slice(0,10),key,outcome,now).run()}catch{/* Migration/telemetry failure never changes save acknowledgement. */}
}
export async function adminAccountHealth(db:D1DatabaseLike,id:string):Promise<AdminAccountHealth>{
 const now=new Date().toISOString(),account=await db.prepare('SELECT id,createdAt,emailVerified FROM auth_user WHERE id=?').bind(id).first<{id:string;createdAt:string;emailVerified:number}>();
 if(!account)return {account:null,providers:[],activeSessions:0,documents:[],sync:[],asOf:now};
 const providers=await db.prepare('SELECT providerId AS provider,createdAt AS linkedAt FROM auth_account WHERE userId=? ORDER BY providerId LIMIT 10').bind(id).all<AdminAccountHealth['providers'][number]>();
 const sessions=await db.prepare('SELECT COUNT(*) AS count FROM auth_session WHERE userId=? AND expiresAt>?').bind(id,now).first<{count:number}>();
 const documents=await db.prepare('SELECT document_key AS key,revision,length(CAST(value_json AS BLOB)) AS bytes,updated_at AS updatedAt FROM account_documents WHERE user_id=? ORDER BY document_key LIMIT 25').bind(id).all<AdminAccountHealth['documents'][number]>();
 const sync=await db.prepare('SELECT usage_date AS date,document_key AS key,outcome,count,updated_at AS updatedAt FROM account_sync_health WHERE user_id=? AND usage_date>=? ORDER BY usage_date DESC,document_key,outcome LIMIT 100').bind(id,new Date(Date.now()-30*86400000).toISOString().slice(0,10)).all<AdminAccountHealth['sync'][number]>();
 return {account:{...account,emailVerified:!!account.emailVerified},providers:providers.results??[],activeSessions:sessions?.count??0,documents:documents.results??[],sync:sync.results??[],asOf:now};
}
export async function adminCatalogQuality(db:D1DatabaseLike):Promise<AdminQuality>{
 const marker=await db.prepare("SELECT r.ingestion_run_id AS id,i.records_written AS expectedRows FROM refresh_state r JOIN ingestion_runs i ON i.id=r.ingestion_run_id WHERE r.key='daily-market' AND i.status='succeeded'").first<{id:string;expectedRows:number}>();
 const empty={runId:marker?.id??null,expectedRows:marker?.expectedRows??null,groups:[],sets:[],candidates:[],asOf:new Date().toISOString()};if(!marker)return empty;
 // Exclude an in-flight live walk. History checks are product coverage, not proof
 // that every printing/condition has an exact matching version.
 const from=`FROM catalog_products p LEFT JOIN current_prices cp ON cp.product_id=p.product_id AND cp.ingestion_run_id=p.ingestion_run_id WHERE p.ingestion_run_id=?`;
 const history="EXISTS(SELECT 1 FROM market_metrics m WHERE m.product_id=p.product_id AND m.history_snapshot_id IS NOT NULL)";
 const groups=await db.prepare(`SELECT p.kind,p.game,COUNT(*) total,SUM(CASE WHEN cp.market_cents IS NULL THEN 1 ELSE 0 END) missingPrice,SUM(CASE WHEN p.image_url IS NULL OR trim(p.image_url)='' THEN 1 ELSE 0 END) missingArtwork,SUM(CASE WHEN ${history} THEN 0 ELSE 1 END) missingHistory ${from} GROUP BY p.kind,p.game ORDER BY p.kind,p.game`).bind(marker.id).all<AdminQuality['groups'][number]>();
 const sets=await db.prepare(`SELECT p.game,p.set_name AS "set",COUNT(*) total,COUNT(cp.market_cents) priced,SUM(CASE WHEN ${history} THEN 1 ELSE 0 END) history ${from} GROUP BY p.game,p.set_name ORDER BY total DESC,p.game,p.set_name LIMIT 50`).bind(marker.id).all<AdminQuality['sets'][number]>();
 const candidates=await db.prepare(`SELECT p.game,p.name,p.set_name AS "set",COALESCE(p.printing,'Normal') printing,COUNT(*) count ${from} GROUP BY p.kind,p.game,p.name,p.set_name,COALESCE(p.printing,'Normal'),p.rarity,p.card_number HAVING COUNT(*)>1 ORDER BY count DESC,p.game,p.name LIMIT 25`).bind(marker.id).all<AdminQuality['candidates'][number]>();
 return {...empty,groups:groups.results??[],sets:sets.results??[],candidates:candidates.results??[]};
}
export async function adminJobs(db:D1DatabaseLike,emailLimit:number):Promise<AdminJobs>{
 const now=new Date().toISOString(),date=now.slice(0,10);
 const runs=await db.prepare('SELECT source,id AS runId,status,started_at AS startedAt,completed_at AS completedAt,source_updated_at AS sourceUpdatedAt,records_written AS recordsWritten,records_rejected AS rejected,CASE WHEN error_message IS NULL THEN 0 ELSE 1 END AS hasError FROM ingestion_runs ORDER BY started_at DESC,id DESC LIMIT 20').all<AdminJobs['runs'][number]>();
 const email=await db.prepare('SELECT count FROM auth_rate_limit WHERE key=?').bind('otp-day:'+date).first<{count:number}>();
 const ebay=await db.prepare('SELECT calls,on_demand_calls AS interactive FROM ebay_api_usage WHERE usage_date=?').bind(date).first<{calls:number;interactive:number}>();
 let applied:string[]|null=null;try{const rows=await db.prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 100').all<{name:string}>();applied=rows.results?.map(row=>row.name)??null}catch{/* Local fixtures may not have Wrangler's migration ledger. */}
 return {runs:(runs.results??[]).map(row=>({...row,hasError:!!row.hasError})),budgets:[{name:'Email Send Attempts',used:email?.count??0,limit:emailLimit,date,description:'Recorded UTC budget claims, not delivered emails.'},{name:'eBay Interactive Calls',used:ebay?.interactive??0,limit:4000,date,description:'Stored daily counter; not the provider dashboard.'},{name:'eBay Total Calls',used:ebay?.calls??0,limit:null,date,description:'Recorded usage only; no upstream request is made.'}],migrations:['0024_accounts.sql','0025_recovery_and_admin_audit.sql','0026_admin_health_and_auction_profiles.sql'].map(name=>({name,applied:applied?applied.includes(name):null})),asOf:now};
}
