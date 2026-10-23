import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {accountIdentityImport} from '../scripts/cloudflare/account-identity-import.mjs';
const date='2026-10-21T00:00:00.000Z';
const user={id:'user1',name:"Player's Name",email:'ADMIN@example.test',emailVerified:1,image:null,createdAt:date,updatedAt:date};
const account={id:'link1',accountId:'provider-subject',providerId:'google',userId:'user1',createdAt:date,updatedAt:date,accessToken:'PRIVATE TOKEN'};
test('identity import preserves canonical IDs/provider subjects and explicitly excludes credentials and saves',()=>{
 const result=accountIdentityImport({users:[user],accounts:[account]},['admin@example.test']);assert.equal(result.users,1);assert.equal(result.links,1);assert.ok(!result.sql.includes('PRIVATE TOKEN'));assert.ok(!/auth_session|auth_verification|account_documents|accessToken/.test(result.sql));
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(new URL('../drizzle/identity/0000_shared_identity.sql',import.meta.url),'utf8'));db.exec(result.sql);db.exec(result.sql);assert.equal(db.prepare('SELECT name,email FROM auth_user').get().name,"Player's Name");assert.equal(db.prepare('SELECT email FROM auth_user').get().email,'admin@example.test');const link=db.prepare('SELECT * FROM auth_account').get();assert.equal(link.userId,'user1');assert.equal(link.accessToken,null)}finally{db.close()}
});
test('identity import rejects unverified, non-allowlisted, duplicate and orphaned identities',()=>{
 for(const candidate of [{...user,emailVerified:0},{...user,email:'other@example.test'},{...user,id:"x'); DELETE"}])assert.throws(()=>accountIdentityImport({users:[candidate],accounts:[]},['admin@example.test']));
 assert.throws(()=>accountIdentityImport({users:[user,user],accounts:[]},['admin@example.test']));
 assert.throws(()=>accountIdentityImport({users:[user],accounts:[{...account,userId:'another'}]},['admin@example.test']));
 assert.throws(()=>accountIdentityImport({users:[user],accounts:[{...account,providerId:'untrusted'}]},['admin@example.test']));
});
