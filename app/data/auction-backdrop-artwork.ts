import {auctionBackdropThumbnail} from '../../core/domain/auction-backdrop.ts';
import {isTcgplayerPlaceholder} from '../../core/domain/image-availability.ts';

export type BackdropImageLoader=(source:string,signal:AbortSignal)=>Promise<string|null>;
const EMPTY_SLOTS:readonly(string|null)[]=Array(18).fill(null);

function decodeImage(source:string,signal:AbortSignal,timeoutMs=5000):Promise<boolean>{
 return new Promise(resolve=>{
  if(signal.aborted){resolve(false);return}
  const image=new Image();image.fetchPriority='low';image.decoding='async';let settled=false;
  const finish=(valid:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);image.onload=null;image.onerror=null;if(!valid)image.removeAttribute('src');resolve(valid)};
  const abort=()=>finish(false),timer=setTimeout(abort,timeoutMs);
  signal.addEventListener('abort',abort,{once:true});image.onerror=()=>finish(false);
  // Preserve the legacy 400×570 missing-art sentinel even on non-CDN sources.
  image.onload=async()=>{try{await image.decode();finish(!signal.aborted&&image.naturalWidth>0&&image.naturalHeight>0&&!isTcgplayerPlaceholder(image)&&!(image.naturalWidth===400&&image.naturalHeight===570))}catch{finish(false)}};
  image.src=source;
 });
}

export const loadBackdropImage:BackdropImageLoader=async(source,signal)=>{
 const thumbnail=auctionBackdropThumbnail(source);
 if(await decodeImage(thumbnail,signal))return thumbnail;
 if(signal.aborted||thumbnail===source)return null;
 return await decodeImage(source,signal)?source:null;
};

// One shared resource per source, eighteen stable logical slots, at most four
// low-priority decodes at once. Rendered twins only receive decoded URLs.
export function createBackdropArtwork(candidates:string[],loader:BackdropImageLoader=loadBackdropImage){
 const pool=[...new Set(candidates)].slice(0,36),assigned:(string|null)[]=Array.from({length:18},(_,index)=>pool[index%pool.length]??null);
 const cache=new Map<string,string|null>(),failed=new Set<string>(),pending=new Set<string>(),listeners=new Set<()=>void>();
 let snapshot=EMPTY_SLOTS,indices:number[]=[],running=0,epoch=0,enabled=false,controller=new AbortController();
 const publish=(next:readonly(string|null)[])=>{if(next.every((src,index)=>src===snapshot[index]))return;snapshot=next;for(const listener of listeners)listener()};
 const replace=(source:string)=>{
  failed.add(source);
  const replacement=pool.find(src=>!failed.has(src)&&!assigned.includes(src))??assigned.find(src=>src&&!failed.has(src))??null;
  const next=[...snapshot];assigned.forEach((src,index)=>{if(src!==source)return;assigned[index]=replacement;next[index]=replacement?cache.get(replacement)??null:null});publish(next);
 };
 const finish=(source:string,resolved:string|null)=>{
  cache.set(source,resolved);
  if(resolved)publish(snapshot.map((current,index)=>assigned[index]===source?resolved:current));else replace(source);
 };
 const nextSource=()=>indices.map(index=>assigned[index]).find((src):src is string=>Boolean(src&&!cache.has(src)&&!pending.has(src)&&!failed.has(src)));
 const drain=()=>{
  if(!enabled)return;
  let source=nextSource();
  while(running<4&&source){
   const selected=source,generation=epoch,signal=controller.signal;running++;pending.add(selected);
   void Promise.resolve().then(()=>signal.aborted?null:loader(selected,signal)).catch(()=>null).then(resolved=>{if(enabled&&generation===epoch)finish(selected,resolved)}).finally(()=>{if(generation!==epoch)return;pending.delete(selected);running--;drain()});
   source=nextSource();
  }
 };
 return {
  getSnapshot:()=>snapshot,getServerSnapshot:()=>EMPTY_SLOTS,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
  start:()=>{if(enabled)return;enabled=true;epoch++;controller=new AbortController();drain()},
  stop:()=>{enabled=false;epoch++;controller.abort();pending.clear();running=0},
  activate:(active:number[])=>{indices=[...new Set(active)].filter(index=>Number.isInteger(index)&&index>=0&&index<18);drain()},
  reject:(index:number,source:string)=>{if(snapshot[index]!==source)return;const original=assigned[index];if(!original)return;cache.delete(original);replace(original);drain()},
 };
}
