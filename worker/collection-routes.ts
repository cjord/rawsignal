import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {writeAccountDocument} from '../db/account-documents.ts';
import {COLLECTIONS_KEY,emptyCollections,parseCollections,validProductRef,type ProductRef,type OwnedCollections} from '../core/domain/owned-collections.ts';
import {applyCollectionAction} from '../core/domain/collection-actions.ts';
import {loadCollectionMarket} from './collection-market.ts';
import {accountJson as json} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
import {communityLimit} from './community-limits.ts';
import {recordSyncHealth} from '../db/admin-health.ts';
export const collectionsEnabled=(env:AccountEnv)=>env.AUTH_COLLECTIONS_ENABLED==='true';
async function actionMarket(request:Request,env:AccountEnv,state:OwnedCollections,action:{type?:string;items?:unknown}){
 if(!['add','review'].includes(action?.type??''))return [];
 let additions:ProductRef[]=[];
 if(action.type==='add'){
  if(!Array.isArray(action.items)||!action.items.every(validProductRef))throw new Error('Invalid product references');additions=action.items;
 }
 return loadCollectionMarket(request,env,[...state.lots.filter(row=>row.quantity>0).map(row=>row.product),...additions]);
}
async function collectionBody(request:Request,env:AccountEnv,userId:string,revision:number){
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 const limited=await communityLimit(env,'write',userId);if(limited)return limited;
 let body;try{body=await boundedJson(request,300000)}catch{return json({error:'Invalid or oversized collection action'},400)}
 if(body?.owner!==userId)return json({error:'The signed-in account changed. Reload before continuing.'},401);
 if(body.revision!==revision)return json({error:'Your collection changed on another device. Reload to review the saved version; no changes were overwritten.'},409);
 return body;
}
async function responseState(request:Request,env:AccountEnv,state:OwnedCollections,revision:number,owner:string){
 let prices:Awaited<ReturnType<typeof loadCollectionMarket>>=[],pricingUnavailable=false;
 try{prices=await loadCollectionMarket(request,env,state.lots.filter(row=>row.quantity>0).map(row=>row.product))}catch{pricingUnavailable=true}
 return json({owner,state,revision,prices,pricingUnavailable});
}
export async function handleCollections(request:Request,env:AccountEnv,userId:string){
 if(!collectionsEnabled(env))return json({error:'Collections are not enabled in this environment'},404);
 const db=env.DB as D1DatabaseLike;
 const stored=await db.prepare('SELECT value_json AS value,revision FROM account_documents WHERE user_id=? AND document_key=?').bind(userId,COLLECTIONS_KEY).first<{value:string;revision:number}>();
 const state=stored?parseCollections(stored.value):emptyCollections(),revision=stored?.revision??0;
 if(request.method==='GET')return responseState(request,env,state,revision,userId);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const body=await collectionBody(request,env,userId,revision);if(body instanceof Response)return body;
 if(body.action?.type==='preview'){
  if(!Array.isArray(body.action.items)||body.action.items.length>1000||!body.action.items.every(validProductRef))return json({error:'Invalid import references'},400);
  return json({owner:userId,prices:await loadCollectionMarket(request,env,body.action.items)});
 }
 let next:OwnedCollections,value:string;
 try{
  const market=await actionMarket(request,env,state,body.action);
  next=applyCollectionAction(state,body.action,market,new Date().toISOString(),()=>crypto.randomUUID());value=JSON.stringify(next);parseCollections(value);
  if(new TextEncoder().encode(value).length>1000000)return json({error:'Collection storage limit reached. Export your records; nothing was partially saved.'},413);
 }catch(cause){return json({error:cause instanceof Error?cause.message:'Unable to update collection'},400)}
  const result=await writeAccountDocument(db,userId,COLLECTIONS_KEY,value,revision);
  if(!result)return json({error:'Your collection changed on another device. Reload before retrying.'},409);
  if(env.AUTH_AUDIT_ENABLED==='true')await recordSyncHealth(db,userId,COLLECTIONS_KEY,'saved');
  return responseState(request,env,next,result.revision,userId);
}
