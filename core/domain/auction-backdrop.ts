import {auctionRandom,type AuctionCard} from './auction-types.ts';

// A group covers the viewport plus two incoming cards; its identical twin makes
// the -50% lane translation seamless. Match the CSS clamp(110px,15vw,190px)/28px gap.
export function auctionBackdropSlots(viewportWidth:number){
 const width=Number.isFinite(viewportWidth)?Math.max(0,viewportWidth):1440;
 const cardWidth=Math.min(190,Math.max(110,width*.15));
 return Math.max(5,Math.ceil(width/(cardWidth+28))+2);
}

// Keep the directed pixel offset (modulo the new repeat width) on resize rather
// than jumping back to the start. Does not restart the animation object.
export function backdropResizeTime(time:number,duration:number,previousWidth:number,nextWidth:number,reverse=false){
 if(![time,duration,previousWidth,nextWidth].every(Number.isFinite)||time<0||duration<=0||previousWidth<=0||nextWidth<=0)return time;
 const iteration=Math.floor(time/duration),fraction=time/duration-iteration,progress=reverse?1-fraction:fraction;
 const nextProgress=(progress*previousWidth%nextWidth)/nextWidth;
 return (iteration+(reverse?1-nextProgress:nextProgress))*duration;
}

// Decoration is at most 190 CSS pixels wide. Only rewrite the verified CDN format;
// callers retain the original for one fallback attempt if its thumbnail is missing.
export function auctionBackdropThumbnail(image:string){
 return image.replace(/^(https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+)_in_1000x1000(\.jpg)$/i,'$1_200w$2');
}

// Decorative catalog sample only: never inspect the prepared/hidden auction lot.
export function auctionBackdropImages(catalog:(Pick<AuctionCard,'image'>&Partial<Pick<AuctionCard,'rarity'|'section'>>)[],seed:number,count=18):string[]{
 const images=new Map<string,number>();
 for(const card of catalog){
  const image=card.image.trim();if(!/^https?:\/\//.test(image))continue;
  const treatment=`${card.section??''} ${card.rarity??''}`;
  const weight=/signature|over.?number|showcase|promo|metal|alt/i.test(treatment)?8:/epic/i.test(treatment)?4:/\brare\b/i.test(treatment)?2:1;
  images.set(image,Math.max(images.get(image)??0,weight));
 }
 const random=auctionRandom(seed);
 return [...images].sort(([a],[b])=>a.localeCompare(b)).map(([image,weight])=>({image,score:-Math.log(Math.max(Number.EPSILON,random()))/weight})).sort((a,b)=>a.score-b.score).slice(0,Math.max(0,count)).map(row=>row.image);
}
