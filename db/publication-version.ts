import type {D1DatabaseLike} from './repository.ts';
export const PUBLISH_KEYS=['daily-market','product-details','metrics-rollup','history-signals','graded-rotation'] as const;
type VersionRow={key:string;runId:string|null;at:string|null;busy?:number};
const signature=(rows:VersionRow[])=>rows.map(row=>`${row.key}=${row.runId??''}@${row.at??''}`).join(';');
export async function readPublishSignature(db:D1DatabaseLike){
 const rows=await db.prepare(`select key, ingestion_run_id as runId, last_success_at as at from refresh_state where key in (${PUBLISH_KEYS.map(()=>'?').join(',')}) order by key`).bind(...PUBLISH_KEYS).all<VersionRow>();
 return signature(rows.results??[]);
}
export async function readPayloadVersion(db:D1DatabaseLike){
 const rows=await db.prepare(`select key,ingestion_run_id as runId,last_success_at as at,
 exists(select 1 from ingestion_runs where status='running') busy
 from refresh_state where key in (${PUBLISH_KEYS.map(()=>'?').join(',')}) order by key`).bind(...PUBLISH_KEYS).all<VersionRow>();
 if(!rows.results)throw new Error('Publication metadata unavailable');
 return {signature:signature(rows.results),busy:rows.results.some(row=>Boolean(row.busy))};
}
