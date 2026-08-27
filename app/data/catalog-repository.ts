import type { Card, CatalogDetail, CatalogDetailEnrichment, CatalogKind, PullRateConfig, RarityPullRate, SealedProduct } from "../domain/types.ts";
import {exactTcgplayerUrl,marketRank,similarCards,similarSealed} from "../domain/detail.ts";
import { querySealedCatalog, querySinglesCatalog, type CatalogDerived, type CatalogPage, type SealedCatalogQuery, type SinglesCatalogQuery } from "./catalog-query.ts";

export interface CatalogRepository {
  querySingles(options: SinglesCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<Card>>;
  querySealed(options: SealedCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<SealedProduct>>;
  getDetail(kind:CatalogKind,productId:number,market?:string):Promise<CatalogDetail|null>;
}

const emptySource={categoryId:null,groupId:null,setAbbreviation:null,publishedOn:null,modifiedOn:null,imageCount:null,isPresale:null,presaleNote:null,sourceUpdatedAt:null};

// "Other" peers only: the product itself is excluded, and unavailable prices stay out of the average.
function peerAverage(label:string,prices:(number|null)[]){
 const usable=prices.filter((price):price is number=>price!=null&&price>0);
 return {label,averagePrice:usable.length?usable.reduce((sum,price)=>sum+price,0)/usable.length:null,count:usable.length};
}

// Curated community-measured packs-per-hit for one card of the rarity; null when uncurated.
function pullRateFor(config:PullRateConfig|undefined,game:string,set:string,rarity:string){
 const entry=config?.games[game];if(!entry)return null;
 const packs=entry.sets[set]?.[rarity]??entry.default[rarity];
 return typeof packs==="number"&&packs>0?packs:null;
}

export function createMemoryCatalogRepository(cards: Card[], sealedProducts: SealedProduct[], enrichments:CatalogDetailEnrichment[]=[], pullRateConfig?:PullRateConfig): CatalogRepository {
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
        const packsPerHit=pullRateFor(pullRateConfig,card.game,card.set,card.rarity),rarityCount=setRarityPeers.length+1,cardPackPrice=packsPerHit!=null?packPriceForSet(card.set):null;
        const pullRate=packsPerHit!=null?{packsPerHit,packsPerCard:packsPerHit*rarityCount,packPrice:cardPackPrice,costPerCard:cardPackPrice!=null?packsPerHit*rarityCount*cardPackPrice:null}:null;
        return {...card,kind:"single",image:card.image||null,exactTcgplayerUrl:exactTcgplayerUrl(card.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:card.printing,marketPrice:card.marketPrice,lowPrice:card.lowPrice,directLowPrice:null,midPrice:card.midPrice,highPrice:card.highPrice}],source:enrichment?.source??emptySource,similar:similarCards(card,uniqueCards),marketRank:rank.rank,marketRankTotal:rank.total,peerContext:peerAverage(`${card.rarity} cards`,rarityPeers.map(item=>item.marketPrice)),setPeerContext:peerAverage(`${card.rarity} cards in ${card.set}`,setRarityPeers.map(item=>item.marketPrice)),pullRate,graded:null};
      }
      const candidates=market==="scalping"?uniqueSealed:uniqueSealed.filter(item=>!market||item.game===market),product=candidates.find(item=>item.productId===productId)??uniqueSealed.find(item=>item.productId===productId);if(!product)return null;
      const peers=uniqueSealed.filter(item=>item.game===product.game&&item.set===product.set&&item.category===product.category),rank=marketRank(product.marketPrice,peers.map(item=>item.marketPrice));
      const categoryPeers=candidates.filter(item=>item.category===product.category&&item.productId!==product.productId);
      // The cheapest plain booster pack anchors the chase-card cutoff; sleeved and bundle packs price higher.
      const packPrice=packPriceForSet(product.set);
      const setCards=uniqueCards.filter(item=>item.set===product.set&&item.marketPrice>0).sort((a,b)=>b.marketPrice-a.marketPrice);
      const chaseCards=(packPrice!=null?setCards.filter(item=>item.marketPrice>packPrice):setCards).slice(0,12);
      const relatedSealed=candidates.filter(item=>item.set===product.set&&item.productId!==product.productId).sort((a,b)=>(b.marketPrice??-1)-(a.marketPrice??-1)).slice(0,48);
      const rarityGroups=new Map<string,Card[]>();for(const item of setCards){const group=rarityGroups.get(item.rarity)??[];group.push(item);rarityGroups.set(item.rarity,group)}
      const pullRates:RarityPullRate[]=[...rarityGroups.entries()].flatMap(([rarity,group])=>{const packsPerHit=pullRateFor(pullRateConfig,product.game,product.set,rarity);if(packsPerHit==null)return[];return[{rarity,cardCount:group.length,packsPerHit,costPerHit:packPrice!=null?packsPerHit*packPrice:null,averageMarket:group.length?group.reduce((sum,item)=>sum+item.marketPrice,0)/group.length:null}]}).sort((a,b)=>(b.averageMarket??0)-(a.averageMarket??0));
      return {...product,kind:"sealed",exactTcgplayerUrl:exactTcgplayerUrl(product.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:"Sealed",marketPrice:product.marketPrice,lowPrice:null,directLowPrice:null,midPrice:product.midPrice,highPrice:null}],source:enrichment?.source??emptySource,similar:similarSealed(product,uniqueSealed),marketRank:rank.rank,marketRankTotal:rank.total,peerContext:peerAverage(product.category,categoryPeers.map(item=>item.marketPrice)),packPrice,chaseCards,relatedSealed,pullRates,graded:null};
    },
  };
}
