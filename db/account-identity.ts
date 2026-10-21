import type {D1DatabaseLike} from './repository.ts';

export type VerifiedIdentity={id:string;name:string;email:string;emailVerified:boolean;image?:string|null};
export async function mirrorAccountIdentity(db:D1DatabaseLike,user:VerifiedIdentity){
 // A canonical ID owns local saves. Never merge another local ID by matching email.
 const now=new Date().toISOString();
 await db.prepare(`INSERT INTO auth_user(id,name,email,emailVerified,image,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET email=excluded.email,emailVerified=excluded.emailVerified,image=excluded.image,
 name=CASE WHEN auth_user.public_username IS NULL THEN excluded.name ELSE auth_user.name END,updatedAt=excluded.updatedAt
 WHERE auth_user.email IS NOT excluded.email OR auth_user.emailVerified IS NOT excluded.emailVerified OR auth_user.image IS NOT excluded.image OR (auth_user.public_username IS NULL AND auth_user.name IS NOT excluded.name)`)
 .bind(user.id,user.name,user.email,Number(user.emailVerified),user.image??null,now,now).run();
}

const nextSweep=new WeakMap<object,number>();
export async function reconcileDeletedIdentities(local:D1DatabaseLike,identity:D1DatabaseLike,environment:'staging'|'production',force=false){
 if(!force&&(nextSweep.get(local)??0)>Date.now())return;
 const column=environment==='staging'?'staging_cleaned':'production_cleaned';
 const tasks=await identity.prepare(`SELECT t.user_id AS id FROM auth_deletion_tasks t WHERE t.${column}=0 AND NOT EXISTS(SELECT 1 FROM auth_user u WHERE u.id=t.user_id) ORDER BY t.created_at,t.user_id LIMIT 5`).all<{id:string}>();
 if(!tasks.results)throw new Error('Identity deletion reconciliation unavailable');
 for(const task of tasks.results){
  // Local FK cascades remove only this environment's documents/profile/recovery key.
  await local.prepare('DELETE FROM auth_user WHERE id=?').bind(task.id).run();
  await identity.prepare(`UPDATE auth_deletion_tasks SET ${column}=1 WHERE user_id=?`).bind(task.id).run();
 }
 nextSweep.set(local,Date.now()+60_000);
}
