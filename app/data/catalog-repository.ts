import type { Card, CatalogDetail, CatalogDetailEnrichment, CatalogKind, SealedProduct } from "../domain/types.ts";
import {exactTcgplayerUrl,marketRank,similarCards,similarSealed} from "../domain/detail.ts";
import { querySealedCatalog, querySinglesCatalog, type CatalogDerived, type CatalogPage, type SealedCatalogQuery, type SinglesCatalogQuery } from "./catalog-query.ts";

export interface CatalogRepository {
  querySingles(options: SinglesCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<Card>>;
  querySealed(options: SealedCatalogQuery, derived?: Record<number, CatalogDerived | undefined>): Promise<CatalogPage<SealedProduct>>;
  getDetail(kind:CatalogKind,productId:number,market?:string):Promise<CatalogDetail|null>;
}

const emptySource={categoryId:null,groupId:null,setAbbreviation:null,publishedOn:null,modifiedOn:null,imageCount:null,isPresale:null,presaleNote:null,sourceUpdatedAt:null};

export function createMemoryCatalogRepository(cards: Card[], sealedProducts: SealedProduct[], enrichments:CatalogDetailEnrichment[]=[]): CatalogRepository {
  const uniqueCards = [...new Map(cards.map(card => [card.productId, card])).values()];
  const uniqueSealed = [...new Map(sealedProducts.map(product => [product.productId, product])).values()];
  const enrichmentByKey=new Map(enrichments.map(detail=>[`${detail.kind}:${detail.productId}`,detail]));
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
        return {...card,kind:"single",image:card.image||null,exactTcgplayerUrl:exactTcgplayerUrl(card.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:card.printing,marketPrice:card.marketPrice,lowPrice:card.lowPrice,directLowPrice:null,midPrice:card.midPrice,highPrice:card.highPrice}],source:enrichment?.source??emptySource,similar:similarCards(card,uniqueCards),marketRank:rank.rank,marketRankTotal:rank.total,graded:null};
      }
      const candidates=market==="scalping"?uniqueSealed:uniqueSealed.filter(item=>!market||item.game===market),product=candidates.find(item=>item.productId===productId)??uniqueSealed.find(item=>item.productId===productId);if(!product)return null;
      const peers=uniqueSealed.filter(item=>item.game===product.game&&item.set===product.set&&item.category===product.category),rank=marketRank(product.marketPrice,peers.map(item=>item.marketPrice));
      return {...product,kind:"sealed",exactTcgplayerUrl:exactTcgplayerUrl(product.url),metadata:enrichment?.metadata??[],priceVariants:enrichment?.priceVariants??[{printing:"Sealed",marketPrice:product.marketPrice,lowPrice:null,directLowPrice:null,midPrice:product.midPrice,highPrice:null}],source:enrichment?.source??emptySource,similar:similarSealed(product,uniqueSealed),marketRank:rank.rank,marketRankTotal:rank.total,graded:null};
    },
  };
}
