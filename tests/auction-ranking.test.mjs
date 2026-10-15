import assert from 'node:assert/strict';
import test from 'node:test';
import {rankAuctionBids,auctionPlacementLabel} from '../core/domain/auction-ranking.ts';
import {auctionWinner} from '../core/domain/auction-engine.ts';
import {AUCTION_LOT_THEMES} from '../core/domain/auction-lot-themes.ts';

test('bid placements rank all four bidders and preserve caller order',()=>{
 const bids=[{name:'You',cents:100},{name:'The Dealer',cents:300},{name:'The Skeptic',cents:0},{name:'The Collector',cents:200}],copy=structuredClone(bids);
 assert.deepEqual(rankAuctionBids(bids,42).map(bid=>bid.name),['The Dealer','The Collector','You','The Skeptic']);assert.deepEqual(bids,copy);
 assert.deepEqual([1,2,3,4].map(auctionPlacementLabel),['1st','2nd','3rd','4th']);
});
test('seeded tied placements match the winner across input orders, while all passes have no winning bid',()=>{
 const bids=['You','The Dealer','The Skeptic','The Collector'].map(name=>({name,cents:100}));
 for(let seed=0;seed<20;seed++){
  const ordered=rankAuctionBids(bids,seed);assert.equal(ordered[0].name,auctionWinner(bids,4,seed).winner.name);assert.deepEqual(rankAuctionBids(bids.toReversed(),seed),ordered);assert.equal(new Set(ordered.map(bid=>bid.name)).size,4);
 }
 const passes=bids.map(bid=>({...bid,cents:0}));assert.equal(auctionWinner(passes,4,42).winner,null);assert.equal(rankAuctionBids(passes,42).length,4);
});
test('collection display names follow lot themes, including the requested Deck Builder title',()=>{
 assert.equal(AUCTION_LOT_THEMES.find(theme=>theme.id==='deck-builder').collectionName,"Deck Builder's Collection");
 assert.equal(new Set(AUCTION_LOT_THEMES.map(theme=>theme.collectionName)).size,5);assert.ok(AUCTION_LOT_THEMES.every(theme=>theme.collectionName.endsWith('Collection')));
});
