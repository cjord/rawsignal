import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_APPEARANCE_KEY,validAuctionAppearance,parseAuctionAppearance,appearanceArtwork} from '../core/domain/auction-appearance.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {parseAuctionInventoryQuery,serializeAuctionInventoryQuery} from '../core/domain/auction-inventory-query.ts';
test('profile appearance is a bounded canonical-ID preference, independent of game holdings and prices',()=>{
 const value={version:1,cards:[{productId:1,printing:'Normal'},{productId:2,printing:'Foil'}]};
 assert.equal(validAccountValue(AUCTION_APPEARANCE_KEY,JSON.stringify(value)),true);assert.deepEqual(parseAuctionAppearance(JSON.stringify(value)),value);
 const catalog=[{game:'riftbound',productId:1,printing:'Normal',image:'https://art.example/1',rarity:'Rare',section:'rares',marketPrice:null},{game:'riftbound',productId:2,printing:'Normal',image:'https://art.example/wrong',rarity:'Epic',section:'epics'}];
 assert.deepEqual(appearanceArtwork(value,catalog),[{image:'https://art.example/1',rarity:'Rare',section:'rares'}]);assert.deepEqual(parseAuctionAppearance(null),{version:1,cards:[]});
 for(const changed of [{...value,cash:10},{version:2,cards:[]},{version:1,cards:[...value.cards,value.cards[0]]},{version:1,cards:Array.from({length:13},(_,i)=>({productId:i+1,printing:'Normal'}))},{version:1,cards:[{productId:1,printing:'Normal',image:'https://untrusted.example'}]},{version:1,cards:[{productId:-1,printing:'Normal'}]}])assert.equal(validAuctionAppearance(changed),false);
 assert.throws(()=>parseAuctionAppearance('{"version":1,"cards":null}'));
});
test('inventory display URLs round-trip without serializing selected holdings or wallet data',()=>{
 const state=parseAuctionInventoryQuery('?q=Leona&rarity=Rares&set=Origins&sort=quantity-desc&availability=unpriced&page=3');
 assert.equal(state.page,2);assert.equal(state.filters.sort,'quantity-desc');assert.deepEqual(parseAuctionInventoryQuery(serializeAuctionInventoryQuery(state.filters,state.page)),state);
 const invalid=parseAuctionInventoryQuery('?sort=invalid&availability=invalid&page=-2');assert.equal(invalid.page,0);assert.equal(invalid.filters.sort,'value-desc');assert.equal(invalid.filters.availability,'all');assert.equal(serializeAuctionInventoryQuery(invalid.filters,0),'');
 const huge=parseAuctionInventoryQuery('?q='+'x'.repeat(500)+'&page=99999');assert.equal(huge.filters.search.length,200);assert.equal(huge.page,9999);
});
