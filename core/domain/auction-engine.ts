import {AUCTION_ROUNDS,AUCTION_PAID_ENTRY,auctionRandom,sampleIndices,type Auction,type AuctionCard,type AuctionSave,type AuctionKind,type Npc,type RoundBid} from "./auction-types.ts";
import {addInventory,inventoryQuote} from "./auction-market.ts";
import {AUCTION_LOT_SIZES,generateAuctionLot} from './auction-lots.ts';
import {AUCTION_NPCS,auctionNpcRoster,auctionNpcMood,auctionNpcAmbition,auctionNpcSampleTarget} from './auction-npcs.ts';
import {informationOffers,investigate} from "./auction-information.ts";
import {auctionLossShares,auctionSaleRarity} from './auction-economy.ts';
import {npcRoundInformation,npcInvestigationNotes} from './auction-npc-information.ts';
import {auctionSampleValue,publicAuctionSlots,revealPublicRound} from './auction-public.ts';
import {auctionLotTheme} from './auction-lot-themes.ts';
import {rankAuctionBids} from './auction-ranking.ts';
import {followUpSlots} from './auction-investigations-v2.ts';
import {auctionMarketPrior} from './auction-market-prior.ts';
import {auctionClueReveals} from './auction-clue-reveals.ts';
import {recordAuctionStart,recordAuctionResult} from './auction-statistics.ts';

