import type {D1DatabaseLike} from './repository.ts';
import type {AccountDocument,AccountKey} from '../core/domain/account-data.ts';
import {COLLECTIONS_KEY} from '../core/domain/owned-collections.ts';

export async function accountDocuments(db:D1DatabaseLike,userId:string,includeCollections=true):Promise<AccountDocument[]>{
 const result=await db.prepare('SELECT document_key AS key,value_json AS value,revision,updated_at AS updatedAt FROM account_documents WHERE user_id=? AND (?=1 OR document_key<>?)').bind(userId,Number(includeCollections),COLLECTIONS_KEY).all<AccountDocument>();return result.results??[];
}
// One atomic compare-and-swap. A deleted/missing row cannot be recreated from an
// obsolete revision. Returned null means conflict, never permission to overwrite.
export async function writeAccountDocument(db:D1DatabaseLike,userId:string,key:AccountKey,value:string,base:number){
 return db.prepare(`INSERT INTO account_documents(user_id,document_key,value_json,revision,updated_at)
 SELECT ?,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM account_documents WHERE user_id=? AND document_key=? AND revision=?)
 ON CONFLICT(user_id,document_key) DO UPDATE SET value_json=excluded.value_json,revision=account_documents.revision+1,updated_at=excluded.updated_at
 WHERE account_documents.revision=? RETURNING document_key AS key,value_json AS value,revision,updated_at AS updatedAt`)
 .bind(userId,key,value,new Date().toISOString(),base,userId,key,base,base).first<AccountDocument>();
}
