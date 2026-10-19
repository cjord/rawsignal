import assert from 'node:assert/strict';
import test from 'node:test';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {initialInventoryFilters,managedInventory,inventorySalePlan,sellInventorySelection} from '../core/domain/auction-inventory-management.ts';

const card={productId:1,printing:'Normal',name:'Éclair',set:'Origins',rarity:'Common',section:'commons',image:'https://art.example/1.svg',cents:101};
const catalog=[card,{...card,printing:'Foil',cents:900,rarity:'Rare',section:'rares'},{...card,productId:2,name:'Bravo',set:'Spiritforged',cents:300,rarity:'Epic',section:'epics'}];
const cards=[...catalog.map(row=>({...row,game:'riftbound',marketPrice:row.cents/100})),{...card,productId:3,name:'Missing Price',game:'riftbound',marketPrice:null}];
const holdings=[{productId:1,printing:'Normal',quantity:10},{productId:1,printing:'Foil',quantity:1},{productId:2,printing:'Normal',quantity:5},{productId:3,printing:'Normal',quantity:2}];
const save={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,inventory:holdings},showcase:[{productId:1,printing:'Normal',quantity:1},{productId:1,printing:'Normal',quantity:1}]};
const query=patch=>managedInventory(save,catalog,cards,{...initialInventoryFilters,...patch});
test('inventory sorts holding/unit/quantity/rarity independently, with unavailable prices last in either direction',()=>{
 assert.deepEqual(query({}).rows.map(row=>row.key),['2:Normal','1:Normal','1:Foil','3:Normal']);
 assert.deepEqual(query({sort:'value-asc'}).rows.map(row=>row.key),['1:Foil','1:Normal','2:Normal','3:Normal']);
 assert.deepEqual(query({sort:'unit-desc'}).rows.map(row=>row.key),['1:Foil','2:Normal','1:Normal','3:Normal']);
 assert.deepEqual(query({sort:'quantity-desc'}).rows.map(row=>row.key),['1:Normal','2:Normal','3:Normal','1:Foil']);
 assert.equal(query({sort:'rarity-desc'}).rows[0].key,'2:Normal');
 assert.equal(query({availability:'unpriced'}).rows[0].name,'Missing Price');
});
test('inventory filters preserve exact printings and support accent-insensitive names, sets and price availability',()=>{
 assert.equal(query({search:'eclair'}).rows.length,2);assert.equal(query({search:'foil'}).rows[0].key,'1:Foil');
 assert.equal(query({set:'Spiritforged',rarity:'Epics',availability:'priced'}).rows.length,1);
 assert.equal(query({search:'no match'}).rows.length,0);assert.equal(query({}).totalCopies,18);
 assert.deepEqual(query({}).sets,['Origins','Spiritforged']);
});
test('selected sales charge one rounded fee per sold holding, never sell unknown or alternate keys, and do not mutate input',()=>{
 const original=structuredClone(save),keys=['1:Normal','1:Normal','1:Absent','3:Normal','999:Normal'];
 const plan=inventorySalePlan(save,catalog,keys);assert.equal(plan.copies,10);assert.equal(plan.net,909);
 const sold=sellInventorySelection(save,catalog,keys);assert.equal(sold.wallet.cash,save.wallet.cash+909);
 assert.deepEqual(sold.wallet.inventory,holdings.slice(1));assert.deepEqual(sold.showcase,save.showcase);assert.deepEqual(save,original);
});
test('sell extras retains three sellable copies plus protected showcase copies, with unavailable holdings retained',()=>{
 const keys=holdings.map(holdingKey),plan=inventorySalePlan(save,catalog,keys,3);
 assert.equal(plan.copies,9);assert.equal(plan.net,1176);
 const sold=sellInventorySelection(save,catalog,keys,3);assert.deepEqual(sold.wallet.inventory.map(row=>row.quantity),[3,1,3,2]);assert.deepEqual(sold.showcase,save.showcase);
 assert.equal(sellInventorySelection(sold,catalog,keys,3),sold);
});
test('empty, invalid, unsafe and active-auction sales are no-ops',()=>{
 assert.equal(sellInventorySelection(save,catalog,[]),save);
 for(const keep of [-1,.5,NaN]){assert.equal(inventorySalePlan(save,catalog,['1:Normal'],keep).copies,0);assert.equal(sellInventorySelection(save,catalog,['1:Normal'],keep),save)}
 const active={...save,auction:{}};assert.equal(sellInventorySelection(active,catalog,['1:Normal']),active);
 const unsafe={...save,wallet:{...save.wallet,cash:Number.MAX_SAFE_INTEGER}};assert.equal(sellInventorySelection(unsafe,catalog,['1:Normal']),unsafe);
});
