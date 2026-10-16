import {imageHeaderSize} from '../core/domain/image-header.ts';
import {isTcgplayerPlaceholder} from '../core/domain/image-availability.ts';

export type GameArtworkCheck=(url:string)=>Promise<boolean>;
const cache=new Map<string,{until:number;result:Promise<boolean>}>();
const MAX_HEADER_BYTES=65536;
// Never follow catalog-supplied redirects or fetch arbitrary hosts from the Worker.
const allowed=(url:string)=>/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+(?:_in_\d+x\d+|_\d+w)?\.jpg$/.test(url);
async function headerBytes(body:ReadableStream<Uint8Array>):Promise<Uint8Array>{
 const reader=body.getReader(),output=new Uint8Array(MAX_HEADER_BYTES);let length=0;
 try{while(length<output.length){const {done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,output.length-length);output.set(chunk,length);length+=chunk.length}}
 finally{await reader.cancel()}
 return output.subarray(0,length);
}
export async function checkGameArtwork(url:string,fetcher:typeof fetch=fetch):Promise<boolean>{
 if(!allowed(url))return false;
 const response=await fetcher(url,{headers:{Range:`bytes=0-${MAX_HEADER_BYTES-1}`},redirect:'manual',signal:AbortSignal.timeout(8000)});
 if(response.status===403||response.status===404){await response.body?.cancel();return false}
 if(!response.ok){await response.body?.cancel();throw new Error('Artwork source temporarily unavailable')}
 if(!response.body)return false;
 const size=imageHeaderSize(await headerBytes(response.body));
 return !!size&&size.width>0&&size.height>0&&!isTcgplayerPlaceholder({src:url,naturalWidth:size.width,naturalHeight:size.height});
}
// A bounded first-use check, not a per-player or per-round image/API spender.
export function dailyGameArtworkCheck():GameArtworkCheck{
 let calls=0;
 return async url=>{
  const now=Date.now(),stored=cache.get(url);if(stored&&stored.until>now)return stored.result;
  if(++calls>600)throw new Error('Daily artwork check budget reached; retry initialization');
  if(cache.size>=2000)for(const key of [...cache.keys()].slice(0,500))cache.delete(key);
  const result=checkGameArtwork(url).then(valid=>{const entry=cache.get(url);if(entry)entry.until=Date.now()+(valid?3600000:300000);return valid},error=>{cache.delete(url);throw error});
  cache.set(url,{until:now+300000,result});return result;
 };
}
export async function failedGameArtwork(cards:{image:string}[],check:GameArtworkCheck):Promise<Set<string>>{
 const urls=[...new Set(cards.map(card=>card.image))],failed=new Set<string>();let cursor=0;
 await Promise.all(Array.from({length:Math.min(6,urls.length)},async()=>{
  while(cursor<urls.length){const url=urls[cursor++];if(!await check(url))failed.add(url)}
 }));
 return failed;
}
