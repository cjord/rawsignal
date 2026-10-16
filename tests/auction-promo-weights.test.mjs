import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_PROMO_TARGETS,auctionDrawBand,auctionDrawWeights,auctionRarityWeights} from '../core/domain/auction-composition.ts';
import {auctionLotTheme,AUCTION_LOT_THEMES} from '../core/domain/auction-lot-themes.ts';
import {auctionMarketPrior} from '../core/domain/auction-market-prior.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {auctionRarityBand} from '../core/domain/auction-copy-policy.ts';
import {beginAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const base={productId:1,name:'Card',printing:'Normal',image:'https://images.example/1',set:'Origins',section:'riftbound-promos',rarity:'Promo',cents:100};
const groups=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','overnumbered'],['Epic','signatures'],['Promo','riftbound-promos']];
const pool=groups.flatMap(([rarity,section],band)=>Array.from({length:40},(_,i)=>({...base,rarity,section,productId:band*40+i+1})));
const metals=Array.from({length:25},(_,i)=>({...base,name:`Card ${i} (Metal) (Best Of)`,section:'metal-promos',productId:400+i,cents:150000}));
const ultras=Array.from({length:20},(_,i)=>({...base,name:`Premium Promo ${i}`,productId:500+i,cents:150000}));

test('Metal and future priced Best Of share a treatment budget; only non-Metal promos above $1000 use the ultra budget',()=>{
 for(const card of [metals[0],{...base,name:'Card (Metal) (Prize Wall)'},{...base,name:'Card (Best Of)',cents:1000000}])assert.equal(auctionDrawBand(card),'metal');
 assert.equal(auctionDrawBand({...base,cents:100001}),'ultra-promo');assert.equal(auctionDrawBand({...base,cents:100000}),'other');
 assert.equal(auctionDrawBand({...base,section:'signatures',rarity:'Epic',cents:400000}),'signature');
 assert.equal(auctionDrawBand({...base,section:'rares',rarity:'Rare',cents:400000}),'rare');
 assert.equal(auctionDrawBand({...base,name:'Metallic Card',section:'rares',rarity:'Rare'}),'rare');
 for(const cents of [100,53500,149800])assert.equal(auctionDrawBand({...base,name:'Ambessa (T1 Worlds Champion Signature Edition Bundle)',set:'T1 2025 Worlds Champion Bundles',section:'riftbound-showcases',rarity:'Showcase',cents}),'ultra-promo');
 assert.equal(auctionDrawBand({...base,name:'Champion',section:'riftbound-showcases',rarity:'Showcase',cents:140000}),'other');
});

test('promo budgets subtract from other, stay below signatures in every theme, and average to explicit targets',()=>{
 const seeds=new Map();for(let seed=0;seeds.size<AUCTION_LOT_THEMES.length;seed++)seeds.set(auctionLotTheme(seed).id,seed);
 for(const kind of ['free','paid']){
  const draws=[...seeds.values()].map(seed=>auctionDrawWeights(seed,kind));
  for(const seed of seeds.values()){
   const weights=auctionDrawWeights(seed,kind),original=auctionRarityWeights(seed,kind);
   assert.ok(Math.abs(Object.values(weights).reduce((sum,v)=>sum+v,0)-1)<1e-12);assert.ok(weights.metal<weights.signature/4);assert.ok(weights['ultra-promo']<weights.metal);
   assert.ok(Math.abs(weights.other+weights.metal+weights['ultra-promo']-original.other)<1e-12);
   for(const band of ['common','uncommon','rare','epic','alt','over','signature'])assert.equal(weights[band],original[band]);
  }
  for(const band of ['metal','ultra-promo'])assert.ok(Math.abs(draws.reduce((sum,w)=>sum+w[band],0)/draws.length-AUCTION_PROMO_TARGETS[kind][band])<1e-12);
 }
});

test('full catalogs draw ultra-promos and Metal far less often than signatures, preserving seeded copy-limited source identity',()=>{
 const catalog=[...pool,...metals,...ultras];
 for(const kind of ['free','paid']){
  const counts={metal:0,'ultra-promo':0,signature:0};let total=0;
  for(let seed=0;seed<2000;seed++){
   const lot=generateAuctionLot(catalog,seed,kind);total+=lot.length;
   for(const card of lot){const band=auctionDrawBand(card);if(band in counts)counts[band]++;}
   if(seed<10)assert.deepEqual(lot,generateAuctionLot([...catalog].reverse(),seed,kind));
  }
  assert.ok(counts.metal<counts.signature/3);assert.ok(counts['ultra-promo']<counts.metal/2);
  for(const band of ['metal','ultra-promo'])assert.ok(Math.abs(counts[band]/total-AUCTION_PROMO_TARGETS[kind][band])<(band==='metal'?.0003:.00015),`${kind} ${band}: ${counts[band]/total}`);
 }
});

test('catalog prior uses promo admission budgets, preserves eight actual rarity cohorts and does not inspect the generated lot',()=>{
 const catalog=[...pool,...metals,...ultras],seed=42,kind='paid',weights=auctionDrawWeights(seed,kind);
 const expected=Object.entries(weights).reduce((sum,[band,share])=>{const cards=catalog.filter(c=>auctionDrawBand(c)===band);return sum+share*cards.reduce((v,c)=>v+c.cents,0)/cards.length;},0);
 const prior=auctionMarketPrior(catalog,seed,kind);assert.ok(Math.abs(prior.mean-expected)<1e-8);assert.ok(prior.bands.length<=8);assert.ok(!prior.bands.some(b=>['metal','ultra-promo'].includes(b.band)));
 const inflated=auctionMarketPrior([...pool,...metals.map(c=>({...c,cents:c.cents*2})),...ultras],seed,kind);assert.ok(Math.abs(inflated.mean-prior.mean-weights.metal*150000)<1e-8);
 const low=beginAuction(initialAuctionSave(),catalog,1000,pool.slice(0,60),seed,kind),high=beginAuction(initialAuctionSave(),catalog,1000,catalog.slice(-60),seed,kind);assert.deepEqual(low.auction.marketPrior,high.auction.marketPrior);assert.deepEqual(parseAuctionSave(JSON.stringify(high)),high);
 // Empty subgroups do not invent a source price; sole surviving stock can renormalize.
 assert.ok(auctionMarketPrior(metals,seed,kind).mean>0);for(const c of generateAuctionLot(metals,seed,kind))assert.ok(metals.some(source=>holdingKey(c)===holdingKey(source)));
 assert.equal(auctionRarityBand(metals[0]),'other');
});