// Only completed public bids may influence an estimate; current sealed bids are never inputs.
export function npcBid(sample:number[],range:[number,number],priorBids:number[],personality:number,random:()=>number,feeBps=1000,confidence=1,participation=0,grossEstimate?:number,certainty=1,round=2):number{
 const npc=AUCTION_NPCS[personality]??AUCTION_NPCS[0],caution=npc.name==='The Skeptic'?.9+.1*certainty:1;
 if(random()>Math.min(1,Math.max(0,(npc.participation+participation)*caution)))return 0;
 const estimate=(grossEstimate??auctionSampleValue(sample)*(range[0]+range[1])/2)*(1-feeBps/10000);
 if(estimate<=0)return 0;
 const noise=1-npc.noise+random()*npc.noise*2,stretch=random()<npc.risk?1.08+random()*.1:1;
 const personal=estimate*npc.margin*confidence*noise*stretch*auctionNpcAmbition(npc.name,round,random);
 const bid=Math.round(influencedBid(personal,priorBids,npc.name,random,round));
 return Number.isSafeInteger(bid)?Math.max(1,bid):0;
}
function influencedBid(personal:number,priorBids:number[],name:string,random:()=>number,round:number){
 if(round<=1)return personal;
 const positives=priorBids.filter(bid=>Number.isSafeInteger(bid)&&bid>0).sort((a,b)=>a-b);
 const later=Math.min(2,round-2),follower=name==='The Follower';
 if(!positives.length||random()>(follower?.75+later*.1:.45+later*.1))return personal;
 const middle=Math.floor(positives.length/2),median=positives.length%2?positives[middle]:(positives[middle-1]+positives[middle])/2;
 // Public history matters more later, but never overrides personal evidence.
 // Round 2→4 nudge limits: 12→20%, or 18→26% for the Follower.
 const limit=follower?.18+later*.04:.12+later*.04;
 return personal+Math.max(-personal*limit,Math.min(personal*limit,(median-personal)*.3));
}
function roundNpcs(auction:Auction,now:number):Npc[]{
 const random=auctionRandom(auction.seed+auction.round*103);
 const roster=auction.npcs.length?auction.npcs.map(npc=>AUCTION_NPCS.find(profile=>profile.name===npc.name)!):auctionNpcRoster(auction.seed,auction.rivals);
 return roster.map((npc,index)=>{
  const previous=auction.npcs.find(bidder=>bidder.name===npc.name)?.sample??[];
  const target=auctionNpcSampleTarget(npc.name,auction.kind??'free',auction.round);
  const sample=[...previous,...sampleIndices(auction.lot.length,Math.max(0,target-previous.length),auction.seed+index*67+auction.round,[...publicAuctionSlots(auction),...previous])];
  const knowledge=npcRoundInformation(auction,index,sample,auction.npcs.find(bidder=>bidder.name===npc.name),npc.name);
  const mood=auctionNpcMood(auction.seed,npc.name),personality=AUCTION_NPCS.findIndex(profile=>profile.name===npc.name);
  const paid=auction.kind==='paid';
  const priorBids=(auction.bidHistory.at(-1)??[]).filter(bid=>bid.name!==npc.name).map(bid=>bid.cents);
  return {name:npc.name,sample,investigations:knowledge.investigations,inspected:knowledge.inspected,identified:knowledge.identified,rarityKnown:knowledge.rarityKnown,findings:knowledge.findings,bid:npcBid(knowledge.prices,auction.range,priorBids,personality,random,auction.feeBps,mood.confidence,mood.participation+(paid?0.04:0),knowledge.estimate,knowledge.certainty,auction.round),lockAt:now+Math.round((.3+random()*.6)*AUCTION_ROUNDS[auction.round-1].seconds*1000),locked:false};
 });
}
function openRound(auction:Auction,now:number):Auction{
 const next=revealPublicRound({...auction,stage:'round' as const,deadline:now+AUCTION_ROUNDS[auction.round-1].seconds*1000,bought:false,selected:null,bids:[]});
 next.offers=informationOffers(next);next.npcs=roundNpcs(next,now);return next;
}
export function beginAuction(save:AuctionSave,catalog:AuctionCard[],now:number,prepared?:AuctionCard[],seed=7411+save.sequence*137,kind:AuctionKind='free'):AuctionSave{
 const entryFee=kind==='paid'?AUCTION_PAID_ENTRY:0;
 if(save.auction||save.wallet.cash<entryFee)return save;
 const lot=(prepared??generateAuctionLot(catalog,seed,kind)).map(card=>({...card})),size=AUCTION_LOT_SIZES[kind];if(lot.length<size.min||lot.length>size.max)return save;
 const auction:Auction={seed,kind,entryFee,stage:'round',round:1,deadline:0,lot,range:[lot.length,lot.length],known:[],priced:[],offers:[],clues:[],bought:false,spent:0,selected:null,npcs:[],bids:[],bidHistory:[],result:null,feeBps:save.wallet.feeBps};
 auction.lotTheme=auctionLotTheme(seed).id;
 if(save.drafts?.[kind]?.rivals)auction.rivals=[...save.drafts[kind]!.rivals!];
 auction.marketPrior=save.drafts?.[kind]?.marketPrior??auctionMarketPrior(catalog,seed,kind);
 const drafts={...save.drafts};delete drafts[kind];
 return {...save,drafts,statistics:recordAuctionStart(save,entryFee),wallet:{...save.wallet,cash:save.wallet.cash-entryFee},sequence:save.sequence+1,auction:openRound({...auction,statisticsTracked:true,npcInvestigationSchedule:true},now)};
}
export function buyInformation(save:AuctionSave,id:string,now:number,targetSlot?:number):AuctionSave{
 const auction=save.auction;
 if(!auction||auction.stage!=='round'||auction.selected!==null||auction.bought||now>=auction.deadline)return save;
 const option=auction.offers.find(option=>option.id===id);if(!option||save.wallet.cash<option.cost||id==='value-band'||id==='value-band4'||id==='top5')return save;
 if(id==='follow-up'&&(targetSlot===undefined||!followUpSlots(auction).includes(targetSlot)))return save;
 if(id==='top2-final'&&auction.round!==4)return save;
 const result=investigate(auction,option,targetSlot);
 const reveals=auctionClueReveals(auction,result);
 return {...save,...(auction.statisticsTracked?{statistics:{...save.statistics!,investigations:save.statistics!.investigations+option.cost}}:{}),wallet:{...save.wallet,cash:save.wallet.cash-option.cost},auction:{...auction,known:result.known,priced:result.priced,...(result.rarityKnown?{rarityKnown:result.rarityKnown}:{}),...(result.topCardSlot!==undefined?{topCardSlot:result.topCardSlot}:{}),clues:[...auction.clues,{...result.clue,round:auction.round,reveals}],bought:true,spent:auction.spent+option.cost}};
}
export function lockBid(save:AuctionSave,cents:number,now:number):AuctionSave{
 const auction=save.auction;
 if(!auction||auction.stage!=='round'||auction.selected!==null||now>=auction.deadline||!Number.isSafeInteger(cents)||cents<0||cents>save.wallet.cash)return save;
 const random=auctionRandom(auction.seed+auction.round*29);
 return {...save,auction:{...auction,selected:cents,npcs:auction.npcs.map(npc=>({...npc,lockAt:npc.locked?npc.lockAt:Math.min(npc.lockAt,now+500+Math.round(random()*2500))}))}};
}
export function auctionWinner(bids:RoundBid[],round:number,seed:number):{winner:RoundBid|null;buyout:boolean}{
 const positives=rankAuctionBids(bids,seed).filter(bid=>bid.cents>0);
 const buyout=round<4&&positives.length>=2&&positives[0].cents*100>=positives[1].cents*(100+AUCTION_ROUNDS[round-1].threshold);
 return {winner:round===4||buyout?positives[0]??null:null,buyout};
}
function resolveRound(save:AuctionSave,auction:Auction):AuctionSave{
 const bids:RoundBid[]=[{name:'You',cents:auction.selected??0,notes:auction.clues.map(clue=>({...clue}))},...auction.npcs.map(npc=>({name:npc.name,cents:npc.bid,notes:npcInvestigationNotes(npc,auction.round)}))];
 const {winner,buyout}=auctionWinner(bids,auction.round,auction.seed);
 if(!winner&&auction.round<4)return {...save,auction:{...auction,stage:'reveal',bids,bidHistory:[...auction.bidHistory,bids]}};
 const value=auction.lot.reduce((sum,card)=>sum+card.cents,0),fee=value-inventoryQuote(addInventory([],auction.lot),auction.lot,auction.feeBps).net,won=winner?.name==='You';
 const result={winner:winner?.name??null,bid:winner?.cents??0,value,fee,net:winner?value-fee-winner.cents-(won?auction.spent+(auction.entryFee??0):0):0,playerExpenses:auction.spent,buyout};
 const lossShares=auctionLossShares(result.winner,result.net,bids,auction.seed),credit=lossShares.find(share=>share.name==='You')?.cents??0;
 const profit=won?result.net:credit-auction.spent-(auction.entryFee??0);
 return {...save,...(auction.statisticsTracked?{statistics:recordAuctionResult(save,won,profit,credit,buyout)}:{}),wallet:won?{...save.wallet,cash:save.wallet.cash-result.bid,inventory:addInventory(save.wallet.inventory,auction.lot)}:{...save.wallet,cash:save.wallet.cash+credit},auction:{...auction,stage:'result',bids,bidHistory:[...auction.bidHistory,bids],result:{...result,lossShares}}};
}
export function tickAuction(save:AuctionSave,now:number):AuctionSave{
 const auction=save.auction;if(!auction||auction.stage!=='round')return save;
 const expired=now>=auction.deadline,npcs=auction.npcs.map(npc=>!npc.locked&&(expired||now>=npc.lockAt)?{...npc,locked:true}:npc);
 const selected=expired&&auction.selected===null?0:auction.selected;
 const next={...auction,selected,npcs};
 if(selected!==null&&npcs.every(npc=>npc.locked))return resolveRound(save,next);
 if(selected===auction.selected&&npcs.every((npc,index)=>npc===auction.npcs[index]))return save;
 return {...save,auction:next};
}
export function nextAuctionRound(save:AuctionSave,now:number):AuctionSave{
 if(save.auction?.stage!=='reveal')return save;
 return {...save,auction:openRound({...save.auction,round:save.auction.round+1},now)};
}
export function finishAuction(save:AuctionSave):AuctionSave{return save.auction?.stage==='result'?{...save,auction:null}:save}
// Entry/investigation costs were charged already. Leaving grants no lot or loss share;
// an un-settled sealed bid was not charged. Never discard a newer or settled auction.
export function leaveAuction(save:AuctionSave,seed:number):AuctionSave{
 const auction=save.auction;
 if(!auction||auction.seed!==seed||auction.stage==='result')return save;
 const statistics=auction.statisticsTracked?{...save.statistics!,abandoned:save.statistics!.abandoned+1,profit:save.statistics!.profit-auction.spent-(auction.entryFee??0)}:save.statistics;
 return {...save,...(statistics?{statistics}:{}),auction:null};
}
export function changeAuctionFee(save:AuctionSave,bps:number):AuctionSave{
 return !save.auction&&Number.isInteger(bps)&&bps>=0&&bps<=10000?{...save,wallet:{...save.wallet,feeBps:bps}}:save;
}
export function sellInventory(save:AuctionSave,catalog:AuctionCard[],key?:string,rarity?:string):AuctionSave{
 if(save.auction)return save;
 const quote=inventoryQuote(save.wallet.inventory,catalog,save.wallet.feeBps),sold=quote.rows.filter(row=>row.net!==null&&(!key||`${row.holding.productId}:${row.holding.printing}`===key)&&(!rarity||row.card&&auctionSaleRarity(row.card)===rarity));
 if(!sold.length)return save;
 const identities=new Set(sold.map(row=>row.holding));
 return {...save,wallet:{...save.wallet,cash:save.wallet.cash+sold.reduce((sum,row)=>sum+row.net!,0),inventory:save.wallet.inventory.filter(row=>!identities.has(row))}};
}
