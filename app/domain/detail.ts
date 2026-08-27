import type {Card,CatalogDetail,DetailMetadataField,DetailPriceVariant,SealedProduct,SimilarCatalogItem} from "./types";

type RawExtendedField={name?:unknown;displayName?:unknown;value?:unknown};

const entityMap:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};
export function metadataText(value:unknown){
 if(typeof value!=="string")return "";
 return value.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(_,entity:string)=>{
  if(entity[0]==="#"){const hex=entity[1]?.toLowerCase()==="x",code=Number.parseInt(entity.slice(hex?2:1),hex?16:10);return Number.isFinite(code)?String.fromCodePoint(code):""}
  return entityMap[entity.toLowerCase()]??`&${entity};`;
 }).replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}

export function normalizeExtendedData(fields:RawExtendedField[]|undefined):DetailMetadataField[]{
 return (fields??[]).map(field=>({name:metadataText(field.name),label:metadataText(field.displayName)||metadataText(field.name),value:metadataText(field.value)})).filter(field=>field.name&&field.value);
}

export const exactTcgplayerUrl=(url:string)=>/^https:\/\/www\.tcgplayer\.com\/product\/\d+\//i.test(url);
const dollars=(value:unknown)=>Number(value)>0?Number(value):null;
export function detailPriceVariants(rows:Array<Record<string,unknown>>|undefined,fallback?:DetailPriceVariant):DetailPriceVariant[]{
 const variants=(rows??[]).map(row=>({printing:String(row.subTypeName??"Normal"),marketPrice:dollars(row.marketPrice),lowPrice:dollars(row.lowPrice),directLowPrice:dollars(row.directLowPrice),midPrice:dollars(row.midPrice),highPrice:dollars(row.highPrice)})).filter(row=>Object.values(row).some((value,index)=>index>0&&value!=null));
 return variants.length?variants:fallback?[fallback]:[];
}

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

