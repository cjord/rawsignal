import test from 'node:test';
import assert from 'node:assert/strict';
import {base64,importRecoveryKey,encryptRecovery,decryptRecovery,RECOVERY_TTL_MS,validRecoveryDrafts} from '../core/domain/recovery.ts';
test('recovery ciphertext binds account, stream, key and expiry without persisting plaintext',async()=>{
 const key=await importRecoveryKey(base64(crypto.getRandomValues(new Uint8Array(32)))),now=Date.now(),documents=[{key:'raw-signal-theme',value:'light',revision:2}];
 const row=await encryptRecovery(key,{id:'stream',owner:'owner',keyId:'key',createdAt:now,expiresAt:now+RECOVERY_TTL_MS},documents);
 assert.deepEqual(await decryptRecovery(key,row,'owner','key',now),documents);assert.ok(!JSON.stringify(row).includes('light'));
 for(const changed of [{...row,owner:'other'},{...row,id:'other'},{...row,expiresAt:row.expiresAt+1},{...row,ciphertext:row.ciphertext.slice(0,-5)+'AAAAA'}])await assert.rejects(()=>decryptRecovery(key,changed,'owner','key',now));
 await assert.rejects(()=>decryptRecovery(key,row,'other','key',now));await assert.rejects(()=>decryptRecovery(key,row,'owner','key',now+RECOVERY_TTL_MS));
 const other=await importRecoveryKey(base64(crypto.getRandomValues(new Uint8Array(32))));await assert.rejects(()=>decryptRecovery(other,row,'owner','key',now));
 assert.equal(validRecoveryDrafts([...documents,...documents]),false);assert.equal(validRecoveryDrafts([{key:'role',value:'admin',revision:0}]),false);assert.equal(validRecoveryDrafts([{...documents[0],revision:-1}]),false);
});
