import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {setQueryScope} from '../db/set-query-scope.ts';
import {loadSetEvData} from '../db/metrics-service.ts';

test('valuation reads restrict exact game/set pairs without changing selected values',async()=>{
 const database=new DatabaseSync(':memory:');
 database.exec('create table catalog_products(product_id integer primary key,kind text,game text,set_name text,rarity text,section text,product_type text); create table current_prices(product_id integer,market_cents integer)');
 database.exec('create index idx_catalog_kind_game_set on catalog_products(kind,game,set_name)');
 let id=0;for(const [game,setName,card,pack]of [['pokemon','Unleashed',1000,500],['riftbound','Unleashed',5000,900],['pokemon',"Seller's Set",3000,700]])for(const kind of ['single','sealed']){
  id++;database.prepare('insert into catalog_products values (?,?,?,?,?,?,?)').run(id,kind,game,setName,'Rare','rares','Booster Packs');database.prepare('insert into current_prices values (?,?)').run(id,kind==='single'?card:pack);
 }
 const queries=[],db={prepare(sql){const query={sql,values:[]};queries.push(query);return {bind(...values){query.values=values;return this},async all(){return {results:database.prepare(sql).all(...query.values)}}}}};
 const config={version:1,games:{pokemon:{sets:{},default:{Rare:10}},riftbound:{sets:{},default:{Rare:20}}}};
 const all=await loadSetEvData(db,config),target={game:'riftbound',setName:'Unleashed'},selected=await loadSetEvData(db,config,[target,target]);
 for(const key of ['packPriceBySet','evBySet'])assert.deepEqual([...selected[key]],[['riftbound|Unleashed',all[key].get('riftbound|Unleashed')]]);
 assert.equal(selected.packPriceBySet.get('riftbound|Unleashed'),9);
 const empty=await loadSetEvData(db,config,[]);assert.equal(empty.packPriceBySet.size,0);assert.equal(empty.evBySet.size,0);
 assert.ok(queries.slice(2).every(query=>query.values.length===1&&query.sql.includes('json_each(?) selected_set cross join catalog_products')));
 const tier=queries.find(query=>query.values.length===1&&query.sql.includes('avg(cp.market_cents)'));
 const plan=database.prepare('explain query plan '+tier.sql).all(...tier.values).map(row=>row.detail);
 assert.match(plan[0],/SCAN selected_set/);assert.ok(plan.some(row=>/SEARCH p.*kind=\?.*game=\?.*set_name=\?/.test(row)),'Selected tiers must use exact indexed game/set lookups, not a catalog-first scan');
 assert.equal(setQueryScope(Array.from({length:1000},(_,i)=>({game:'pokemon',setName:String(i)}))).params.length,1);
 database.close();
});
