import type {D1DatabaseLike} from './repository.ts';
async function claim(db:D1DatabaseLike,key:string,limit:number,window:number,now:number){
 return db.prepare(`INSERT INTO auth_rate_limit(id,key,count,lastRequest) VALUES(?,?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN lastRequest<=? THEN 1 ELSE count+1 END,lastRequest=CASE WHEN lastRequest<=? THEN excluded.lastRequest ELSE lastRequest END
 WHERE lastRequest<=? OR count<? RETURNING count`).bind(key,key,now,now-window,now-window,now-window,limit).first();
}
export async function claimAccountEmail(db:D1DatabaseLike,email:string,dailyLimit=100,now=Date.now()){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase())),hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(!await claim(db,`otp-recipient:${hash}`,1,60000,now))return false;
 return !!await claim(db,`otp-day:${new Date(now).toISOString().slice(0,10)}`,dailyLimit,86400000,now);
}
