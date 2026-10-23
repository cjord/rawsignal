import type {D1DatabaseLike} from './repository.ts';
import type {AdminRun} from '../core/domain/admin.ts';
export async function adminAccountSummary(db:D1DatabaseLike,identity:D1DatabaseLike=db){
 const now=new Date().toISOString();
 if(identity!==db){
  const owners=await identity.prepare(`SELECT (SELECT COUNT(*) FROM auth_user) AS accounts,(SELECT COUNT(*) FROM auth_session WHERE expiresAt>?) AS activeSessions,(SELECT COALESCE(MAX(count),0) FROM auth_rate_limit WHERE key=?) AS emailAttemptsToday`).bind(now,'otp-day:'+now.slice(0,10)).first<{accounts:number;activeSessions:number;emailAttemptsToday:number}>();
  const saves=await db.prepare('SELECT COUNT(*) AS documents,COALESCE(SUM(length(CAST(value_json AS BLOB))),0) AS documentBytes FROM account_documents').first<{documents:number;documentBytes:number}>();
  if(!owners||!saves)throw new Error('Account summary unavailable');return {...owners,...saves};
 }
 const row=await db.prepare(`SELECT (SELECT COUNT(*) FROM auth_user) AS accounts,
 (SELECT COUNT(*) FROM auth_session WHERE expiresAt>?) AS activeSessions,
 (SELECT COUNT(*) FROM account_documents) AS documents,
 (SELECT COALESCE(SUM(length(CAST(value_json AS BLOB))),0) FROM account_documents) AS documentBytes,
 (SELECT COALESCE(MAX(count),0) FROM auth_rate_limit WHERE key=?) AS emailAttemptsToday`).bind(now,'otp-day:'+now.slice(0,10)).first<{accounts:number;activeSessions:number;documents:number;documentBytes:number;emailAttemptsToday:number}>();
 if(!row)throw new Error('Account summary unavailable');return row;
}
export async function adminPublishedRuns(db:D1DatabaseLike){
 const sources=['daily-market','product-details','metrics-rollup','history-signals','graded-rotation'];
 const results=await Promise.all(sources.map(async source=>{
  const row=await db.prepare(`SELECT i.id AS runId,i.status,i.started_at AS startedAt,i.completed_at AS completedAt,i.source_updated_at AS sourceUpdatedAt,i.records_written AS recordsWritten FROM refresh_state r JOIN ingestion_runs i ON i.id=r.ingestion_run_id WHERE r.key=? AND i.status='succeeded'`).bind(source).first<Omit<AdminRun,'source'>>();
  return {source,runId:null,status:null,startedAt:null,completedAt:null,sourceUpdatedAt:null,recordsWritten:null,...row};
 }));return results;
}
export async function adminHeatmapStatus(db:D1DatabaseLike){const result=await db.prepare('SELECT game,source_date AS sourceDate,computed_at AS computedAt,algorithm_version AS algorithmVersion FROM set_heatmap_snapshots ORDER BY game').all<{game:string;sourceDate:string;computedAt:string;algorithmVersion:number}>();if(!result.results)throw new Error('Heatmap status unavailable');return result.results}
