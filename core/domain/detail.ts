import type {Card,CatalogDetail,SealedProduct,SimilarCatalogItem} from "./types.ts";

export const exactTcgplayerUrl=(url:string)=>/^https:\/\/www\.tcgplayer\.com\/product\/\d+\//i.test(url);

const words=(value:string)=>new Set(value.toLowerCase().replace(/\([^)]*\)/g," ").replace(/[^a-z0-9]+/g," ").split(" ").filter(word=>word.length>2));
const overlap=(a:Set<string>,b:Set<string>)=>[...a].filter(word=>b.has(word)).length;
const priceDistance=(a:number|null,b:number|null)=>a==null||b==null?1:Math.abs(Math.log((a+.01)/(b+.01)));

export function similarCards(card:Card,cards:Card[],limit=8):SimilarCatalogItem[]{
 const targetWords=words(card.name);
 return cards.filter(item=>item.productId!==card.productId&&item.game===card.game).map(item=>({item,score:overlap(targetWords,words(item.name))*8+Number(item.set===card.set)*5+Number(item.rarity===card.rarity)*2-priceDistance(item.marketPrice,card.marketPrice)})).sort((a,b)=>b.score-a.score||b.item.marketPrice-a.item.marketPrice).slice(0,limit).map(({item})=>({kind:"single",productId:item.productId,name:item.name,set:item.set,image:item.image||null,marketPrice:item.marketPrice,href:`/cards/${item.productId}`}));
}

export function similarSealed(product:SealedProduct,products:SealedProduct[],limit=8):SimilarCatalogItem[]{
 return products.filter(item=>item.productId!==product.productId&&item.game===product.game).map(item=>({item,score:Number(item.set===product.set)*10+Number(item.category===product.category)*4-priceDistance(item.marketPrice,product.marketPrice)})).sort((a,b)=>b.score-a.score||(b.item.marketPrice??-1)-(a.item.marketPrice??-1)).slice(0,limit).map(({item})=>({kind:"sealed",productId:item.productId,name:item.name,set:item.set,image:item.image,marketPrice:item.marketPrice,href:`/sealed/${item.productId}`}));
}

export function marketRank(value:number|null,values:Array<number|null>){
 if(value==null)return {rank:null,total:values.filter(item=>item!=null).length};
 const ordered=values.filter((item):item is number=>item!=null).sort((a,b)=>b-a);
 return {rank:ordered.findIndex(item=>item<=value)+1,total:ordered.length};
}

export function detailPercentile(detail:CatalogDetail){return detail.marketRank==null||!detail.marketRankTotal?null:Math.round((1-(detail.marketRank-1)/detail.marketRankTotal)*100)}

