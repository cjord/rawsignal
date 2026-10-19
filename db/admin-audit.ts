import type {D1DatabaseLike} from './repository.ts';
import {ADMIN_ACTIONS,AUDIT_RETENTION_DAYS,type AdminAction,type AuditEvent} from '../core/domain/admin.ts';
export async function appendAdminAudit(db:D1DatabaseLike,event:{actorId:string;actorRole:'member'|'admin';action:AdminAction;outcome:'allowed'|'denied';requestId:string;targetId?:string;reasonCode?:string},now=Date.now()){
 if(!ADMIN_ACTIONS.includes(event.action)||!event.actorId||!['admin','member'].includes(event.actorRole)||!['allowed','denied'].includes(event.outcome))throw new Error('Invalid audit event');
 // Read events and denied probes coalesce per actor/action/minute, not per request.
 const bucket=JSON.stringify([event.actorId,event.action,event.outcome,event.targetId??null,event.reasonCode??null,Math.floor(now/60000)]);
 const recovery=event.action==='recovery.key.access';
 await db.prepare('INSERT INTO admin_audit_events(id,occurred_at,actor_id,actor_role,action,target_type,target_id,outcome,request_id,reason_code,event_bucket) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_bucket) DO NOTHING').bind(crypto.randomUUID(),new Date(now).toISOString(),event.actorId,event.actorRole,event.action,recovery?'account-recovery':event.targetId?'account-metadata':'management',recovery?event.actorId:event.targetId??null,event.outcome,event.requestId,event.outcome==='denied'?'admin_required':event.reasonCode??'authorized',bucket).run();
}
export async function readAdminAudit(db:D1DatabaseLike,query:URLSearchParams,now=Date.now()){
 const action=query.get('action'),actor=query.get('actor'),outcome=query.get('outcome'),cursor=query.get('cursor');
 if(action&&!(ADMIN_ACTIONS as readonly string[]).includes(action))throw new Error('Invalid audit filter');
 if(actor&&(actor.length>128||!/^[a-zA-Z0-9_-]+$/.test(actor)))throw new Error('Invalid audit filter');
 if(outcome&&!['allowed','denied'].includes(outcome))throw new Error('Invalid audit filter');
 let before:{time:string;id:string}|null=null;
 if(cursor){try{const [time,id]=JSON.parse(cursor);if(typeof time!=='string'||!Number.isFinite(Date.parse(time))||typeof id!=='string'||id.length>128)throw new Error();before={time,id}}catch{throw new Error('Invalid audit cursor')}}
 const where=['occurred_at>=?'],args:unknown[]=[new Date(now-AUDIT_RETENTION_DAYS*86400000).toISOString()];
 if(action){where.push('action=?');args.push(action)}if(actor){where.push('actor_id=?');args.push(actor)}if(outcome){where.push('outcome=?');args.push(outcome)}
 if(before){where.push('(occurred_at<? OR (occurred_at=? AND id<?))');args.push(before.time,before.time,before.id)}
 const response=await db.prepare(`SELECT id,occurred_at AS occurredAt,actor_id AS actorId,actor_role AS actorRole,action,target_type AS targetType,target_id AS targetId,outcome,request_id AS requestId,reason_code AS reasonCode FROM admin_audit_events WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT 51`).bind(...args).all<AuditEvent>();
 if(!response.results)throw new Error('Audit unavailable');const rows=response.results.slice(0,50),last=rows.at(-1);
 return {events:rows,nextCursor:response.results.length>50&&last?JSON.stringify([last.occurredAt,last.id]):null,retentionDays:AUDIT_RETENTION_DAYS};
}
// Operator-only maintenance primitive; no browser/API deletion route or new cron.
export async function pruneExpiredAdminAudit(db:D1DatabaseLike,limit=100,now=Date.now()){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid audit cleanup limit');
 return db.prepare('DELETE FROM admin_audit_events WHERE id IN (SELECT id FROM admin_audit_events WHERE occurred_at<? ORDER BY occurred_at LIMIT ?)').bind(new Date(now-AUDIT_RETENTION_DAYS*86400000).toISOString(),limit).run();
}
