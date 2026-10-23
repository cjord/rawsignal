import type {D1DatabaseLike} from '../db/repository.ts';
import {accountDocuments} from '../db/account-documents.ts';
import {ownAuctionProfile} from '../db/auction-community.ts';
import {isAccountKey} from '../core/domain/account-data.ts';
import {accountJson} from './account-http.ts';
type ExportUser={id:string;name:string;email:string;emailVerified:boolean};
export async function handleAccountExport(request:Request,db:D1DatabaseLike,user:ExportUser,community:boolean){
 if(request.method!=='GET')return accountJson({error:'Method not allowed'},405);
 if(new URL(request.url).search)return accountJson({error:'Account export does not accept query parameters'},400);
 const documents=(await accountDocuments(db,user.id)).filter(row=>isAccountKey(row.key)).map(({key,value,revision,updatedAt})=>({key,value,revision,updatedAt}));
 const publicProfile=community?await ownAuctionProfile(db,user.id):null;
 return accountJson({type:'Raw Signal account export',version:1,exportedAt:new Date().toISOString(),profile:{id:user.id,name:user.name,email:user.email,emailVerified:!!user.emailVerified},documents,publicProfile,exclusions:['Authentication credentials and sessions','Recovery encryption keys','Internal security/audit records','Unsynced device-only drafts']});
}
