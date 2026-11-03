"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import HistoryPopover from '../leaderboard/HistoryPopover';
import HistoryPanel,{standardHistoryMetrics} from '../HistoryPanel';
import {useHoverPreviews} from '../state/hover-previews';
import {historyTargetKey,type HistoryTarget} from '../data/usePriceHistoryBatch';
import type {ArticleProduct} from '../../core/domain/articles';
import type {PriceHistory} from '../../core/domain/types';

export const articleHistoryTarget=(p:ArticleProduct):HistoryTarget=>({productId:p.productId,printing:p.printing,sealed:p.kind==='sealed',snapshotId:p.metrics?.snapshotId??'unavailable'});
export default function ArticleCardLink({href,children,product,histories,ensure}:{href:string;children:ReactNode;product?:ArticleProduct;histories:Record<string,PriceHistory>;ensure:(targets:HistoryTarget[])=>Promise<void>}){
 const enabled=useHoverPreviews(),[open,setOpen]=useState(false),[position,setPosition]=useState<{top:number;left:number}|null>(null),id=useId();
 const anchor=useRef<HTMLAnchorElement>(null),panel=useRef<HTMLDialogElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),skipFocus=useRef(false),[pending,setPending]=useState(false);
 const hover=()=>window.matchMedia('(hover:hover) and (pointer:fine)').matches;
 const cancel=()=>{if(timer.current)clearTimeout(timer.current)};
 const requestHistory=()=>{if(!product)return;setPending(true);void ensure([articleHistoryTarget(product)]).finally(()=>setPending(false))};
 const reveal=()=>{if(!enabled||!product)return;cancel();setOpen(true);requestHistory()};
 const dismiss=()=>{cancel();setOpen(false)};
 const leave=()=>{cancel();timer.current=setTimeout(()=>setOpen(false),160)};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 useEffect(()=>{
  if(!open)return;
  const place=()=>{if(!anchor.current)return;const r=anchor.current.getBoundingClientRect(),height=panel.current?.offsetHeight??430,width=Math.min(430,window.innerWidth-24);setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:Math.max(12,r.bottom+height+14<window.innerHeight?r.bottom+10:r.top-height-10)})};
  const frame=requestAnimationFrame(place);const close=(event:PointerEvent)=>{if(!anchor.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))setOpen(false)};
  window.addEventListener('pointerdown',close);window.addEventListener('scroll',place,true);window.addEventListener('resize',place);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointerdown',close);window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place)};
 },[open]);
 const loaded=product?histories[historyTargetKey(articleHistoryTarget(product))]:undefined;
 const keyDown=(event:React.KeyboardEvent)=>{if(event.key==='Escape'){dismiss();if(document.activeElement!==anchor.current){skipFocus.current=true;anchor.current?.focus()}}};
 return <span className="article-card-reference"><a ref={anchor} href={href} aria-controls={enabled&&open?id:undefined} aria-expanded={enabled?open:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse')reveal()}} onPointerLeave={leave} onFocus={()=>{if(skipFocus.current){skipFocus.current=false;return}if(hover())reveal()}} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget as Node))leave()}} onKeyDown={keyDown} onClick={event=>{if(enabled&&product&&!hover()&&event.detail!==0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();if(open)dismiss();else reveal()}}}>{children}</a>{enabled&&open&&product&&createPortal(<dialog open ref={panel} aria-label="Current card history" tabIndex={-1} className="article-card-preview" id={id} style={{top:position?.top??0,left:position?.left??0,visibility:position?'visible':'hidden'}} onPointerEnter={cancel} onPointerLeave={leave} onFocus={cancel} onBlur={event=>{if(!panel.current?.contains(event.relatedTarget as Node)&&event.relatedTarget!==anchor.current)leave()}} onKeyDown={keyDown}>
  <HistoryPopover className="article-history-popover" identityClassName="article-preview-identity" image={product.image} alt={product.name} label={`${product.name} current market history`}>
   <strong>{product.name}</strong><small>{product.set} · {product.number} · {product.kind==='single'?`English · Near Mint ${product.printing}`:'English · Unopened'}</small>
   <HistoryPanel title={`Current market history · As of ${product.metrics?.asOfDate??'unavailable'}`} subtitle="TCGplayer market · Article quotes remain dated" points={loaded?.points??[]} metrics={standardHistoryMetrics(product.marketPrice,product.midPrice,loaded)} loading={pending&&!loaded}/>
  </HistoryPopover><span className="article-preview-actions"><a href={href}>View details →</a><button type="button" onClick={requestHistory}>Retry chart</button><button type="button" aria-label="Close card preview" onClick={dismiss}>Close</button></span>
 </dialog>,document.body)}</span>;
}
