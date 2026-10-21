import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCollections,collectionHoldings,collectionTotals,parseCollections,productKey,recordReview,reviewMovers} from '../core/domain/owned-collections.ts';
import {applyCollectionAction} from '../core/domain/collection-actions.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {COLLECTIONS_KEY} from '../core/domain/owned-collections.ts';
const product={kind:'single',game:'riftbound',productId:1,printing:'Normal',name:'Test Card',set:'Origins',rarity:'Rare',image:null,cents:1000,source:'database',asOf:'2026-10-21T00:00:00Z'};
let serial=0;const newid=()=>`id${++serial}`;
const act=(state,action,prices=[product],now='2026-10-21T12:00:00Z')=>applyCollectionAction(state,action,prices,now,newid);
function fixture(){let state=act(emptyCollections(),{type:'create',name:'Personal'});const collectionId=state.collections[0].id;state=act(state,{type:'add',collectionId,items:[{...product,quantity:2,costCents:700}]});return {state,collectionId}}
test('dated additions retain separate market baselines; new contributions are not price gains',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,quantity:1,costCents:1500}]},[{...product,cents:2000}],'2026-10-22T12:00:00Z');
 const holdings=collectionHoldings(state,[{...product,cents:2000,asOf:'2026-10-22T00:00:00Z'}]);assert.equal(holdings.length,1);assert.equal(holdings[0].lots.length,2);assert.equal(holdings[0].baseline,4000);assert.equal(holdings[0].value,6000);assert.equal(holdings[0].change,2000);assert.equal(holdings[0].percent,50);assert.equal(holdings[0].profit,3100);
 assert.equal(validAccountValue(COLLECTIONS_KEY,JSON.stringify(state)),true);assert.deepEqual(parseCollections(JSON.stringify(state)),state);
});
test('last three distinct UTC reviews persist; reloads do not alter state and additional copies are excluded from movers',()=>{
 let {state,collectionId}=fixture();state=recordReview(state,[product],collectionId,'2026-10-21T23:59:59Z');const snapshot=JSON.stringify(state);
 collectionHoldings(state,[{...product,cents:1200}]);assert.equal(JSON.stringify(state),snapshot);
 state=act(state,{type:'add',collectionId,items:[{...product,quantity:10}]},[{...product,cents:1200}],'2026-10-22T01:00:00Z');
 const movers=reviewMovers(collectionHoldings(state,[{...product,cents:1200}]),state.reviews[0]);assert.equal(movers[0].change,400);assert.equal(movers[0].comparedQuantity,2);assert.equal(movers[0].addedQuantity,10);
 for(const day of ['22','23','23','24'])state=recordReview(state,[product],collectionId,`2026-10-${day}T12:00:00Z`);
 assert.deepEqual(state.reviews.map(row=>row.date),['2026-10-24','2026-10-23','2026-10-22']);
});
test('unknown prices/costs stay unavailable and older fallback cannot manufacture a market loss',()=>{
 const {state}=fixture();const missing=collectionHoldings(state,[]);assert.equal(missing[0].value,null);assert.equal(missing[0].change,null);assert.equal(collectionTotals(missing).value,null);
 assert.equal(collectionHoldings(state,[{...product,cents:500,source:'feed',asOf:null}])[0].change,null);
 assert.equal(collectionHoldings(state,[{...product,cents:500,asOf:'2026-10-20T00:00:00Z'}])[0].change,null);
 const feed=structuredClone(state);feed.lots[0].product={...product,source:'feed',asOf:null};assert.equal(collectionHoldings(feed,[product])[0].change,null);
});
test('printing, game and kind identity stay distinct; sticker prices do not change market performance',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,printing:'Foil',quantity:1,stickerCents:99999}]},[{...product,printing:'Foil',cents:2000}]);assert.equal(collectionHoldings(state,[product,{...product,printing:'Foil',cents:2000}]).length,2);
 const before=collectionTotals(collectionHoldings(state,[product,{...product,printing:'Foil',cents:2000}]));state=act(state,{type:'lot',lotId:state.lots[0].id,quantity:2,costCents:700,stickerCents:100000});assert.deepEqual(collectionTotals(collectionHoldings(state,[product,{...product,printing:'Foil',cents:2000}])),before);
 assert.notEqual(productKey(product),productKey({...product,kind:'sealed',printing:'Sealed'}));
});
test('sales consume oldest lots, retain historical records and allocate every proceeds cent exactly once',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,quantity:2,costCents:800}]},[product],'2026-10-22T12:00:00Z');state=act(state,{type:'sell',collectionId,key:productKey(product),quantity:3,netCents:3001});assert.deepEqual(state.lots.map(row=>row.quantity),[0,1]);assert.equal(state.sales.length,2);assert.equal(state.sales.reduce((sum,row)=>sum+row.netCents,0),3001);assert.deepEqual(state.sales.map(row=>row.costCents),[1400,800]);parseCollections(JSON.stringify(state));
 const soldId=state.lots[0].id;state=act(state,{type:'remove',lotId:soldId});assert.equal(state.sales.length,2);
});
test('reviewed import skips existing exact printings by default; invalid rows cannot partially mutate a state',()=>{
 const {state,collectionId}=fixture(),before=JSON.stringify(state);const result=act(state,{type:'add',collectionId,skipExisting:true,source:'collectr',items:[{...product,quantity:3}]});assert.equal(result.lots.length,state.lots.length);
 assert.throws(()=>act(state,{type:'add',collectionId,items:[{...product,quantity:1},{...product,productId:999,quantity:1}]}),/unavailable/);assert.equal(JSON.stringify(state),before);
 assert.throws(()=>act(state,{type:'sell',collectionId,key:productKey(product),quantity:3,netCents:1000}),/Not enough/);assert.throws(()=>act(state,{type:'add',collectionId,items:[{...product,quantity:-1}]}),/quantity/);
});
