import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveMarketQuery} from '../app/state/market-query.ts';
import {resolveMarketScope} from '../app/state/market-scope.ts';
import {isPublicMarketPath} from '../app/account/public-market-path.ts';

test('landing market is resolved before market-dependent rarity defaults, without resetting explicit filters',()=>{
 const resolved=resolveMarketQuery('?q=teemo&view=full&page=3&rarity=signatures','riftbound');
 assert.equal(resolved.market,'riftbound');assert.deepEqual(resolved.rarities,['signatures']);assert.equal(resolved.query,'teemo');assert.equal(resolved.page,3);assert.equal(resolved.view,'full');
 assert.deepEqual(resolveMarketQuery('','riftbound').rarities,['overnumbered']);
 assert.equal(resolveMarketQuery('?market=pokemon','riftbound').market,'pokemon');
 assert.equal(resolveMarketQuery('?market=all','riftbound').market,'all');
 assert.equal(resolveMarketQuery('?mode=sealed&type=Cases','onepiece').market,'onepiece');
 assert.equal(resolveMarketQuery('','onepiece').market,'pokemon');
 assert.equal(resolveMarketQuery('?mode=sealed&market=scalping','riftbound').market,'scalping');
 assert.equal(resolveMarketQuery('',null).market,'pokemon');
});
test('scope policy respects valid explicit All, rejects unsupported markets and preserves per-page fallback',()=>{
 const allowed=['all','pokemon','riftbound'];
 assert.equal(resolveMarketScope('all','riftbound',allowed,'pokemon'),'all');
 assert.equal(resolveMarketScope('bad','riftbound',allowed,'pokemon'),'riftbound');
 assert.equal(resolveMarketScope(null,'onepiece',allowed,'pokemon'),'pokemon');
 assert.equal(resolveMarketScope(null,null,allowed,'all'),'all');
});
test('read-only markets and static Games directory bypass remount; actual game routes retain owner isolation',()=>{
 for(const path of ['/','/games','/sets','/metrics','/cards/123','/sealed/123','/sets/riftbound/origins'])assert.equal(isPublicMarketPath(path),true,path);
 for(const path of ['/account','/collections','/buylist','/import','/games/riftbound-price','/games/riftbound-auction','/games/riftbound-auction/showcase','/admin','/api/account/session','/cards/not-an-id','/sets/account'])assert.equal(isPublicMarketPath(path),false,path);
});
