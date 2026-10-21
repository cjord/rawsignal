import type {D1DatabaseLike} from './repository.ts';
export async function moderationPage(db:D1DatabaseLike,cursor:string|null){
 const result=await db.prepare(`SELECT p.id,u.public_username AS name,p.showcase_public AS showcasePublic,p.leaderboard_public AS leaderboardPublic,COALESCE(m.hidden,0) AS hidden,COALESCE(m.revision,0) AS revision,m.reason_code AS reason,m.updated_at AS updatedAt FROM auction_public_profiles p JOIN auth_user u ON u.id=p.user_id LEFT JOIN auction_profile_moderation m ON m.profile_id=p.id WHERE (p.showcase_public=1 OR p.leaderboard_public=1 OR m.hidden=1) AND p.id>? ORDER BY p.id LIMIT 26`).bind(cursor??'').all<{id:string;name:string;showcasePublic:number;leaderboardPublic:number;hidden:number;revision:number;reason:string|null;updatedAt:string|null}>();
 if(!result.results)throw new Error('Moderation unavailable');const rows=result.results.slice(0,25);
 return {rows:rows.map(row=>({...row,hidden:!!row.hidden,showcasePublic:!!row.showcasePublic,leaderboardPublic:!!row.leaderboardPublic})),nextCursor:result.results.length>25?rows.at(-1)!.id:null};
}
export async function moderateProfile(db:D1DatabaseLike,input:{id:string;hidden:boolean;revision:number;reason:string},actorId:string,requestId:string){
 const at=new Date().toISOString();
 if(!db.batch)throw new Error('Atomic moderation unavailable');
 // Both statements succeed or roll back. A stale revision changes neither state nor audit.
 const result=await db.batch([
  db.prepare(`INSERT INTO auction_profile_moderation(profile_id,hidden,revision,reason_code,updated_at,actor_id,last_request_id) SELECT id,?,1,?,?,?,? FROM auction_public_profiles WHERE id=? AND COALESCE((SELECT revision FROM auction_profile_moderation WHERE profile_id=?),0)=? ON CONFLICT(profile_id) DO UPDATE SET hidden=excluded.hidden,revision=auction_profile_moderation.revision+1,reason_code=excluded.reason_code,updated_at=excluded.updated_at,actor_id=excluded.actor_id,last_request_id=excluded.last_request_id WHERE auction_profile_moderation.revision=?`).bind(Number(input.hidden),input.reason,at,actorId,requestId,input.id,input.id,input.revision,input.revision),
  db.prepare(`INSERT INTO admin_audit_events(id,occurred_at,actor_id,actor_role,action,target_type,target_id,outcome,request_id,reason_code,event_bucket) SELECT ?,?,?,'admin',?,'auction-public-profile',profile_id,'allowed',?,?,NULL FROM auction_profile_moderation WHERE profile_id=? AND last_request_id=?`).bind(crypto.randomUUID(),at,actorId,input.hidden?'admin.community.hide':'admin.community.restore',requestId,input.reason,input.id,requestId),
 ]);
 return (result[0] as {meta?:{changes?:number}})?.meta?.changes===1;
}
