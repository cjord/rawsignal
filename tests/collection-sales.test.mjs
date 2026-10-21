import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCollections,collectionHoldings,collectionTotals,parseCollections,productKey,validEventDay} from '../core/domain/owned-collections.ts';
import {collectionPerformance,groupedSales,saleTotals,stickerSaleSuggestion} from '../core/domain/collection-sales.ts';
import {applyCollectionAction} from '../core/domain/collection-actions.ts';
const product={kind:'single',game:'riftbound',productId:1,printing:'Normal',name:'Test Card',set:'Origins',rarity:'Rare',image:null,cents:1200,source:'database',asOf:'2026-10-21T00:00:00Z'};
let serial=0;const act=(state,action)=>applyCollectionAction(state,action,[product],'2026-10-21T12:00:00Z',()=>`entry${++serial}`);
function fixture(){let state=act(emptyCollections(),{type:'create',name:'Personal'});const collectionId=state.collections[0].id;state=act(state,{type:'add',collectionId,items:[{...product,quantity:2,costCents:700,stickerCents:2500}]});return {state,collectionId}}

test('old collections and sales remain readable without event, transaction or product fields',()=>{
 const {state,collectionId}=fixture();let sold=act(state,{type:'sell',collectionId,key:productKey(product),quantity:1,netCents:1500});delete sold.events;for(const row of sold.sales){delete row.saleId;delete row.eventId;delete row.product}
 assert.deepEqual(parseCollections(JSON.stringify(sold)),sold);assert.equal(groupedSales(sold.sales).length,1);assert.equal(groupedSales(sold.sales)[0].profit,800);
});

test('event dates, paid expenses, limits and references are validated without rewriting prior sales',()=>{
 let {state}=fixture();assert.equal(validEventDay('2026-02-30'),false);assert.equal(validEventDay('2028-02-29'),true);
 assert.throws(()=>act(state,{type:'event',name:'Show',date:'2026-02-30',expensesCents:0}),/valid date/);
 assert.throws(()=>act(state,{type:'event',name:'Show',date:'2026-10-21',expensesCents:-1}),/expenses/);
 state=act(state,{type:'event',name:' Local Show ',date:'2026-10-21',expensesCents:2500});const event=state.events[0];assert.equal(event.name,'Local Show');
 state=act(state,{type:'event',eventId:event.id,name:'Updated Show',date:'2026-10-22',expensesCents:4000});assert.equal(state.events.length,1);assert.equal(state.events[0].createdAt,event.createdAt);assert.equal(state.events[0].expensesCents,4000);parseCollections(JSON.stringify(state));
 const invalid=structuredClone(state);invalid.events.push({...event});assert.throws(()=>parseCollections(JSON.stringify(invalid)),/references/);
});

test('one sale retains its card identity and groups FIFO allocations even after its holdings are removed',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,quantity:1,costCents:800}]});state=act(state,{type:'event',name:'Show',date:'2026-10-21',expensesCents:100});
 state=act(state,{type:'sell',collectionId,key:productKey(product),quantity:3,netCents:4501,eventId:state.events[0].id});const groups=groupedSales(state.sales);assert.equal(groups.length,1);assert.equal(groups[0].quantity,3);assert.equal(groups[0].proceeds,4501);assert.equal(groups[0].profit,2301);assert.equal(groups[0].rows.length,2);assert.ok(groups[0].rows.every(row=>row.product.name===product.name));
 for(const lot of [...state.lots])state=act(state,{type:'remove',lotId:lot.id});assert.equal(state.lots.length,0);assert.equal(groupedSales(state.sales)[0].first.product.printing,'Normal');parseCollections(JSON.stringify(state));
});

test('assigning a sale to a show updates every allocation without changing quantity, proceeds or cost',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'create',name:'Show Stock'});state=act(state,{type:'add',collectionId:state.collections[1].id,items:[{...product,quantity:1,costCents:900}]});state=act(state,{type:'sell',collectionId:'all',key:productKey(product),quantity:3,netCents:4000});const before=saleTotals(state.sales),key=groupedSales(state.sales)[0].key;
 state=act(state,{type:'event',name:'Event',date:'2026-10-21',expensesCents:500});state=act(state,{type:'sale-event',groupKey:key,eventId:state.events[0].id});assert.ok(state.sales.every(row=>row.eventId===state.events[0].id));assert.deepEqual(saleTotals(state.sales),before);
 assert.throws(()=>act(state,{type:'sale-event',groupKey:key,eventId:'another-owners-event'}),/existing/);state=act(state,{type:'sale-event',groupKey:key,eventId:null});assert.ok(state.sales.every(row=>row.eventId===null));assert.equal(state.collections[0].id,collectionId);
});

test('partial unknown costs never turn all sale proceeds into profit or hide the known subset of a holding',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,quantity:1}]});const initial=collectionPerformance(collectionHoldings(state,[product]),[]);assert.equal(initial.unrealized,1000);assert.equal(initial.costedQuantity,2);assert.equal(initial.quantity,3);
 state=act(state,{type:'sell',collectionId,key:productKey(product),quantity:3,netCents:3000});const totals=saleTotals(state.sales);assert.equal(totals.proceeds,3000);assert.equal(totals.costedQuantity,2);assert.equal(totals.profit,600);assert.equal(collectionPerformance([],state.sales,500).combined,100);
});

test('combined profit deducts account-wide show expenses once and does not double count a sold card',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'sell',collectionId,key:productKey(product),quantity:1,netCents:1100});const performance=collectionPerformance(collectionHoldings(state,[product]),state.sales,100);assert.equal(performance.realized,400);assert.equal(performance.unrealized,500);assert.equal(performance.combined,800);
 assert.equal(collectionPerformance([],[],2500).combined,-2500);assert.equal(collectionTotals([]).value,0);const unknown={...state.sales[0],costCents:null};assert.equal(collectionPerformance([],[unknown]).combined,null);assert.equal(saleTotals([unknown]).profit,null);
});

test('sticker suggestions follow FIFO, include zero-valued asks, and refuse partial or impossible totals',()=>{
 let {state,collectionId}=fixture();state=act(state,{type:'add',collectionId,items:[{...product,quantity:1,stickerCents:3000}]});const lots=collectionHoldings(state,[product])[0].lots;assert.equal(stickerSaleSuggestion(lots,3),8000);assert.equal(stickerSaleSuggestion(lots,4),null);assert.equal(stickerSaleSuggestion(lots,0),null);assert.equal(stickerSaleSuggestion(lots,1.5),null);
 assert.equal(stickerSaleSuggestion([{...lots[0],stickerCents:0}],1),0);assert.equal(stickerSaleSuggestion([lots[0],{...lots[1],stickerCents:null}],3),null);
});
