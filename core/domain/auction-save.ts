import {initialAuctionSave,type Auction,type AuctionSave,type DailyAuctionManifest} from "./auction-types.ts";
import {INVESTIGATIONS,LEGACY_INVESTIGATION_COSTS,PREVIOUS_INVESTIGATION_COSTS,PRE_BALANCE_INVESTIGATION_COSTS} from "./auction-information.ts";
import {AUCTION_NPCS} from './auction-npcs.ts';
import {NPC_INVESTIGATION_IDS} from './auction-npc-information.ts';
import {AUCTION_LOT_THEMES} from './auction-lot-themes.ts';
import {rebalancedCost} from './auction-investigations-v2.ts';
import {validAuctionStatistics} from './auction-statistics.ts';
import {validAuctionReceipts} from './auction-daily-results.ts';

export const AUCTION_STORAGE_KEY='raw-signal-auction-house-v1';
const record=(value:unknown)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
const text=(value:unknown,max=300):value is string=>typeof value==='string'&&value.length<=max;
function validLot(auction:Auction){
 return validCards(auction.lot,350);
}
function validCards(cards:unknown,max:number):boolean{return Array.isArray(cards)&&cards.length>=6&&cards.length<=max&&cards.every(card=>record(card)&&integer(card.productId)&&card.productId>0&&text(card.printing,80)&&text(card.name)&&text(card.set)&&text(card.rarity)&&text(card.section)&&text(card.image,2000)&&/^https?:\/\//.test(card.image)&&integer(card.cents)&&card.cents>0)}
function validSlots(value:unknown,length:number):value is number[]{return Array.isArray(value)&&value.length<=length&&new Set(value).size===value.length&&value.every(index=>integer(index,length-1))}
function validNpcs(auction:Auction){
 return Array.isArray(auction.npcs)&&auction.npcs.length===3&&auction.npcs.every(npc=>record(npc)&&AUCTION_NPCS.some(profile=>profile.name===npc.name)&&integer(npc.bid)&&integer(npc.lockAt,Number.MAX_SAFE_INTEGER)&&typeof npc.locked==='boolean'&&validSlots(npc.sample,auction.lot.length)&&validNpcInformation(npc,auction.lot.length))&&new Set(auction.npcs.map(npc=>npc.name)).size===3;
}
function validNpcInformation(npc:Auction['npcs'][number],length:number){return (npc.identified===undefined||validSlots(npc.identified,length))&&(npc.inspected===undefined||validSlots(npc.inspected,length))&&(npc.rarityKnown===undefined||validSlots(npc.rarityKnown,length))&&(npc.findings===undefined||Array.isArray(npc.findings)&&npc.findings.length<=4&&npc.findings.every(validClue))&&(npc.investigations===undefined||Array.isArray(npc.investigations)&&npc.investigations.length<=4&&new Set(npc.investigations).size===npc.investigations.length&&npc.investigations.every(id=>NPC_INVESTIGATION_IDS.includes(id)))}
function validClue(value:unknown){
 const clue=value as {id?:unknown;label?:unknown;text?:unknown;round?:unknown;reveals?:unknown};
 return record(value)&&text(clue.id)&&text(clue.label)&&text(clue.text,3000)&&(clue.round===undefined||integer(clue.round,4)&&clue.round>=1)&&validClueReveals(clue.reveals);
}
function validClueReveals(value:unknown){
 return value===undefined||Array.isArray(value)&&value.length<=350&&new Set(value.map(reveal=>reveal?.slot)).size===value.length&&value.every(reveal=>record(reveal)&&integer(reveal.slot,349)&&['rarity','identity','price'].includes(reveal.visibility));
}
function validBidNotes(notes:unknown){return notes===undefined||Array.isArray(notes)&&notes.length<=4&&notes.every(validClue)}
function validBids(bids:unknown){return Array.isArray(bids)&&bids.length<=4&&bids.every(bid=>record(bid)&&text(bid.name)&&integer(bid.cents)&&validBidNotes(bid.notes))}
function validClues(auction:Auction){
 return Array.isArray(auction.offers)&&auction.offers.length<=4&&auction.offers.every(option=>record(option)&&INVESTIGATIONS.some(known=>known.id===option.id&&(rebalancedCost(known,auction)===option.cost||LEGACY_INVESTIGATION_COSTS[option.id]===option.cost||PREVIOUS_INVESTIGATION_COSTS[option.id]===option.cost||PRE_BALANCE_INVESTIGATION_COSTS[option.id]===option.cost)&&known.tier===option.tier)&&text(option.label)&&(option.description===undefined||text(option.description,500)))&&Array.isArray(auction.clues)&&auction.clues.length<=4&&auction.clues.every(clue=>validClue(clue)&&(clue.round===undefined||clue.round<=auction.round));
}
function validRoundMetadata(auction:Auction){return ['round','reveal','result'].includes(auction.stage)&&integer(auction.round,4)&&auction.round>=1&&integer(auction.seed)&&integer(auction.deadline,Number.MAX_SAFE_INTEGER)&&integer(auction.feeBps,10000)&&integer(auction.spent)&&typeof auction.bought==='boolean'&&(auction.selected===null||integer(auction.selected))}
function validSnapshot(auction:Auction){
 if(!validMarketPrior(auction.marketPrior))return false;
 if(auction.lotTheme!==undefined&&!AUCTION_LOT_THEMES.some(theme=>theme.id===auction.lotTheme))return false;
 if(auction.topCardSlot!==undefined&&(!integer(auction.topCardSlot,auction.lot?.length-1)||!auction.rarityKnown?.includes(auction.topCardSlot)))return false;
 if(!validLot(auction)||!validPublicReveals(auction)||auction.rarityKnown!==undefined&&!validSlots(auction.rarityKnown,auction.lot.length))return false;
 return Array.isArray(auction.range)&&auction.range.length===2&&auction.range.every(value=>integer(value,1000))&&auction.range[0]<=auction.range[1]&&validSlots(auction.known,auction.lot.length)&&validSlots(auction.priced,auction.lot.length)&&auction.priced.every(slot=>auction.known.includes(slot));
}
function validMarketPrior(prior:Auction['marketPrior']){
 if(prior===undefined)return true;
 const finite=(value:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
 return record(prior)&&finite(prior.mean)&&Array.isArray(prior.bands)&&prior.bands.length<=8&&new Set(prior.bands.map(row=>row?.band)).size===prior.bands.length&&prior.bands.every(row=>record(row)&&['common','uncommon','rare','epic','alt','over','signature','other'].includes(row.band)&&finite(row.mean)&&(row.typical===undefined||finite(row.typical))&&finite(row.share)&&row.share<=1)&&Math.abs(prior.bands.reduce((sum,row)=>sum+row.share,0)-1)<1e-8;
}
function validPublicReveals(auction:Auction){return auction.publicReveals===undefined||Array.isArray(auction.publicReveals)&&auction.publicReveals.length<=4&&new Set(auction.publicReveals.map(reveal=>reveal?.round)).size===auction.publicReveals.length&&auction.publicReveals.every(reveal=>record(reveal)&&integer(reveal.round,auction.round)&&reveal.round>=1&&validSlots(reveal.slots,auction.lot.length)&&reveal.slots.length<=(reveal.round===1?Math.ceil(auction.lot.length*.05)+3:3)&&Array.isArray(auction.priced)&&reveal.slots.every(slot=>auction.priced.includes(slot)))}
function validResult(auction:Auction){
 if(auction.stage!=='result')return auction.result===null;
 const result=auction.result;return !!result&&record(result)&&(result.winner===null||result.winner==='You'||AUCTION_NPCS.some(profile=>profile.name===result.winner))&&integer(result.bid)&&integer(result.value)&&integer(result.fee)&&typeof result.net==='number'&&Number.isSafeInteger(result.net)&&integer(result.playerExpenses)&&typeof result.buyout==='boolean'&&validLossShares(result.lossShares);
}
function validLossShares(shares:unknown){
 return shares===undefined||Array.isArray(shares)&&shares.length<=3&&new Set(shares.map(share=>share?.name)).size===shares.length&&shares.every(share=>record(share)&&text(share.name)&&integer(share.cents));
}
function validAuction(value:unknown):value is Auction{
 if(!record(value))return false;const auction=value as Auction;
 if([auction.statisticsTracked,auction.npcInvestigationSchedule].some(flag=>flag!==undefined&&typeof flag!=='boolean'))return false;
 if(!validRivals(auction.rivals))return false;
 return validAuctionEntry(auction)&&validRoundMetadata(auction)&&validSnapshot(auction)&&validNpcs(auction)&&validClues(auction)&&validBids(auction.bids)&&Array.isArray(auction.bidHistory)&&auction.bidHistory.length<=4&&auction.bidHistory.every(validBids)&&validResult(auction);
}
function validAuctionEntry(auction:Auction){return auction.kind===undefined&&auction.entryFee===undefined||auction.kind==='free'&&auction.entryFee===0||auction.kind==='paid'&&auction.entryFee===5000}
export function parseAuctionSave(raw:string|null):AuctionSave{
 if(raw===null)return initialAuctionSave();
 if(raw.length>4e6)throw new Error('Saved game is too large. Reset to start again.');
 const value=JSON.parse(raw) as AuctionSave;
 if(!record(value)||value.version!==1||!integer(value.revision)||!integer(value.sequence)||!record(value.wallet)||!integer(value.wallet.cash)||!integer(value.wallet.feeBps,10000))throw new Error('Saved game is invalid. Reset to start again.');
 const inventory=value.wallet.inventory;
 if(!Array.isArray(inventory)||inventory.length>10000||!inventory.every(row=>record(row)&&integer(row.productId)&&row.productId>0&&text(row.printing,80)&&integer(row.quantity,1000000)&&row.quantity>0))throw new Error('Saved inventory is invalid. Reset to start again.');
 if(value.auction!==null&&!validAuction(value.auction))throw new Error('Saved auction is invalid. Reset to start again.');
 if(value.statistics!==undefined&&!validAuctionStatistics(value.statistics))throw new Error('Saved statistics are invalid.');
 if(value.auction?.statisticsTracked&&!value.statistics)throw new Error('Missing auction statistics.');
 if(value.drafts!==undefined&&!validDrafts(value))throw new Error('Saved auction preparation is invalid.');
 if(value.daily!==undefined&&!validDailyProgress(value))throw new Error('Saved daily challenge is invalid.');
 const auction=value.auction?{...value.auction,offers:value.auction.offers.filter(option=>option.id!=='value-band'&&option.id!=='value-band4'&&option.id!=='top5')}:null;
 return {...value,auction,wallet:{cash:value.wallet.cash,feeBps:value.wallet.feeBps,inventory:inventory.map(({productId,printing,quantity})=>({productId,printing,quantity}))}};
}
function validDrafts(save:AuctionSave){
 return record(save.drafts)&&Object.entries(save.drafts!).every(([kind,draft])=>['free','paid'].includes(kind)&&validDraft(draft)&&draft.kind===kind);
}
function validDraft(draft:unknown){
 const row=draft as NonNullable<AuctionSave['drafts']>['free'];
 return record(row)&&!!row&&['free','paid'].includes(row.kind)&&integer(row.seed,4294967295)&&validMarketPrior(row.marketPrior)&&validRivals(row.rivals)&&(row.lot===undefined||validLot({lot:row.lot} as Auction))&&(row.pool===undefined||validCards(row.pool,5000));
}
function validRivals(value:unknown){return value===undefined||Array.isArray(value)&&value.length===3&&new Set(value).size===3&&value.every(name=>text(name,100))}
export function validDailyManifest(value:unknown):value is DailyAuctionManifest{
 const row=value as DailyAuctionManifest;
 return record(row)&&row.version===1&&text(row.source)&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Array.isArray(row.auctions)&&row.auctions.length===5&&row.auctions.every((draft,index)=>validDraft(draft)&&draft.kind===(index<3?'free':'paid')&&Array.isArray(draft.lot)&&draft.lot.length>=(index<3?25:50)&&draft.lot.length<=(index<3?90:130)&&draft.marketPrior!==undefined);
}
function validDailyProgress(save:AuctionSave){
 const daily=save.daily!;
 if(!record(daily))return false;
 if(daily.receipts!==undefined&&!validAuctionReceipts(daily.receipts))return false;
 if(!record(daily)||!validDailyManifest(daily.manifest)||daily.date!==daily.manifest.date||!integer(daily.index,5)||!integer(daily.reward)||!['playing','completed','failed'].includes(daily.status)||!record(daily.save)||daily.save.daily!==undefined)return false;
 if((daily.status==='completed')!==(daily.index===5)||daily.status!=='completed'&&daily.reward!==0)return false;
 try{parseAuctionSave(JSON.stringify(daily.save));return true}catch{return false}
}
