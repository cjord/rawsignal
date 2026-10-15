import {initialAuctionSave,type Auction,type AuctionSave} from "./auction-types.ts";
import {INVESTIGATIONS,LEGACY_INVESTIGATION_COSTS,PREVIOUS_INVESTIGATION_COSTS} from "./auction-information.ts";
import {AUCTION_NPCS} from './auction-npcs.ts';
import {NPC_INVESTIGATION_IDS} from './auction-npc-information.ts';

export const AUCTION_STORAGE_KEY='raw-signal-auction-house-v1';
const record=(value:unknown)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,max=1e12):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
const text=(value:unknown,max=300):value is string=>typeof value==='string'&&value.length<=max;
function validLot(auction:Auction){
 return Array.isArray(auction.lot)&&auction.lot.length>=6&&auction.lot.length<=350&&auction.lot.every(card=>record(card)&&integer(card.productId)&&card.productId>0&&text(card.printing,80)&&text(card.name)&&text(card.set)&&text(card.rarity)&&text(card.section)&&text(card.image,2000)&&/^https?:\/\//.test(card.image)&&integer(card.cents)&&card.cents>0);
}
function validSlots(value:unknown,length:number):value is number[]{return Array.isArray(value)&&value.length<=length&&new Set(value).size===value.length&&value.every(index=>integer(index,length-1))}
function validNpcs(auction:Auction){
 return Array.isArray(auction.npcs)&&auction.npcs.length===3&&auction.npcs.every(npc=>record(npc)&&AUCTION_NPCS.some(profile=>profile.name===npc.name)&&integer(npc.bid,250000)&&integer(npc.lockAt,Number.MAX_SAFE_INTEGER)&&typeof npc.locked==='boolean'&&validSlots(npc.sample,auction.lot.length)&&validNpcInformation(npc,auction.lot.length))&&new Set(auction.npcs.map(npc=>npc.name)).size===3;
}
function validNpcInformation(npc:Auction['npcs'][number],length:number){return (npc.inspected===undefined||validSlots(npc.inspected,length))&&(npc.investigations===undefined||Array.isArray(npc.investigations)&&npc.investigations.length<=4&&new Set(npc.investigations).size===npc.investigations.length&&npc.investigations.every(id=>NPC_INVESTIGATION_IDS.includes(id)))}
function validBidNotes(notes:unknown){return notes===undefined||Array.isArray(notes)&&notes.length<=4&&notes.every(note=>record(note)&&text(note.id)&&text(note.label)&&text(note.text,3000))}
function validBids(bids:unknown){return Array.isArray(bids)&&bids.length<=4&&bids.every(bid=>record(bid)&&text(bid.name)&&integer(bid.cents)&&validBidNotes(bid.notes))}
function validClues(auction:Auction){
 return Array.isArray(auction.offers)&&auction.offers.length<=3&&auction.offers.every(option=>record(option)&&INVESTIGATIONS.some(known=>known.id===option.id&&(known.cost===option.cost||LEGACY_INVESTIGATION_COSTS[option.id]===option.cost||PREVIOUS_INVESTIGATION_COSTS[option.id]===option.cost)&&known.tier===option.tier)&&text(option.label)&&(option.description===undefined||text(option.description,500)))&&Array.isArray(auction.clues)&&auction.clues.length<=4&&auction.clues.every(clue=>record(clue)&&text(clue.id)&&text(clue.label)&&text(clue.text,3000));
}
function validRoundMetadata(auction:Auction){return ['round','reveal','result'].includes(auction.stage)&&integer(auction.round,4)&&auction.round>=1&&integer(auction.seed)&&integer(auction.deadline,Number.MAX_SAFE_INTEGER)&&integer(auction.feeBps,10000)&&integer(auction.spent)&&typeof auction.bought==='boolean'&&(auction.selected===null||integer(auction.selected))}
function validSnapshot(auction:Auction){
 if(!validLot(auction)||!validPublicReveals(auction))return false;
 return Array.isArray(auction.range)&&auction.range.length===2&&auction.range.every(value=>integer(value,1000))&&auction.range[0]<=auction.range[1]&&validSlots(auction.known,auction.lot.length)&&validSlots(auction.priced,auction.lot.length)&&auction.priced.every(slot=>auction.known.includes(slot));
}
function validPublicReveals(auction:Auction){return auction.publicReveals===undefined||Array.isArray(auction.publicReveals)&&auction.publicReveals.length<=4&&new Set(auction.publicReveals.map(reveal=>reveal?.round)).size===auction.publicReveals.length&&auction.publicReveals.every(reveal=>record(reveal)&&integer(reveal.round,auction.round)&&reveal.round>=1&&validSlots(reveal.slots,auction.lot.length)&&reveal.slots.length<=3&&Array.isArray(auction.priced)&&reveal.slots.every(slot=>auction.priced.includes(slot)))}
function validResult(auction:Auction){
 if(auction.stage!=='result')return auction.result===null;
 const result=auction.result;return !!result&&record(result)&&(result.winner===null||result.winner==='You'||AUCTION_NPCS.some(profile=>profile.name===result.winner))&&integer(result.bid)&&integer(result.value)&&integer(result.fee)&&typeof result.net==='number'&&Number.isSafeInteger(result.net)&&Math.abs(result.net)<=1e12&&integer(result.playerExpenses)&&typeof result.buyout==='boolean'&&validLossShares(result.lossShares);
}
function validLossShares(shares:unknown){
 return shares===undefined||Array.isArray(shares)&&shares.length<=3&&new Set(shares.map(share=>share?.name)).size===shares.length&&shares.every(share=>record(share)&&text(share.name)&&integer(share.cents));
}
function validAuction(value:unknown):value is Auction{
 if(!record(value))return false;const auction=value as Auction;
 return validAuctionEntry(auction)&&validRoundMetadata(auction)&&validSnapshot(auction)&&validNpcs(auction)&&validClues(auction)&&validBids(auction.bids)&&Array.isArray(auction.bidHistory)&&auction.bidHistory.length<=4&&auction.bidHistory.every(validBids)&&validResult(auction);
}
function validAuctionEntry(auction:Auction){return auction.kind===undefined&&auction.entryFee===undefined||auction.kind==='free'&&auction.entryFee===0||auction.kind==='paid'&&auction.entryFee===5000}
export function parseAuctionSave(raw:string|null):AuctionSave{
 if(raw===null)return initialAuctionSave();
 if(raw.length>1e6)throw new Error('Saved game is too large. Reset to start again.');
 const value=JSON.parse(raw) as AuctionSave;
 if(!record(value)||value.version!==1||!integer(value.revision)||!integer(value.sequence)||!record(value.wallet)||!integer(value.wallet.cash)||!integer(value.wallet.feeBps,10000))throw new Error('Saved game is invalid. Reset to start again.');
 const inventory=value.wallet.inventory;
 if(!Array.isArray(inventory)||inventory.length>10000||!inventory.every(row=>record(row)&&integer(row.productId)&&row.productId>0&&text(row.printing,80)&&integer(row.quantity,1000000)&&row.quantity>0))throw new Error('Saved inventory is invalid. Reset to start again.');
 if(value.auction!==null&&!validAuction(value.auction))throw new Error('Saved auction is invalid. Reset to start again.');
 return {...value,wallet:{cash:value.wallet.cash,feeBps:value.wallet.feeBps,inventory:inventory.map(({productId,printing,quantity})=>({productId,printing,quantity}))}};
}
