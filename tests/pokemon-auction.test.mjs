import test from 'node:test';
import assert from 'node:assert/strict';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {pokemonAuctionBand,POKEMON_AUCTION_COHORTS} from '../core/domain/pokemon-auction-rarity.ts';
import {pokemonAuctionCatalog,pokemonAuctionPreparationPool,POKEMON_AUCTION_STORAGE_KEY} from '../core/domain/pokemon-auction.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {auctionMarketPrior} from '../core/domain/auction-market-prior.ts';
import {auctionRarityLabel} from '../core/domain/auction-copy-policy.ts';
import {beginAuction,lockBid,tickAuction,nextAuctionRound,buyInformation} from '../core/domain/auction-engine.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {unlockPokemonVintage} from '../core/domain/pokemon-auction-wallet.ts';
import {pokemonAuctionCategory} from '../core/domain/pokemon-auction-houses.ts';
import {auctionProfileSnapshot,encodeProfileSnapshot,decodeProfileSnapshot,auctionProfilePath} from '../core/domain/auction-profile-share.ts';

const rows=[['Common','pokemon-commons',.12],['Uncommon','pokemon-uncommons',.25],['Rare','pokemon-rares',.5],['Holo Rare','pokemon-holo-rares',1],['Ultra Rare','ultra-rares',8],['Illustration Rare','illustration-rares',20],['Special Illustration Rare','special-illustration-rares',120],['Promo','promos',12]];
const cards=Array.from({length:160},(_,i)=>{const [rarity,section,marketPrice]=rows[i%8];return {game:'pokemon',productId:i+1,printing:'Holofoil',name:'Card '+i,set:'SV01: Scarlet & Violet',rarity,section,marketPrice,image:'https://images.example/'+i+'.jpg',number:''+i,year:2023}});
const catalog=pokemonAuctionCatalog(cards),scope={market:'pokemon',eras:['sv'],sets:['SV01: Scarlet & Violet']};
function prepared(seed=42,kind='free'){
 const save=initialAuctionSave('pokemon'),pool=pokemonAuctionPreparationPool(catalog,seed),lot=generateAuctionLot(pool,seed,kind);
 save.drafts={[kind]:{market:'pokemon',rulesVersion:1,scope,catalogVersion:'a'.repeat(64),seed,kind,pool,lot,marketPrior:auctionMarketPrior(pool,seed,kind)}};
 return save;
}
test('Pokémon effect cohorts retain exact market identities and never leak Riftbound labels',()=>{
 assert.deepEqual(catalog.slice(0,8).map(pokemonAuctionBand),['common','uncommon','epic','epic','alt','over','signature','other']);
 assert.equal(pokemonAuctionBand({...catalog[2],printing:'Normal'}),'rare');
 assert.equal(Object.keys(POKEMON_AUCTION_COHORTS).length,8);
 assert.equal(auctionRarityLabel(catalog[6]),'Special Illustration Rare');
 assert.equal(catalog[0].cents,12);assert.equal(catalog[0].printing,'Holofoil');
 assert.equal(pokemonAuctionCatalog([{...cards[0],game:'riftbound'},{...cards[1],marketPrice:null},{...cards[2],section:'japanese-promos'}]).length,0);
});
test('seeded Pokémon lots obey selection, bounds and positive real printing prices',()=>{
 for(const kind of ['free','paid'])for(let seed=0;seed<60;seed++){
  const lot=generateAuctionLot(catalog,seed,kind);
  assert.ok(lot.length>=(kind==='free'?25:50)&&lot.length<=(kind==='free'?90:130));
  assert.deepEqual(lot,generateAuctionLot(catalog,seed,kind));
  assert.ok(lot.every(card=>catalog.some(original=>holdingKey(original)===holdingKey(card)&&original.cents===card.cents)&&card.market==='pokemon'));
 }
 assert.deepEqual(generateAuctionLot(catalog.slice(0,2),4),[]);
});
test('Pokémon preparation is bounded and preserves cancel/reopen candidates within account limits',()=>{
 const many=Array.from({length:10000},(_,i)=>({...catalog[i%catalog.length],productId:1000+i}));
 const pool=pokemonAuctionPreparationPool(many,42);assert.equal(pool.length,600);assert.deepEqual(pool,pokemonAuctionPreparationPool(many,42));
 const save=prepared();assert.equal(validAccountValue(POKEMON_AUCTION_STORAGE_KEY,JSON.stringify(save)),true);
 assert.ok(Buffer.byteLength(JSON.stringify(save))<1_000_000);
 assert.deepEqual(parseAuctionSave(JSON.stringify(save),'pokemon').drafts,save.drafts);
});
test('account save domains reject cross-market auctions and changed scopes',()=>{
 const save=prepared();assert.throws(()=>parseAuctionSave(JSON.stringify(save)));
 assert.equal(validAccountValue('raw-signal-auction-house-v1',JSON.stringify(save)),false);
 assert.equal(validAccountValue(POKEMON_AUCTION_STORAGE_KEY,JSON.stringify(initialAuctionSave())),false);
 const wrong=structuredClone(save);wrong.drafts.free.pool[0].market=undefined;
 assert.throws(()=>parseAuctionSave(JSON.stringify(wrong),'pokemon'));
 const widened=structuredClone(save);widened.drafts.free.scope.sets=['Different Set'];
 assert.throws(()=>parseAuctionSave(JSON.stringify(widened),'pokemon'));
 assert.equal(parseAuctionSave(null).market,undefined);
});
test('shared round engine settles Pokémon only into its own wallet and retains parseable history',()=>{
 let save=beginAuction(prepared(),catalog,1000,prepared().drafts.free.lot,42);
 assert.equal(save.auction.market,'pokemon');assert.deepEqual(save.auction.scope,scope);
 assert.ok(save.auction.npcs.every(npc=>npc.sample.length===0));
 save=lockBid(save,100,1001);save=tickAuction(save,62000);
 while(save.auction.stage==='reveal'){save=nextAuctionRound(save,save.auction.deadline+1);save=lockBid(save,100,save.auction.deadline-1);save=tickAuction(save,save.auction.deadline)}
 assert.equal(save.auction.stage,'result');assert.ok(save.statistics.settled===1);
 assert.doesNotThrow(()=>parseAuctionSave(JSON.stringify(save),'pokemon'));
 assert.equal(initialAuctionSave().wallet.inventory.length,0);
});
test('Pokémon investigation effects and public clues keep hidden information private',()=>{
 const save=beginAuction(prepared(),catalog,1000,prepared().drafts.free.lot,42);
 for(const option of save.auction.offers){
  const next=buyInformation(save,option.id,1001);
  assert.equal(next.wallet.cash,save.wallet.cash-option.cost);
  assert.ok(next.auction.priced.every(slot=>next.auction.known.includes(slot)));
  assert.doesNotThrow(()=>parseAuctionSave(JSON.stringify(next),'pokemon'));
 }
 assert.ok(save.auction.priced.length>=Math.ceil(save.auction.lot.length*.05)+1);
});
test('era categories are exclusive and vintage requires the earned milestone plus $200 cash',()=>{
 assert.equal(pokemonAuctionCategory({market:'pokemon',eras:['wotc','ex','dp'],sets:[]}), 'vintage');
 assert.equal(pokemonAuctionCategory({market:'pokemon',eras:['bw','xy','sm'],sets:[]}), 'legacy');
 assert.equal(pokemonAuctionCategory({market:'pokemon',eras:['wotc','sv'],sets:[]}),null);
 const vintage=catalog.map(card=>({...card,set:'Base Set',year:1999})),lot=generateAuctionLot(vintage,42,'paid');
 assert.ok(lot.length>=25&&lot.length<=55);
 let save={...initialAuctionSave('pokemon'),drafts:{paid:{seed:42,kind:'paid',market:'pokemon',rulesVersion:1,scope:{market:'pokemon',eras:['wotc'],sets:[]},catalogVersion:'a'.repeat(64),lot,marketPrior:auctionMarketPrior(vintage,42,'paid')}}};
 assert.equal(beginAuction(save,vintage,1000,lot,42,'paid'),save);
 save=unlockPokemonVintage({...save,wallet:{...save.wallet,cash:1000000}},vintage);
 assert.equal(save.vintageUnlocked,true);
 save={...save,wallet:{...save.wallet,cash:20000}};
 const entered=beginAuction(save,vintage,1000,lot,42,'paid');assert.equal(entered.auction.entryFee,20000);assert.equal(entered.wallet.cash,0);
 assert.doesNotThrow(()=>parseAuctionSave(JSON.stringify(entered),'pokemon'));
 const insufficient={...save,wallet:{...save.wallet,cash:19999}};assert.equal(beginAuction(insufficient,vintage,1000,lot,42,'paid'),insufficient);
});
test('vintage unlock includes after-fee showcase value and cannot be earned from unpriced cards',()=>{
 const save={...initialAuctionSave('pokemon'),wallet:{cash:250000,feeBps:1000,inventory:[]},showcase:[{productId:1,printing:'Holofoil',quantity:1}]};
 assert.equal(unlockPokemonVintage(save,[]),save);
 const unlocked=unlockPokemonVintage(save,[{...catalog[0],cents:900000}]);assert.equal(unlocked.vintageUnlocked,true);
 assert.equal(unlockPokemonVintage(unlocked,[]),unlocked);
});
test('Pokémon frozen showcases carry a market/version and preserve legacy Riftbound links',()=>{
 const snapshot=auctionProfileSnapshot(initialAuctionSave('pokemon'),catalog);
 assert.equal(snapshot.v,2);assert.equal(snapshot.market,'pokemon');assert.deepEqual(decodeProfileSnapshot(encodeProfileSnapshot(snapshot)),snapshot);
 assert.ok(auctionProfilePath(snapshot).startsWith('/games/pokemon-auction/showcase#'));
 const legacy=auctionProfileSnapshot(initialAuctionSave(),[]);assert.equal(legacy.v,1);assert.equal(legacy.market,undefined);assert.ok(auctionProfilePath(legacy).startsWith('/games/riftbound-auction/showcase#'));
});
