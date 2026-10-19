"use client";
import {accountRequestMessage} from '../../core/domain/account-errors';
export class AccountRequestError extends Error{
 readonly status:number;readonly retryAfter:number;
 constructor(message:string,status:number,retryAfter:number){super(message);this.name='AccountRequestError';this.status=status;this.retryAfter=retryAfter}
}
export async function accountRequest(path:string,body?:unknown){
 let response:Response;try{response=await fetch(`/api/auth/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})}catch{throw new AccountRequestError('Unable to reach the account service. Check your connection and try again.',0,0)}
 const retry=Number(response.headers.get('retry-after')),retryAfter=Number.isFinite(retry)&&retry>0?Math.min(Math.ceil(retry),3600):60;
 let data;try{data=await response.json()}catch{throw new AccountRequestError(accountRequestMessage(response.ok?503:response.status),response.status,0)}
 if(!response.ok)throw new AccountRequestError(accountRequestMessage(response.status,typeof data?.code==='string'?data.code:undefined),response.status,retryAfter);
 if(!data||typeof data!=='object')throw new AccountRequestError(accountRequestMessage(503),503,0);
 return data;
}
export const authAction=(path:string,body:unknown)=>accountRequest(path,body);
