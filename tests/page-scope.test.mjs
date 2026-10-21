import assert from 'node:assert/strict';
import test from 'node:test';
import {initialSetsScope,parseSetsScope,serializeSetsScope} from '../app/state/sets-scope.ts';
import {initialMetricsScope} from '../app/state/metrics-scope.ts';
import {pageSearch} from '../app/state/page-search.ts';

test('server scopes use the same URL codecs and never guess a device-only market',()=>{
 assert.equal(initialSetsScope(''),null);assert.equal(initialSetsScope('market=bad'),null);
 assert.equal(initialMetricsScope(''),null);assert.equal(initialMetricsScope('market=onepiece'),null);
 assert.deepEqual(initialMetricsScope('mode=sealed&market=onepiece'),{mode:'sealed',market:'onepiece'});
 assert.deepEqual(initialMetricsScope('market=all'),{mode:'singles',market:'all'});
 const scope=initialSetsScope('market=riftbound&view=heatmap&window=30&q=teemo&favorites=1');
 assert.equal(scope.market,'riftbound');assert.equal(scope.view,'heatmap');assert.equal(scope.window,30);assert.equal(scope.query,'teemo');assert.equal(scope.favoritesOnly,true);
 const {requestedMarket,...decoded}=parseSetsScope(serializeSetsScope(scope));assert.deepEqual({...decoded,market:requestedMarket},scope);
});
test('route query conversion preserves first-value semantics without inventing missing values',()=>{
 assert.equal(pageSearch({market:['riftbound','pokemon'],mode:'sealed',q:undefined}),'market=riftbound&mode=sealed');
 assert.equal(pageSearch({market:[]}),'');
});
