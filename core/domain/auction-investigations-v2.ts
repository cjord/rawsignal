import {sampleIndices,type Auction,type Investigation,type AuctionCard,type Clue} from './auction-types.ts';
import {auctionRarityBand,auctionRarityLabel} from './auction-copy-policy.ts';

const specs=[
 ['rarity-peek12','Rarity Peek',400,'basic','rarity','any',12],
 ['rare-mark12','Rare Markers',300,'basic','rarity','rare',12],
 ['epic-mark8','Epic Markers',400,'targeted','rarity','epic',8],
 ['alt-mark5','Alt-Art Markers',500,'targeted','rarity','alt',5],
 ['identity5','Identity Peek',300,'targeted','identity','any',5],
 ['rare-identity8','Rare Identity Peek',400,'targeted','identity','rare',8],
 ['epic-identity5','Epic Identity Peek',600,'strong','identity','epic',5],
 ['identity12','Binder Preview',1000,'premium','identity','any',12],
 ['reveal5','Random Price Scan',600,'targeted','price','any',5],
 ['rare12','Rare Scan',600,'targeted','price','rare',12],
 ['epic6','Epic Scan',1000,'strong','price','epic',6],
 ['alt4','Alt-Art Scan',1200,'strong','price','alt',4],
 ['chase-mark-v2','Chase Marker',1000,'strong','rarity','chase',1],
 ['chase-identity-v2','Chase Identity Peek',2500,'premium','identity','chase',1],
 ['chase-scan-v2','Chase Scan',4500,'premium','price','chase',1],
] as const;
const descriptions={rarity:'rarity markers. No names, artwork or prices.',identity:'names and artworks, without prices.',price:'cards with identities and prices.'};
export const REBALANCED_INVESTIGATIONS:Investigation[]=[
 ...specs.map(([id,label,cost,tier,mode,,count])=>({id,label,cost,tier,description:`Reveal up to ${count} ${descriptions[mode]}`})),
 {id:'lot-audit',label:'Lot Audit',cost:400,tier:'basic',description:'Count sets, duplicate copies, commons and uncommons. Mark one hidden card’s rarity.'},
 {id:'rarities-v2',label:'Rarity Census',cost:1200,tier:'basic',description:'Count every rarity and premium treatment separately, without identities or prices.'},
 {id:'bulk-v2',label:'Bulk Valuation',cost:500,tier:'targeted',description:'Exact combined market value of common and uncommon copies.'},
 {id:'rares-v2',label:'Rare Valuation',cost:800,tier:'strong',description:'Exact combined market value of Rare-rarity copies.'},
 {id:'highest-rarity-v2',label:'Top Card Rarity',cost:1200,tier:'targeted',description:'Mark the most valuable card’s location and rarity. No identity or price.'},
 {id:'over5-mark',label:'$5 Price Check',cost:1500,tier:'basic',description:'Count copies above $5; mark one qualifying hidden copy’s rarity.'},
 {id:'over20-mark',label:'$20 Price Check',cost:2500,tier:'targeted',description:'Count copies above $20; mark one qualifying hidden copy’s rarity.'},
 {id:'concentration',label:'Concentration Report',cost:1200,tier:'strong',description:'Show whether value is spread out or concentrated in the top three copies. No exact percentage or total.'},
 {id:'top2-final',label:'Top-Two Valuation',cost:7500,tier:'premium',description:'Round 4 only. Exact combined value of the two highest-value copies, without identities.'},
 {id:'follow-up',label:'Follow-Up Inspection',cost:800,tier:'targeted',description:'Choose one card marked by your investigation in an earlier round and reveal its identity and price.'},
];
export const AUCTION_TOP_TWO_PAID_COST=12500;
export const rebalancedCost=(option:Investigation,auction:Auction)=>option.id==='top2-final'&&auction.kind==='paid'?AUCTION_TOP_TWO_PAID_COST:option.cost;
export function followUpSlots(auction:Auction){
 return [...new Set(auction.clues.filter(clue=>clue.round!==undefined&&clue.round<auction.round).flatMap(clue=>(clue.reveals??[]).filter(reveal=>reveal.visibility==='rarity').map(reveal=>reveal.slot)))].filter(slot=>Number.isSafeInteger(slot)&&slot>=0&&slot<auction.lot.length&&!auction.priced.includes(slot));
}
const matches=(card:AuctionCard,band:string)=>band==='any'||auctionRarityBand(card)===band||band==='chase'&&['over','signature'].includes(auctionRarityBand(card));
function scanSlots(auction:Auction,mode:string,band:string){
 return auction.lot.flatMap((card,slot)=>matches(card,band)&&!(mode==='price'?auction.priced.includes(slot):auction.known.includes(slot)||mode==='rarity'&&auction.rarityKnown?.includes(slot))?[slot]:[]);
}
export function rebalancedUseful(auction:Auction,id:string):boolean|null{
 const spec=specs.find(row=>row[0]===id);if(spec)return scanSlots(auction,spec[4],spec[5]).length>0;
 if(id==='follow-up')return followUpSlots(auction).length>0;
 if(id==='lot-audit'||id==='rarities-v2')return auction.known.length<auction.lot.length&&!auction.clues.some(clue=>clue.id==='rarities'||id==='rarities-v2'&&clue.id==='rarities-v2');
 if(id==='bulk-v2'||id==='rares-v2')return !auction.clues.some(clue=>clue.id===(id==='bulk-v2'?'bulk':'rares'))&&auction.lot.some((card,slot)=>(id==='bulk-v2'?/^(common|uncommon)$/i.test(card.rarity):/^rare$/i.test(card.rarity))&&!auction.priced.includes(slot));
 if(id==='top2-final')return auction.round===4&&!auction.clues.some(clue=>['top2','top5'].includes(clue.id))&&auction.lot.map((_,slot)=>slot).sort((a,b)=>auction.lot[b].cents-auction.lot[a].cents).slice(0,2).some(slot=>!auction.priced.includes(slot));
 if(['bulk-v2','rares-v2','highest-rarity-v2','rarities-v2'].includes(id)){
  const legacy={'bulk-v2':'bulk','rares-v2':'rares','highest-rarity-v2':'highest-rarity','rarities-v2':'rarities'}[id]!;
  return !auction.clues.some(clue=>clue.id===legacy)&&auction.priced.length<auction.lot.length;
 }
 return REBALANCED_INVESTIGATIONS.some(option=>option.id===id)?auction.priced.length<auction.lot.length:null;
}
const sum=(cards:AuctionCard[])=>cards.reduce((value,card)=>value+card.cents,0);
const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
function applyScan(auction:Auction,spec:typeof specs[number],known:Set<number>,priced:Set<number>,rarityKnown:Set<number>){
 const candidates=scanSlots(auction,spec[4],spec[5]),slots=sampleIndices(candidates.length,spec[6],auction.seed+auction.round*97).map(index=>candidates[index]);
 for(const slot of slots){if(spec[4]==='rarity')rarityKnown.add(slot);else known.add(slot);if(spec[4]==='price')priced.add(slot);}
 return `${slots.length} ${spec[4]==='rarity'?'rarity markers added. Identities and prices remain hidden.':spec[4]==='identity'?'identities revealed without prices.':'copies revealed with prices.'}`;
}
export function rebalancedResult(auction:Auction,option:Investigation,targetSlot?:number){
 if(!REBALANCED_INVESTIGATIONS.some(row=>row.id===option.id))return null;
 const spec=specs.find(row=>row[0]===option.id),known=new Set(auction.known),priced=new Set(auction.priced),rarityKnown=new Set(auction.rarityKnown??[]);
 const mark=(slots:number[])=>slots.forEach(slot=>rarityKnown.add(slot));
 let text='',topCardSlot=auction.topCardSlot;
 if(spec){
  text=applyScan(auction,spec,known,priced,rarityKnown);
 }else if(option.id==='follow-up'){
  if(targetSlot===undefined||!followUpSlots(auction).includes(targetSlot))return null;
  known.add(targetSlot);priced.add(targetSlot);text='1 previously marked card revealed with its price.';
 }else if(option.id==='lot-audit'){
  const counts=new Map<string,number>();for(const card of auction.lot)counts.set(card.set,(counts.get(card.set)??0)+1);
  text=`Common copies: ${auction.lot.filter(card=>/^common$/i.test(card.rarity)).length}\nUncommon copies: ${auction.lot.filter(card=>/^uncommon$/i.test(card.rarity)).length}\nDuplicate copies: ${auction.lot.length-new Set(auction.lot.map(card=>`${card.productId}:${card.printing}`)).size}\nSets: ${[...counts].map(([set,count])=>`${set}: ${count}`).join(' · ')}`;
  const candidates=scanSlots(auction,'rarity','any');mark(sampleIndices(candidates.length,1,auction.seed+auction.round*97).map(index=>candidates[index]));
 }else if(option.id==='rarities-v2'){
  const groups=new Map<string,number>();for(const card of auction.lot){const label=auctionRarityBand(card)==='other'?'Other':auctionRarityLabel(card);groups.set(label,(groups.get(label)??0)+1);}
  text=[...groups].map(([label,count])=>`${label}: ${count}`).join(' · ');
 }else if(option.id==='highest-rarity-v2'){
  topCardSlot=auction.lot.findIndex(card=>card.cents===Math.max(...auction.lot.map(row=>row.cents)));mark([topCardSlot]);text=`Top card rarity: ${auctionRarityLabel(auction.lot[topCardSlot])}. Its location is marked; no additional identity or price is revealed.`;
 }else if(option.id==='over5-mark'||option.id==='over20-mark'){
  const candidates=auction.lot.flatMap((card,slot)=>card.cents>(option.id==='over5-mark'?500:2000)?[slot]:[]);
  const hidden=candidates.filter(slot=>!auction.known.includes(slot)&&!rarityKnown.has(slot));mark(sampleIndices(hidden.length,1,auction.seed+auction.round*97).map(index=>hidden[index]));
  text=`${candidates.length} copies above ${option.id==='over5-mark'?'$5':'$20'}. ${hidden.length?'One qualifying hidden copy’s rarity is marked.':'No additional hidden rarity marker available.'}`;
 }else if(option.id==='concentration'){
  const share=sum([...auction.lot].sort((a,b)=>b.cents-a.cents).slice(0,3))/sum(auction.lot);
  text=share<.3?'Low concentration: the top three copies hold under 30% of collection value.':share<.6?'Medium concentration: the top three copies hold 30% to under 60% of collection value.':'High concentration: the top three copies hold at least 60% of collection value.';
 }else text=money(option.id==='top2-final'?sum([...auction.lot].sort((a,b)=>b.cents-a.cents).slice(0,2)):sum(auction.lot.filter(card=>option.id==='bulk-v2'?/^(common|uncommon)$/i.test(card.rarity):/^rare$/i.test(card.rarity))));
 return {known:[...known],priced:[...priced],rarityKnown:[...rarityKnown],...(topCardSlot===undefined?{}:{topCardSlot}),clue:{id:option.id,label:option.label,text}};
}

// Translate only facts actually disclosed by the versioned clue, never hidden prices.
export function valuationClues(clues:Clue[]):Clue[]{
 return clues.flatMap(clue=>{
  if(clue.id==='lot-audit')return ['common','uncommon','duplicates'].map((kind,index)=>({...clue,id:['common-count','uncommon-count','duplicates'][index],text:`${new RegExp(`${kind==='duplicates'?'Duplicate':kind==='common'?'Common':'Uncommon'} copies: (\\d+)`).exec(clue.text)?.[1]??0} copies.`}));
  const aliases:Record<string,string>={'bulk-v2':'bulk','rares-v2':'rares','top2-final':'top2'};
  return [{...clue,id:aliases[clue.id]??clue.id}];
 });
}
