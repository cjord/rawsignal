import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCollectionQuery,serializeCollectionQuery,updateCollectionQuery,collectionDefaults} from '../app/state/collection-query.ts';
import {collectionCsv,holdingCsv,soldCsv} from '../core/domain/collection-export.ts';
import {collectionHealth,matchesHoldingHealth} from '../core/domain/collection-health.ts';
import {collectionHoldings,emptyCollections} from '../core/domain/owned-collections.ts';
const product={kind:'single',game:'riftbound',productId:1,printing:'Normal',name:' =IMPORTXML("bad")',set:'Origins',rarity:'Rare',image:null,cents:1000,source:'database',asOf:'2026-10-21T00:00:00Z'};
const state={...emptyCollections(),collections:[{id:'personal',name:'Personal',cardShow:true,createdAt:'2026-10-21T00:00:00Z'}],lots:[{id:'lot',collectionId:'personal',product,quantity:3,costCents:null,stickerCents:0,addedAt:'2026-10-21T00:00:00Z',source:'manual'}]};
test('collection query state round-trips scopes, coverage, all views and sold filters without transient action parameters',()=>{
 const value={...collectionDefaults,collection:'personal',query:'A & B',health:'missing-cost',page:2,section:'sold',soldQ:'Card',soldEvent:'show',soldSort:'profit',soldDirection:'asc'};
 assert.deepEqual(parseCollectionQuery(serializeCollectionQuery(value)),value);assert.equal(serializeCollectionQuery(collectionDefaults),'');assert.ok(!serializeCollectionQuery(parseCollectionQuery('add=123&reviewImport=1')).includes('add='));
 for(const raw of ['page=0','page=-2','page=1001','page=Infinity','page=1.5'])assert.equal(parseCollectionQuery(raw).page,1);
 assert.equal(parseCollectionQuery('health=made-up&view=nope&section=nope').health,'all');assert.equal(updateCollectionQuery(value,{query:'changed'}).page,1);assert.equal(updateCollectionQuery(value,{page:3}).page,3);
});
test('coverage filters treat missing information separately from legitimate zero values',()=>{
 const missing=collectionHoldings(state,[]);assert.equal(matchesHoldingHealth(missing[0],'missing-price'),true);assert.equal(matchesHoldingHealth(missing[0],'missing-cost'),true);assert.equal(matchesHoldingHealth(missing[0],'missing-sticker'),false);
 const priced=collectionHoldings(state,[{...product,cents:0}]);assert.equal(collectionHealth(priced).missingPrices,0);assert.equal(collectionHealth(priced).missingCosts,1);assert.equal(collectionHealth(priced).missingStickers,0);
});
test('CSV exports neutralize untrusted spreadsheet formulas while preserving numeric losses, quotes and unavailable values',()=>{
 const csv=collectionCsv([['Name','Profit','Unknown'],[' \t=CMD("bad")',-12.34,null],['Safe, "quoted"\nname',0,undefined]]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\' \t=CMD(""bad"")"'));assert.ok(csv.includes('"-12.34",""'));assert.ok(csv.includes('"Safe, ""quoted""\nname"'));
 for(const text of ['+1','-1','@SUM(A1)','\tformula','\rformula'])assert.ok(collectionCsv([[text]]).includes('"\''));
});
test('owned-lot CSV distinguishes unit market, quantity, historical basis and optional sticker prices',()=>{
 const csv=holdingCsv(collectionHoldings(state,[product]),state.collections);assert.ok(csv.includes('Unit Market USD'));assert.ok(csv.includes('Unit Sticker USD'));assert.ok(csv.includes('"3","10","10","","0"'));assert.ok(csv.includes('"\' =IMPORTXML(""bad"")"'));
});
test('sold exports preserve allocations and leave legacy identity and unknown cost/profit unavailable',()=>{
 const sales=[{id:'allocation',collectionId:'personal',lotId:'removed',quantity:1,netCents:2000,costCents:null,date:'2026-10-21T00:00:00Z',name:'Old Sale'}],csv=soldCsv(sales,state.collections,[]);
 assert.ok(csv.includes('"Old Sale","","1","20","",""'));assert.ok(csv.includes('Allocation ID'));assert.ok(!csv.includes('NaN'));
});
