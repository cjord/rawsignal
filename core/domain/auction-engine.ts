import {AUCTION_ROUNDS,auctionRandom,sampleIndices,type Auction,type AuctionCard,type AuctionSave,type Npc,type RoundBid} from "./auction-types.ts";
import {addInventory,inventoryQuote} from "./auction-market.ts";
import {generateAuctionLot} from './auction-lots.ts';
import {AUCTION_NPCS,auctionNpcRoster,auctionNpcMood} from './auction-npcs.ts';
import {informationOffers,investigate} from "./auction-information.ts";
import {auctionLossShares,auctionSaleRarity} from './auction-economy.ts';

// This bidder knows only sample prices and a count range, never the full lot or sealed player bid.
export function npcBid(sample:number[],range:[number,number],_priorBids:number[],personality:number,random:()=>number,feeBps=1000,confidence=1,participation=0):number{
 const npc=AUCTION_NPCS[personality]??AUCTION_NPCS[0];if(random()>Math.min(1,Math.max(0,npc.participation+participation)))return 0;
 const ordered=[...sample].sort((a,b)=>a-b),middle=Math.floor(ordered.length/2);
 const median=ordered.length?(ordered[middle]+ordered[Math.max(0,middle-(ordered.length%2===0?1:0))])/2:0;
 const sampleAverage=sample.reduce((sum,price)=>sum+price,0)/Math.max(1,sample.length);
 const estimate=(sampleAverage*.6+median*.4)*(range[0]+range[1])/2*(1-feeBps/10000);
 if(estimate<=0)return 0;
 return Math.max(1,Math.min(250000,Math.round(estimate*npc.margin*confidence*(1-npc.noise+random()*npc.noise*2))));
}
function roundNpcs(auction:Auction,now:number):Npc[]{
 const random=auctionRandom(auction.seed+auction.round*103);
 const roster=auction.npcs.length?auction.npcs.map(npc=>AUCTION_NPCS.find(profile=>profile.name===npc.name)!):auctionNpcRoster(auction.seed);
 return roster.map((npc,index)=>{
  const previous=auction.npcs.find(bidder=>bidder.name===npc.name)?.sample??[];
  const sample=[...previous,...sampleIndices(auction.lot.length,Math.max(0,3+auction.round-previous.length),auction.seed+index*67+auction.round,[0,2,...previous])];
  const prices=[...[0,2].map(slot=>auction.lot[slot].cents),...sample.map(slot=>auction.lot[slot].cents)];
  const mood=auctionNpcMood(auction.seed,npc.name),personality=AUCTION_NPCS.findIndex(profile=>profile.name===npc.name);
  return {name:npc.name,sample,bid:npcBid(prices,auction.range,[],personality,random,auction.feeBps,mood.confidence,mood.participation),lockAt:now+Math.round((.3+random()*.6)*AUCTION_ROUNDS[auction.round-1].seconds*1000),locked:false};
 });
}
function openRound(auction:Auction,now:number):Auction{
 const next={...auction,stage:'round' as const,deadline:now+AUCTION_ROUNDS[auction.round-1].seconds*1000,bought:false,selected:null,bids:[]};
 next.offers=informationOffers(next);next.npcs=roundNpcs(next,now);return next;
}
export function beginAuction(save:AuctionSave,catalog:AuctionCard[],now:number,prepared?:AuctionCard[],seed=7411+save.sequence*137):AuctionSave{
 if(save.auction)return save;
 const lot=(prepared??generateAuctionLot(catalog,seed)).map(card=>({...card}));if(lot.length<6)return save;
 const auction:Auction={seed,stage:'round',round:1,deadline:0,lot,range:[lot.length,lot.length],known:[0,2],priced:[0,2],offers:[],clues:[],bought:false,spent:0,selected:null,npcs:[],bids:[],bidHistory:[],result:null,feeBps:save.wallet.feeBps};
 return {...save,sequence:save.sequence+1,auction:openRound(auction,now)};
}
export function buyInformation(save:AuctionSave,id:string,now:number):AuctionSave{
 const auction=save.auction;
 if(!auction||auction.stage!=='round'||auction.selected!==null||auction.bought||now>=auction.deadline)return save;
 const option=auction.offers.find(option=>option.id===id);if(!option||save.wallet.cash<option.cost)return save;
 const result=investigate(auction,option);
 return {...save,wallet:{...save.wallet,cash:save.wallet.cash-option.cost},auction:{...auction,known:result.known,priced:result.priced,clues:[...auction.clues,result.clue],bought:true,spent:auction.spent+option.cost}};
}
export function lockBid(save:AuctionSave,cents:number,now:number):AuctionSave{
 const auction=save.auction;
 if(!auction||auction.stage!=='round'||auction.selected!==null||now>=auction.deadline||!Number.isSafeInteger(cents)||cents<0||cents>save.wallet.cash)return save;
 const random=auctionRandom(auction.seed+auction.round*29);
 return {...save,auction:{...auction,selected:cents,npcs:auction.npcs.map(npc=>({...npc,lockAt:npc.locked?npc.lockAt:Math.min(npc.lockAt,now+500+Math.round(random()*2500))}))}};
}
export function auctionWinner(bids:RoundBid[],round:number,seed:number):{winner:RoundBid|null;buyout:boolean}{
 const priority=['You',...bids.map(bid=>bid.name).filter(name=>name!=='You').sort()],offset=seed%4;
 const positives=bids.filter(bid=>bid.cents>0).sort((a,b)=>b.cents-a.cents||((priority.indexOf(a.name)+offset)%4)-((priority.indexOf(b.name)+offset)%4));
 const buyout=round<4&&positives.length>=2&&positives[0].cents*100>=positives[1].cents*(100+AUCTION_ROUNDS[round-1].threshold);
 return {winner:round===4||buyout?positives[0]??null:null,buyout};
}
function resolveRound(save:AuctionSave,auction:Auction):AuctionSave{
 const bids:RoundBid[]=[{name:'You',cents:auction.selected??0,notes:auction.clues.map(clue=>({...clue}))},...auction.npcs.map(npc=>({name:npc.name,cents:npc.bid,notes:[{id:'reveal3',label:'Public Starting Cards',text:'Used the publicly revealed starting cards.'},{id:'identity3',label:'Private Inspection',text:'Used personally inspected card information to estimate the collection. Exact identities, prices and estimates remain private.'}]}))];
 const {winner,buyout}=auctionWinner(bids,auction.round,auction.seed);
 if(!winner&&auction.round<4)return {...save,auction:{...auction,stage:'reveal',bids,bidHistory:[...auction.bidHistory,bids]}};
 const value=auction.lot.reduce((sum,card)=>sum+card.cents,0),fee=value-inventoryQuote(addInventory([],auction.lot),auction.lot,auction.feeBps).net,won=winner?.name==='You';
 const result={winner:winner?.name??null,bid:winner?.cents??0,value,fee,net:winner?value-fee-winner.cents-(won?auction.spent:0):0,playerExpenses:auction.spent,buyout};
 const lossShares=auctionLossShares(result.winner,result.net,bids,auction.seed),credit=lossShares.find(share=>share.name==='You')?.cents??0;
 return {...save,wallet:won?{...save.wallet,cash:save.wallet.cash-result.bid,inventory:addInventory(save.wallet.inventory,auction.lot)}:{...save.wallet,cash:save.wallet.cash+credit},auction:{...auction,stage:'result',bids,bidHistory:[...auction.bidHistory,bids],result:{...result,lossShares}}};
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
