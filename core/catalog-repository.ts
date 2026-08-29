import type { Card, CatalogDetail, CatalogDetailEnrichment, CatalogKind, GradedCardData, PeerAnchorStats, PullRateConfig, RarityPullRate, SealedProduct } from "./domain/types.ts";
import {exactTcgplayerUrl,marketRank,similarCards,similarSealed} from "./domain/detail.ts";
import { querySealedCatalog, querySinglesCatalog, type CatalogDerived, type CatalogPage, type SealedCatalogQuery, type SinglesCatalogQuery } from "./catalog-query.ts";

export interface CatalogRepository {
  querySingles(options: SinglesCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<Card>>;
  querySealed(options: SealedCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<SealedProduct>>;
  getDetail(kind:CatalogKind,productId:number,market?:string):Promise<CatalogDetail|null>;
}

const emptySource={categoryId:null,groupId:null,setAbbreviation:null,publishedOn:null,modifiedOn:null,imageCount:null,isPresale:null,presaleNote:null,sourceUpdatedAt:null};

// "Other" peers only: the product itself is excluded, and unavailable prices stay out of the
// average. Rank and quartiles (H2) place this product within the cohort including itself.
function peerAverage(label:string,prices:(number|null)[],current:number|null=null){
 const usable=prices.filter((price):price is number=>price!=null&&price>0).sort((a,b)=>a-b);
 const averagePrice=usable.length?usable.reduce((sum,price)=>sum+price,0)/usable.length:null;
 const hasCurrent=current!=null&&current>0;
 const position=hasCurrent&&usable.length?1+usable.filter(price=>price>current).length:null;
 const quantile=(q:number)=>{const index=(usable.length-1)*q,low=Math.floor(index),high=Math.ceil(index);return usable[low]+(usable[high]-usable[low])*(index-low)};
 const quartiles=usable.length>=4?{min:usable[0],q1:quantile(.25),median:quantile(.5),q3:quantile(.75),max:usable[usable.length-1]}:null;
 return {label,averagePrice,count:usable.length,position,cohortSize:usable.length+(hasCurrent?1:0),quartiles};
}

// Curated community-measured packs-per-hit. Config keys may be a rarity string or a section
// slug; the section wins when both match (tiers like Riftbound's Showcase share one rarity).
// Exported so the metrics payload prices set-level pack EV with the same resolution rules.
export function pullRateFor(config:PullRateConfig|undefined,game:string,set:string,card:{rarity:string;section?:string}){
 const entry=config?.games[game];if(!entry)return null;
 for(const table of [entry.sets[set],entry.default]){
  if(!table)continue;
  if(card.section&&typeof table[card.section]==="number"&&table[card.section]>0)return {key:card.section,packsPerHit:table[card.section],bySection:true};
  if(typeof table[card.rarity]==="number"&&table[card.rarity]>0)return {key:card.rarity,packsPerHit:table[card.rarity],bySection:false};
 }
 return null;
}
const tierLabel=(key:string,bySection:boolean)=>bySection?key.split("-").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" "):key;

export function createMemoryCatalogRepository(cards: Card[], sealedProducts: SealedProduct[], enrichments:CatalogDetailEnrichment[]=[], pullRateConfig?:PullRateConfig, gradedByProductId?:Record<string,GradedCardData>, peerAnchorsByCohort?:Record<string,PeerAnchorStats>): CatalogRepository {
  const uniqueCards = [...new Map(cards.map(card => [card.productId, card])).values()];
  const uniqueSealed = [...new Map(sealedProducts.map(product => [product.productId, product])).values()];
  const enrichmentByKey=new Map(enrichments.map(detail=>[`${detail.kind}:${detail.productId}`,detail]));
  const packPriceForSet=(set:string)=>{const packs=uniqueSealed.filter(item=>item.set===set&&item.category==="Booster Packs"&&item.marketPrice!=null&&item.marketPrice>0);return packs.length?Math.min(...packs.map(item=>item.marketPrice as number)):null};
  return {
    async querySingles(options, derived = {}) {
      return querySinglesCatalog(uniqueCards, options, derived);
    },
    async querySealed(options, derived = {}) {
      return querySealedCatalog(uniqueSealed, options, derived);
    },
    async getDetail(kind,productId,market){
      const enrichment=enrichmentByKey.get(`${kind}:${productId}`);
      if(kind==="single"){
        const card=uniqueCards.find(item=>item.productId===productId);if(!card)return null;
        const peers=uniqueCards.filter(item=>item.game===card.game&&item.set===card.set&&(item.rarity===card.rarity||item.section===card.section)),rank=marketRank(card.marketPrice,peers.map(item=>item.marketPrice));
        const rarityPeers=uniqueCards.filter(item=>item.game===card.game&&item.rarity===card.rarity&&item.productId!==card.productId);
        const setRarityPeers=rarityPeers.filter(item=>item.set===card.set);
        // Pokémon cases are wholesale-priced outliers that crowd out every consumer product in a market-sorted top 12.
        const cardRelatedSealed=uniqueSealed.filter(item=>item.game===card.game&&item.set===card.set&&!(item.game==="pokemon"&&item.category==="Cases")).sort((a,b)=>(b.marketPrice??-1)-(a.marketPrice??-1)).slice(0,12);
        const resolvedRate=pullRateFor(pullRateConfig,card.game,card.set,card);
        const tierCount=resolvedRate?uniqueCards.filter(item=>item.set===card.set&&(resolvedRate.bySection?item.section===card.section:item.rarity===card.rarity)).length:0;
        const cardPackPrice=resolvedRate!=null?packPriceForSet(card.set):null;
        const pullRate=resolvedRate!=null&&tierCount>0?{packsPerHit:resolvedRate.packsPerHit,packsPerCard:resolvedRate.packsPerHit*tierCount,packPrice:cardPackPrice,costPerCard:cardPackPrice!=null?resolvedRate.packsPerHit*tierCount*cardPackPrice:null}:null;
        return {...card,kind:"single",image:card.image||null,exactTcgplayerUrl:exactTcgplayerUrl(card.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:card.printing,marketPrice:card.marketPrice,lowPrice:card.lowPrice,directLowPrice:null,midPrice:card.midPrice,highPrice:card.highPrice}],source:enrichment?.source??emptySource,similar:similarCards(card,uniqueCards),marketRank:rank.rank,marketRankTotal:rank.total,peerContext:peerAverage(`${card.rarity} cards`,rarityPeers.map(item=>item.marketPrice),card.marketPrice),setPeerContext:peerAverage(`${card.rarity} cards in ${card.set}`,setRarityPeers.map(item=>item.marketPrice),card.marketPrice),pullRate,graded:gradedByProductId?.[String(card.productId)]??null,peerAnchor:peerAnchorsByCohort?.[`${card.game}|${card.set}|${card.rarity}`]??null,relatedSealed:cardRelatedSealed};
      }
      const candidates=market==="scalping"?uniqueSealed:uniqueSealed.filter(item=>!market||item.game===market),product=candidates.find(item=>item.productId===productId)??uniqueSealed.find(item=>item.productId===productId);if(!product)return null;
      const peers=uniqueSealed.filter(item=>item.game===product.game&&item.set===product.set&&item.category===product.category),rank=marketRank(product.marketPrice,peers.map(item=>item.marketPrice));
      const categoryPeers=candidates.filter(item=>item.category===product.category&&item.productId!==product.productId);
      // The cheapest plain booster pack anchors the chase-card cutoff; sleeved and bundle packs price higher.
      const packPrice=packPriceForSet(product.set);
      const setCards=uniqueCards.filter(item=>item.set===product.set&&item.marketPrice>0).sort((a,b)=>b.marketPrice-a.marketPrice);
      const chaseCards=(packPrice!=null?setCards.filter(item=>item.marketPrice>packPrice):setCards).slice(0,12);
      const relatedSealed=candidates.filter(item=>item.set===product.set&&item.productId!==product.productId).sort((a,b)=>(b.marketPrice??-1)-(a.marketPrice??-1)).slice(0,48);
      const tierGroups=new Map<string,{label:string;packsPerHit:number;cards:Card[]}>();
      for(const item of setCards){const resolved=pullRateFor(pullRateConfig,product.game,product.set,item);if(resolved==null)continue;const group=tierGroups.get(resolved.key)??{label:tierLabel(resolved.key,resolved.bySection),packsPerHit:resolved.packsPerHit,cards:[]};group.cards.push(item);tierGroups.set(resolved.key,group)}
      const pullRates:RarityPullRate[]=[...tierGroups.values()].map(group=>({rarity:group.label,cardCount:group.cards.length,packsPerHit:group.packsPerHit,costPerHit:packPrice!=null?group.packsPerHit*packPrice:null,averageMarket:group.cards.length?group.cards.reduce((sum,item)=>sum+item.marketPrice,0)/group.cards.length:null})).sort((a,b)=>(b.averageMarket??0)-(a.averageMarket??0));
      // A case is its unit product at a multiplier (audit N5). Case sizes vary by era and
      // product, so the honest number is the observed price multiple against the matching
      // unit (name minus the trailing "Case"), never an assumed per-case count.
      const unitName=product.category==="Cases"?product.name.replace(/\s+Case\b.*$/i,"").trim().toLowerCase():null;
      const unit=unitName?uniqueSealed.find(item=>item.set===product.set&&item.productId!==product.productId&&item.name.trim().toLowerCase()===unitName):null;
      const caseUnit=unit&&unit.marketPrice!=null&&unit.marketPrice>0&&product.marketPrice!=null?{productId:unit.productId,name:unit.name,marketPrice:unit.marketPrice,multiple:product.marketPrice/unit.marketPrice}:null;
      return {...product,kind:"sealed",exactTcgplayerUrl:exactTcgplayerUrl(product.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:"Sealed",marketPrice:product.marketPrice,lowPrice:null,directLowPrice:null,midPrice:product.midPrice,highPrice:null}],source:enrichment?.source??emptySource,similar:similarSealed(product,uniqueSealed),marketRank:rank.rank,marketRankTotal:rank.total,peerContext:peerAverage(product.category,categoryPeers.map(item=>item.marketPrice),product.marketPrice),packPrice,chaseCards,relatedSealed,pullRates,caseUnit,graded:null};
    },
  };
}
